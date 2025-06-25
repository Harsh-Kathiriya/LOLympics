/**
 * Room Lobby Page Component
 * 
 * This component manages the pre-game lobby where players wait for others to join
 * and mark themselves as ready before the game begins. It handles:
 * - Real-time player management via Ably channels
 * - Player presence and status updates
 * - Avatar and name changes
 * - Ready state management
 * - Automatic game start when conditions are met
 * - Room code sharing and player departure
 */
"use client";

import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { PlayerAvatar } from '@/components/game/player-avatar';
import { ReadyToggle } from '@/components/game/ready-toggle';
import { CountdownOverlay } from '@/components/game/countdown-overlay';
import { AvatarSelector } from '@/components/game/avatar-selector';
import { Copy, Users, LogOut } from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabase';
import { useAbly } from '@/components/AblyContext';
import {
  useRoomChannel,
  RoomEvent,
  PlayerJoinedPayload,
  PlayerLeftPayload,
  PlayerReadyUpdatePayload,
  PlayerNameUpdatePayload,
  GamePhaseChangedPayload,
  RoomPresenceData,
  PlayerAvatarChangedPayload
} from '@/hooks/use-room-channel';
import { MIN_PLAYERS_TO_START } from '@/lib/constants';
import { soundManager } from '@/lib/sound';

// Configuration constants for avatar management and game rules
// Static assets in Next.js are served from the project root ("/"), so don't prefix with "/public".
const AVATAR_BASE_PATH = '/assets/avatars/';
const DEFAULT_AVATAR_FILE = 'eduardo.png';
const DEFAULT_AVATAR_SRC = `${AVATAR_BASE_PATH}${DEFAULT_AVATAR_FILE}`;

// Player data structure for lobby management
type Player = {
  id: string;
  name: string;
  avatarUrl: string;
  isReady: boolean;
  isCurrentUser?: boolean; // Flag to identify the current user in the player list
};

export default function LobbyPage() {
  const params = useParams();
  const roomCode = params.roomCode as string;
  const router = useRouter();
  const { toast } = useToast();
  const { initializeAbly, isConnected: isAblyInitialized } = useAbly();

  // Core state management
  const [players, setPlayers] = useState<Player[]>([]); // All players in the room
  const [isStartingGame, setIsStartingGame] = useState(false); // Game start animation state
  const [startGamePromise, setStartGamePromise] = useState<Promise<any> | null>(null);
  const [roomId, setRoomId] = useState(''); // Internal room ID from database
  const [currentUser, setCurrentUser] = useState<Player | null>(null); // Current user's player data
  const [isLoading, setIsLoading] = useState(true); // Initial data loading state

  // Ref to prevent duplicate initial presence updates
  const initialPresenceSent = useRef(false);

  /**
   * Initial data fetching and room setup
   * 
   * This effect handles:
   * - Authentication verification
   * - Room existence validation
   * - Initial player data loading
   * - Current user identification
   * - Ably connection initialization
   */
  useEffect(() => {
    const fetchRoomInfo = async () => {
      if (!roomCode) return;

      setIsLoading(true);
      try {
        // Verify user authentication
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          toast({ title: "Not Authenticated", description: "Redirecting...", variant: "destructive" });
          router.push('/');
          return;
        }

        // Ably should already be initialized from the home page when joining/creating room
        // We'll verify it's connected before using it
        if (!isAblyInitialized) {
          console.warn('Ably should have been initialized before reaching the lobby');
          initializeAbly();
        }

        // Fetch room data and validate room exists
        const { data: roomData, error: roomError } = await supabase.from('rooms').select('id').eq('room_code', roomCode).single();
        if (roomError || !roomData) {
          toast({ title: "Room Not Found", description: "Redirecting...", variant: "destructive" });
          router.push('/');
          return;
        }
        setRoomId(roomData.id);

        // Load all players currently in the room
        const { data: playersData, error: playersError } = await supabase.from('players').select('id, username, is_ready, room_id, avatar_src').eq('room_id', roomData.id);
        if (playersError) {
          console.error('Error fetching players:', playersError);
          toast({ 
            title: "Error Fetching Players", 
            description: `${playersError.message || 'Unknown error'}. Code: ${playersError.code || 'none'}`, 
            variant: "destructive" 
          });
          return;
        }

        // Transform database player data to component format
        const transformedPlayers = playersData.map(player => ({
          id: player.id,
          name: player.username,
          avatarUrl: (player.avatar_src || DEFAULT_AVATAR_SRC).replace('/public', ''),
          isReady: !!player.is_ready, // Ensure boolean
          isCurrentUser: player.id === session.user.id,
        }));
        setPlayers(transformedPlayers);

        // Identify and set current user data
        const foundCurrentUser = transformedPlayers.find(p => p.isCurrentUser);
        if (foundCurrentUser) {
          setCurrentUser(foundCurrentUser);
        } else {
          toast({ title: "Error", description: "You're not in this room. Redirecting...", variant: "destructive" });
          router.push('/');
        }
      } catch (e: any) {
        toast({ title: "Error", description: e.message || "Unexpected error.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
      // Reset presence flag when room changes
      initialPresenceSent.current = false;
    };
    fetchRoomInfo();
  }, [roomCode, router, isAblyInitialized, initializeAbly, toast]); // Added Ably dependencies

  const roomChannel = useRoomChannel(roomCode);

  /**
   * Initial presence setup and join announcement.
   * 
   * Establishes player presence in the Ably channel when they join the room.
   * Crucially, after entering presence, it also PUBLISHES a `PLAYER_JOINED` event
   * so that other clients, who are subscribed to this event, can update their UI.
   */
  useEffect(() => {
    // This effect should only run once when the user and channel are ready.
    if (
      roomChannel.isReady &&
      currentUser &&
      !initialPresenceSent.current // Guard against re-running
    ) {
        const joinSequence = async () => {
            // Prevent this from running again.
            initialPresenceSent.current = true;
            
            // 1. Define the data for presence and the join event.
            const presenceData: RoomPresenceData = {
                status: 'online',
                isReady: currentUser.isReady,
                lastActivity: Date.now(),
                avatarSrc: currentUser.avatarUrl,
                playerId: currentUser.id,
                playerName: currentUser.name,
            };
            const joinPayload: PlayerJoinedPayload = {
                playerId: currentUser.id,
                playerName: currentUser.name,
                avatarSrc: currentUser.avatarUrl,
            };

            try {
                // 2. Enter the presence set. This is for knowing "who is currently here".
                await roomChannel.updatePresence(presenceData);
                console.log('Successfully entered/updated presence.');

                // 3. *** THE FIX ***
                // Publish the PLAYER_JOINED event. This is the "knock on the door"
                // that other clients are explicitly listening for to update their player list.
                await roomChannel.publish<PlayerJoinedPayload>(RoomEvent.PLAYER_JOINED, joinPayload);
                console.log('Successfully published PLAYER_JOINED event.');

            } catch (error) {
                console.error('Error during join sequence (presence/publish):', error);
                // If it fails, allow it to be tried again on the next render.
                initialPresenceSent.current = false;
            }
        };

        joinSequence();
    }
  }, [roomChannel.isReady, currentUser, roomChannel]); // Dependencies ensure this runs when ready.

  /**
   * Real-time event subscriptions
   * 
   * Sets up Ably channel event listeners.
   */
  useEffect(() => {
    if (!roomChannel.isReady || !currentUser?.id || !roomId) {
      return;
    }

    // Handle new player joining the room
    const handlePlayerJoined = (data: PlayerJoinedPayload) => {
      // The guard below is crucial. Ably echoes messages back to the publisher by default.
      // This prevents the joining user from adding themselves to the list twice.
      if (data.playerId === currentUser.id) {
        console.log("Ignoring self-join event.");
        return;
      }

      toast({ title: "Player Joined", description: `${data.playerName} has joined the lobby.` });
      
      // Add the new player to the state only if they aren't already there.
      setPlayers(prev => prev.some(p => p.id === data.playerId) ? prev : [...prev, {
        id: data.playerId, 
        name: data.playerName,
        avatarUrl: data.avatarSrc || DEFAULT_AVATAR_SRC,
        isReady: false, 
        isCurrentUser: false
      }]);
    };

    // Handle player leaving the room
    const handlePlayerLeft = (data: PlayerLeftPayload) => {
      setPlayers(prev => prev.filter(p => p.id !== data.playerId));
    };

    // Handle ready status changes from any player
    const handlePlayerReadyUpdate = (data: PlayerReadyUpdatePayload) => {
      setPlayers(prev => prev.map(p => p.id === data.playerId ? { ...p, isReady: data.isReady } : p));
      if (currentUser.id === data.playerId) {
        setCurrentUser(prevUser => prevUser ? { ...prevUser, isReady: data.isReady } : null);
      }
    };

    // Handle avatar changes from any player
    const handlePlayerAvatarChanged = (data: PlayerAvatarChangedPayload) => {
      setPlayers(prev => prev.map(p => p.id === data.playerId ? { ...p, avatarUrl: data.avatarSrc } : p));
      if (currentUser.id === data.playerId) {
        setCurrentUser(prevUser => prevUser ? { ...prevUser, avatarUrl: data.avatarSrc } : null);
      }
    };

    // Handle name changes from any player
    const handlePlayerNameChanged = (data: PlayerNameUpdatePayload) => {
      setPlayers(prev => prev.map(p => p.id === data.playerId ? { ...p, name: data.newName } : p));
      if (currentUser.id === data.playerId) {
        setCurrentUser(prevUser => prevUser ? { ...prevUser, name: data.newName } : null);
      }
    };

    // Handle game phase transitions (e.g., lobby -> meme selection)
    const handleGamePhaseChanged = (data: GamePhaseChangedPayload) => {
      if (data.phase === "meme-selection") router.push(`/room/${roomCode}/meme-selection`);
    };

    // Subscribe to all relevant events
    const unsubJoined = roomChannel.subscribe<PlayerJoinedPayload>(RoomEvent.PLAYER_JOINED, handlePlayerJoined);
    const unsubLeft = roomChannel.subscribe<PlayerLeftPayload>(RoomEvent.PLAYER_LEFT, handlePlayerLeft);
    const unsubReady = roomChannel.subscribe<PlayerReadyUpdatePayload>(RoomEvent.PLAYER_READY_UPDATE, handlePlayerReadyUpdate);
    const unsubPhase = roomChannel.subscribe<GamePhaseChangedPayload>(RoomEvent.GAME_PHASE_CHANGED, handleGamePhaseChanged);
    const unsubAvatar = roomChannel.subscribe<PlayerAvatarChangedPayload>(RoomEvent.PLAYER_AVATAR_CHANGED, handlePlayerAvatarChanged);
    const unsubName = roomChannel.subscribe<PlayerNameUpdatePayload>(RoomEvent.PLAYER_NAME_UPDATE, handlePlayerNameChanged);

    // Cleanup subscriptions when dependencies change
    return () => {
      unsubJoined(); 
      unsubLeft(); 
      unsubReady(); 
      unsubPhase(); 
      unsubAvatar();
      unsubName();
    };
  }, [roomChannel.isReady, currentUser?.id, roomId, router, roomCode, toast]); // Added roomCode to dependencies

  // Calculate if all players are ready for game start
  const allPlayersReady = players.length > 0 && players.every(p => p.isReady);

  /**
   * Automatic game start logic
   */
  useEffect(() => {
    if (allPlayersReady && players.length >= MIN_PLAYERS_TO_START && !isStartingGame) {
      toast({ title: "Everyone's Ready!", description: "Starting game..." });
      
      const startGame = async () => {
        if (!roomCode) {
          toast({ title: "Room code missing", variant: "destructive" });
          return { error: new Error("Room code missing") };
        }
        return supabase.rpc('start_game', { p_room_code: roomCode });
      };

      setStartGamePromise(startGame());
      setIsStartingGame(true);
    }
  }, [allPlayersReady, players.length, isStartingGame, toast, roomCode]);

  /**
   * Handle player leaving the room
   */
  const handleLeaveRoom = useCallback(async () => {
    if (!roomId || !currentUser) return;
    
    // Play button click sound
    if (soundManager) {
      soundManager.playButtonClick();
    }
    
    try {
      await supabase.rpc('leave_room', { p_room_id: roomId });
      if (roomChannel.isConnected) {
        await roomChannel.publish<PlayerLeftPayload>(RoomEvent.PLAYER_LEFT, { playerId: currentUser.id });
      }
      toast({ title: "Left Room", description: "You have successfully left the room." });
      router.push('/');
    } catch (e: any) {
      console.error('Unexpected error during room exit:', e);
      toast({ title: "Error Leaving Room", description: e.message, variant: "destructive" });
    }
  }, [roomId, currentUser, roomChannel, router, toast]);

  /**
   * Handle ready status toggle
   */
  const handleReadyToggle = useCallback(async (playerId: string, ready: boolean) => {
    if (!currentUser || playerId !== currentUser.id || !roomChannel.isConnected) return;
    
    // Play button click sound
    if (soundManager) {
      soundManager.playButtonClick();
    }
    
    try {
      await supabase.from('players').update({ is_ready: ready }).eq('id', playerId).throwOnError();
      const updatedUser = { ...currentUser, isReady: ready };
      setCurrentUser(updatedUser);
      setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, isReady: ready } : p));
      await roomChannel.publish<PlayerReadyUpdatePayload>(RoomEvent.PLAYER_READY_UPDATE, { playerId, isReady: ready });
      const presenceData: RoomPresenceData = {
          status: 'online',
          isReady: updatedUser.isReady,
          lastActivity: Date.now(),
          avatarSrc: updatedUser.avatarUrl,
          playerId: updatedUser.id,
          playerName: updatedUser.name
      };
      await roomChannel.updatePresence(presenceData);
    } catch (error: any) {
      console.error('Error updating ready status:', error);
      toast({ title: "Error", description: "Could not update ready status.", variant: "destructive" });
    }
  }, [currentUser, roomChannel, toast]);

  /**
   * Handle avatar change
   */
  const handleAvatarChange = useCallback(async (newAvatarSrc: string) => {
    if (!currentUser || !roomChannel.isConnected) return;
    if (currentUser.avatarUrl === newAvatarSrc) return;

    // Play settings click sound for avatar selection
    if (soundManager) {
      soundManager.playSettingsClick();
    }

    try {
      await supabase.from('players').update({ avatar_src: newAvatarSrc }).eq('id', currentUser.id).throwOnError();
      const updatedUser = { ...currentUser, avatarUrl: newAvatarSrc };
      setCurrentUser(updatedUser);
      setPlayers(prevPlayers => prevPlayers.map(p => p.id === currentUser.id ? { ...p, avatarUrl: newAvatarSrc } : p));
      await roomChannel.publish<PlayerAvatarChangedPayload>(RoomEvent.PLAYER_AVATAR_CHANGED, {
        playerId: currentUser.id, avatarSrc: newAvatarSrc
      });
      const presenceData: RoomPresenceData = {
          status: 'online',
          isReady: updatedUser.isReady,
          lastActivity: Date.now(),
          avatarSrc: updatedUser.avatarUrl,
          playerId: updatedUser.id,
          playerName: updatedUser.name
      };
      await roomChannel.updatePresence(presenceData);
      toast({ title: "Profile Updated", description: "Your avatar has been changed." });
    } catch (error: any) {
      console.error('Error updating avatar:', error);
      toast({ title: "Error", description: "Could not save your new avatar.", variant: "destructive" });
    }
  }, [currentUser, roomChannel, toast]);

  /**
   * Handle name change
   */
  const handleNameChange = useCallback(async (name: string) => {
    if (!currentUser || !roomChannel.isConnected) return;
    if (currentUser.name === name) return;

    // Play settings click sound for name change
    if (soundManager) {
      soundManager.playSettingsClick();
    }

    try {
      await supabase.from('players').update({ username: name }).eq('id', currentUser.id).throwOnError();
      const updatedUser = { ...currentUser, name: name };
      setCurrentUser(updatedUser);
      setPlayers(prev => prev.map(p => p.id === currentUser.id ? { ...p, name: name } : p));
      await roomChannel.publish<PlayerNameUpdatePayload>(RoomEvent.PLAYER_NAME_UPDATE, { playerId: currentUser.id, newName: name });
      toast({ title: "Profile Updated", description: "Your name has been changed." });
    } catch (error: any) {
      console.error('Error updating name:', error);
      toast({ title: "Error", description: "Could not update name.", variant: "destructive" });
    }
  }, [currentUser, roomChannel, toast]);

  /**
   * Handle countdown completion
   */
  const handleCountdownEnd = useCallback(async () => {
    if (!startGamePromise) {
      toast({ title: "Game start error", description: "An unexpected error occurred.", variant: "destructive" });
      setIsStartingGame(false);
      return;
    }
    
    try {
      const { error } = await startGamePromise;
      if (error) {
        console.error('Error starting game:', error);
        toast({ title: "Error Starting Game", description: error.message, variant: "destructive" });
        setIsStartingGame(false);
        return;
      }
      
      if (roomChannel.isConnected) {
        await roomChannel.publish<GamePhaseChangedPayload>(RoomEvent.GAME_PHASE_CHANGED, { phase: 'meme-selection' });
      }
      router.push(`/room/${roomCode}/meme-selection`);
    } catch (e: any) {
      console.error('Unexpected error during game start:', e);
      toast({ title: "Error", description: e.message || 'Unexpected error', variant: 'destructive' });
      setIsStartingGame(false);
    }
  }, [roomCode, roomChannel, router, toast, startGamePromise]);

  /**
   * Copy room code to clipboard
   */
  const copyRoomCode = useCallback(() => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      toast({ title: "Room Code Copied!", description: `Code "${roomCode}" copied.` });
      
      // Play button click sound
      if (soundManager) {
        soundManager.playButtonClick();
      }
    }
  }, [roomCode, toast]);

  if (isLoading) return <div className="text-center py-10 font-headline text-2xl text-primary">Loading room...</div>;
  if (!currentUser) return <div className="text-center py-10 font-headline text-2xl text-primary">Initializing player...</div>;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {isStartingGame && <CountdownOverlay duration={3} onCountdownEnd={handleCountdownEnd} />}
      
      <Card className="shadow-xl card-jackbox border-2 border-primary/50">
        <CardHeader className="text-center border-b-2 border-border pb-6">
            <CardTitle className="font-headline text-4xl md:text-5xl text-primary title-jackbox">
                Room Lobby
            </CardTitle>
            <div className="flex items-center justify-center space-x-2 mt-4">
                <p className="text-2xl md:text-3xl font-code text-accent tracking-wider p-3 bg-black/40 rounded-md border border-accent/50 shadow-inner">
                {roomCode || "NO_CODE"}
                </p>
                <Button variant="ghost" size="icon" onClick={copyRoomCode} aria-label="Copy room code" className="text-accent hover:text-pink-400 btn-jackbox">
                <Copy className="h-6 w-6" />
                </Button>
            </div>
            <CardDescription className="mt-2 text-muted-foreground font-body">
                Waiting for players. The game starts when everyone is ready! Min {MIN_PLAYERS_TO_START} players.
            </CardDescription>
        </CardHeader>

        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
            <h3 className="font-headline text-2xl md:text-3xl flex items-center text-primary">
              <Users className="mr-3 h-7 w-7 md:h-8 md:w-8" /> Players ({players.length})
            </h3>
            <AvatarSelector
              currentAvatar={currentUser.avatarUrl}
              currentName={currentUser.name}
              onAvatarChange={handleAvatarChange}
              onNameChange={handleNameChange}
            />
          </div>
          
          <div className="space-y-4">
            {players.map(player => (
              <Card
                key={player.id}
                className={`p-4 flex justify-between items-center border transition-colors duration-200 ${
                  player.isCurrentUser 
                    ? 'bg-primary/10 border-primary' 
                    : 'bg-card/80 border-secondary hover:border-primary'
                }`}
              >
                <PlayerAvatar
                  name={player.name}
                  avatarUrl={player.avatarUrl}
                />
                <ReadyToggle
                  key={`${player.id}-${player.isReady}`}
                  playerId={player.id}
                  isReady={player.isReady}
                  onToggle={(ready) => handleReadyToggle(player.id, ready)}
                  disabled={!player.isCurrentUser || isStartingGame}
                />
              </Card>
            ))}
            {players.length === 0 && !isLoading && (
              <p className="text-center text-muted-foreground">No players yet. Invite some friends!</p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex justify-center items-center gap-4 pt-8 mt-4 border-t-2 border-border">
            <Button
                variant="outline"
                onClick={handleLeaveRoom}
                className="btn-jackbox hover:bg-muted hover:text-muted-foreground"
                disabled={isStartingGame}
            >
                <LogOut className="mr-2 h-4 w-4" /> Leave Room
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}