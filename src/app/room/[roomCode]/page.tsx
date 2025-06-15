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
  GamePhaseChangedPayload,
  RoomPresenceData,
  PlayerAvatarChangedPayload
} from '@/hooks/use-room-channel';

// Configuration constants for avatar management and game rules
const AVATAR_BASE_PATH = '/assets/avatars/';
const DEFAULT_AVATAR_FILE = 'eduardo.png';
const DEFAULT_AVATAR_SRC = `${AVATAR_BASE_PATH}${DEFAULT_AVATAR_FILE}`;
const MIN_PLAYERS_TO_START = 3; // Minimum players required to start the game

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
          toast({ title: "Error", description: `Fetching players: ${playersError.message}`, variant: "destructive" });
          return;
        }

        // Transform database player data to component format
        const transformedPlayers = playersData.map(player => ({
          id: player.id,
          name: player.username,
          avatarUrl: player.avatar_src || DEFAULT_AVATAR_SRC,
          isReady: player.is_ready,
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
  }, [roomCode, router]); // Only re-run when room code or router changes

  // Use room code for channel name, easier to debug and consistent with URL
// This ensures all clients connect to the same channel regardless of internal DB ids
const roomChannel = useRoomChannel(roomCode);

  /**
   * Initial presence setup
   * 
   * Establishes player presence in the Ably channel when they join the room.
   * This lets other players see them as online and enables PLAYER_JOINED events.
   * We use enter() first time and then updatePresence() for subsequent updates.
   */
  useEffect(() => {
    if (
      roomChannel.isConnected &&
      roomChannel.channel &&
      currentUser &&
      !initialPresenceSent.current // Guard against duplicate presence entries
    ) {
      console.log('Entering presence with complete player data');
      
      // Complete player data for presence and PLAYER_JOINED events
      const completePresenceData: RoomPresenceData = {
        status: 'online',
        isReady: currentUser.isReady,
        lastActivity: Date.now(),
        avatarSrc: currentUser.avatarUrl,
        // Add player identification data for PLAYER_JOINED events
        playerId: currentUser.id,
        playerName: currentUser.name,
      };
      
      // Use enter() directly from the channel instead of updatePresence()
      // This ensures we properly enter presence the first time
      roomChannel.channel.presence.enter(completePresenceData)
        .then(() => {
          console.log('Successfully entered presence with player data');
          initialPresenceSent.current = true;
        })
        .catch(error => {
          console.error('Error entering presence:', error);
          // Don't mark as sent if it fails, allowing retry on next render
        });
    }
  }, [roomChannel.isConnected, roomChannel.channel, currentUser]);

  /**
   * Real-time event subscriptions
   * 
   * Sets up Ably channel event listeners for:
   * - Player joins/leaves
   * - Ready status changes
   * - Avatar changes
   * - Game phase transitions
   * 
   * Each handler updates local state and provides user feedback.
   * Unsubscribes when dependencies change to prevent memory leaks.
   */
  useEffect(() => {
    // Only subscribe when channel is ready and we have user context
    if (!roomChannel.isConnected || !roomChannel.channel || !currentUser?.id || !roomId) {
      return;
    }

    // Handle new player joining the room
    const handlePlayerJoined = (data: PlayerJoinedPayload) => {
      // Skip self-join events to avoid duplicates
      if (data.playerId === currentUser.id) return;

      setPlayers(prev => prev.some(p => p.id === data.playerId) ? prev : [...prev, {
        id: data.playerId, 
        name: data.playerName,
        avatarUrl: data.avatarSrc || DEFAULT_AVATAR_SRC,
        isReady: false, 
        isCurrentUser: false
      }]);
      toast({ title: "Player Joined", description: `${data.playerName} joined.` });
    };

    // Handle player leaving the room
    const handlePlayerLeft = (data: PlayerLeftPayload) => {
      setPlayers(prev => prev.filter(p => p.id !== data.playerId));
    };

    // Handle ready status changes from any player
    const handlePlayerReadyUpdate = (data: PlayerReadyUpdatePayload) => {
      setPlayers(prev => prev.map(p => p.id === data.playerId ? { ...p, isReady: data.isReady } : p));
      // Update current user state if the change applies to them
      if (currentUser.id === data.playerId) {
        setCurrentUser(prevUser => (prevUser && prevUser.isReady !== data.isReady) ? { ...prevUser, isReady: data.isReady } : prevUser);
      }
    };

    // Handle avatar changes from any player
    const handlePlayerAvatarChanged = (data: PlayerAvatarChangedPayload) => {
      setPlayers(prev => prev.map(p => p.id === data.playerId ? { ...p, avatarUrl: data.avatarSrc } : p));
      // Update current user state if the change applies to them
      if (currentUser.id === data.playerId) {
        setCurrentUser(prevUser => {
          if (prevUser && prevUser.avatarUrl !== data.avatarSrc) {
            return { ...prevUser, avatarUrl: data.avatarSrc };
          }
          return prevUser;
        });
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

    // Cleanup subscriptions when dependencies change
    return () => {
      unsubJoined(); 
      unsubLeft(); 
      unsubReady(); 
      unsubPhase(); 
      unsubAvatar();
    };
  }, [roomChannel.isConnected, roomChannel.channel, currentUser?.id, roomId, router, toast]);

  // Calculate if all players are ready for game start
  const allPlayersReady = players.length > 0 && players.every(p => p.isReady);

  /**
   * Automatic game start logic
   * 
   * Monitors when all players are ready and minimum player count is met.
   * Triggers the countdown overlay and game start sequence.
   */
  useEffect(() => {
    if (allPlayersReady && players.length >= MIN_PLAYERS_TO_START && !isStartingGame) {
      toast({ title: "Everyone's Ready!", description: "Starting game..." });
      setIsStartingGame(true);
    }
  }, [allPlayersReady, players.length, isStartingGame, toast]);

  /**
   * Handle player leaving the room
   * 
   * Removes player from database, publishes leave event to other players,
   * and redirects to home page.
   */
  const handleLeaveRoom = useCallback(async () => {
    if (!roomId || !currentUser) return;
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
   * 
   * Updates database, publishes event to other players, and updates presence.
   * Only allows current user to toggle their own ready status.
   */
  const handleReadyToggle = useCallback(async (playerId: string, ready: boolean) => {
    if (!currentUser || playerId !== currentUser.id || !roomChannel.isConnected) return;
    try {
      // Update database first
      await supabase.from('players').update({ is_ready: ready }).eq('id', playerId).throwOnError();

      // Update local state immediately for responsive UI
      const updatedUser = { ...currentUser, isReady: ready };
      setCurrentUser(updatedUser);
      setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, isReady: ready } : p));

      // Notify other players via Ably
      await roomChannel.publish<PlayerReadyUpdatePayload>(RoomEvent.PLAYER_READY_UPDATE, { playerId, isReady: ready });

      // Update presence to reflect new ready status
      const presenceData: RoomPresenceData = {
          status: 'online',
          isReady: updatedUser.isReady,
          lastActivity: Date.now(),
          avatarSrc: updatedUser.avatarUrl,
          // Include player data needed for PLAYER_JOINED events
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
   * 
   * Updates database, publishes event to other players, and updates presence.
   * Includes duplicate prevention to avoid unnecessary updates.
   */
  const handleAvatarChange = useCallback(async (newAvatarFile: string) => {
    if (!currentUser || !roomChannel.isConnected) return;
    const newAvatarSrc = `${AVATAR_BASE_PATH}${newAvatarFile}`;

    // Prevent unnecessary updates if avatar is already set
    if (currentUser.avatarUrl === newAvatarSrc) {
        return;
    }

    try {
      // Update database
      await supabase.from('players').update({ avatar_src: newAvatarSrc }).eq('id', currentUser.id).throwOnError();

      // Update local state for immediate UI feedback
      const updatedUser = { ...currentUser, avatarUrl: newAvatarSrc };
      setCurrentUser(updatedUser);
      setPlayers(prevPlayers => prevPlayers.map(p => p.id === currentUser.id ? { ...p, avatarUrl: newAvatarSrc } : p));

      // Notify other players
      await roomChannel.publish<PlayerAvatarChangedPayload>(RoomEvent.PLAYER_AVATAR_CHANGED, {
        playerId: currentUser.id, avatarSrc: newAvatarSrc
      });

      // Update presence with new avatar
      const presenceData: RoomPresenceData = {
          status: 'online',
          isReady: updatedUser.isReady,
          lastActivity: Date.now(),
          avatarSrc: updatedUser.avatarUrl,
          // Include player data needed for PLAYER_JOINED events
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
   * 
   * Updates database and local state. Name changes are not currently
   * broadcast via Ably events but could be extended for real-time updates.
   */
  const handleNameChange = useCallback(async (name: string) => {
    if (!currentUser || !roomChannel.isConnected) return;
    if (currentUser.name === name) return; // Prevent unnecessary updates

    try {
      await supabase.from('players').update({ username: name }).eq('id', currentUser.id).throwOnError();
      
      const updatedUser = { ...currentUser, name: name };
      setCurrentUser(updatedUser);
      setPlayers(prev => prev.map(p => p.id === currentUser.id ? { ...p, name: name } : p));

      // Note: Name changes could be broadcast via Ably if real-time name updates are needed
      // await roomChannel.publish(RoomEvent.PLAYER_NAME_CHANGED, { playerId: currentUser.id, newName: name });

      toast({ title: "Profile Updated", description: "Your name has been changed." });
    } catch (error: any) {
      console.error('Error updating name:', error);
      toast({ title: "Error", description: "Could not update name.", variant: "destructive" });
    }
  }, [currentUser, roomChannel, toast]);

  /**
   * Handle countdown completion
   * 
   * Triggered when the game start countdown finishes.
   * Publishes game phase change and navigates to meme selection.
   */
  const handleCountdownEnd = useCallback(() => {
    if (!roomId) {
      toast({ title: "Navigation Error", variant: "destructive" });
      setIsStartingGame(false);
      return;
    }
    if (roomChannel.isConnected) {
      roomChannel.publish<GamePhaseChangedPayload>(RoomEvent.GAME_PHASE_CHANGED, { phase: "meme-selection" })
        .catch(error => console.error('Error publishing game phase change:', error));
    }
    router.push(`/room/${roomCode}/meme-selection`);
  }, [roomId, roomChannel, router, toast]);

  /**
   * Copy room code to clipboard
   * 
   * Allows players to easily share the room code with friends.
   */
  const copyRoomCode = useCallback(() => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      toast({ title: "Room Code Copied!", description: `Code "${roomCode}" copied.` });
    }
  }, [roomCode, toast]);

  // Loading and error states
  if (isLoading) return <div className="text-center py-10 font-headline text-2xl text-primary">Loading room...</div>;
  if (!currentUser) return <div className="text-center py-10 font-headline text-2xl text-primary">Initializing player...</div>;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Game start countdown overlay */}
      {isStartingGame && <CountdownOverlay duration={3} onCountdownEnd={handleCountdownEnd} />}
      
      <Card className="shadow-xl card-jackbox border-2 border-primary/50">
        {/* Room header with code and copy functionality */}
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
          {/* Player count and avatar selector section */}
          <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
            <h3 className="font-headline text-2xl md:text-3xl flex items-center text-primary">
              <Users className="mr-3 h-7 w-7 md:h-8 md:w-8" /> Players ({players.length})
            </h3>
            <AvatarSelector
              currentAvatar={currentUser.avatarUrl.replace(AVATAR_BASE_PATH, '')}
              currentName={currentUser.name}
              onAvatarChange={handleAvatarChange}
              onNameChange={handleNameChange}
            />
          </div>
          
          {/* Player list with avatars and ready status */}
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

        {/* Footer with leave room button */}
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