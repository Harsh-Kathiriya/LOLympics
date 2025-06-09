"use client";

import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { PlayerAvatar } from '@/components/game/player-avatar';
import { ReadyToggle } from '@/components/game/ready-toggle';
import { CountdownOverlay } from '@/components/game/countdown-overlay';
import { AvatarSelector } from '@/components/game/avatar-selector';
import { Copy, Users, LogOut } from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react'; // useRef might be needed
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

const AVATAR_BASE_PATH = '/assets/avatars/';
const DEFAULT_AVATAR_FILE = 'eduardo.png';
const DEFAULT_AVATAR_SRC = `${AVATAR_BASE_PATH}${DEFAULT_AVATAR_FILE}`;
const MIN_PLAYERS_TO_START = 3;

type Player = {
  id: string;
  name: string;
  avatarUrl: string;
  isReady: boolean;
  dataAiHint?: string;
  isCurrentUser?: boolean;
};

export default function LobbyPage() {
  const params = useParams();
  const roomCode = params.roomCode as string;
  const router = useRouter();
  const { toast } = useToast();
  const { initializeAbly, isConnected: isAblyInitialized } = useAbly();

  const [players, setPlayers] = useState<Player[]>([]);
  const [isStartingGame, setIsStartingGame] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [currentUser, setCurrentUser] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const initialPresenceSent = useRef(false); // To send initial presence only once

  // useEffect for initial data fetching (largely unchanged)
  useEffect(() => {
    const fetchRoomInfo = async () => {
      if (!roomCode) return;

      setIsLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          toast({ title: "Not Authenticated", description: "Redirecting...", variant: "destructive" });
          router.push('/');
          return;
        }
        if (!isAblyInitialized) initializeAbly();

        const { data: roomData, error: roomError } = await supabase.from('rooms').select('id').eq('room_code', roomCode).single();
        if (roomError || !roomData) {
          toast({ title: "Room Not Found", description: "Redirecting...", variant: "destructive" });
          router.push('/');
          return;
        }
        setRoomId(roomData.id);

        const { data: playersData, error: playersError } = await supabase.from('players').select('id, username, is_ready, room_id, avatar_src').eq('room_id', roomData.id);
        if (playersError) {
          toast({ title: "Error", description: `Fetching players: ${playersError.message}`, variant: "destructive" });
          return;
        }

        const transformedPlayers = playersData.map(player => ({
          id: player.id,
          name: player.username,
          avatarUrl: player.avatar_src || DEFAULT_AVATAR_SRC,
          isReady: player.is_ready,
          isCurrentUser: player.id === session.user.id,
          dataAiHint: "player avatar"
        }));
        setPlayers(transformedPlayers);

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
      // Reset initialPresenceSent flag if room changes
      initialPresenceSent.current = false;
    };
    fetchRoomInfo();
  }, [roomCode, router, toast, initializeAbly, isAblyInitialized]); // Dependencies look OK

  const roomChannel = useRoomChannel(roomId);

  // Effect to send INITIAL presence once currentUser and channel are ready
  useEffect(() => {
    if (
      roomChannel.isConnected &&
      currentUser &&
      !initialPresenceSent.current // Only send if not already sent
    ) {
      const presenceData: RoomPresenceData = {
        status: 'online',
        isReady: currentUser.isReady,
        lastActivity: Date.now(),
        avatarSrc: currentUser.avatarUrl,
      };
      roomChannel.updatePresence(presenceData)
        .then(() => {
          initialPresenceSent.current = true; // Mark as sent
        })
        .catch(error => {
          console.error('LobbyPage: Error setting initial presence:', error);
          // Don't mark as sent if it fails, so it might retry on next render
        });
    }
    // This effect runs if currentUser changes, but the updatePresence is guarded by initialPresenceSent
  }, [roomChannel.isConnected, currentUser]); // Dependencies: channel and currentUser for initial data


  // useEffect for Ably event SUBSCRIPTIONS
  useEffect(() => {
    // Guard: only subscribe if channel is ready and we have a current user ID (for filtering self-events if needed)
    if (!roomChannel.isConnected || !roomChannel.channel || !currentUser?.id || !roomId) {
      return;
    }

    // NO general presence update here based on currentUser changes.
    // Specific handlers will update presence.

    const handlePlayerJoined = (data: PlayerJoinedPayload) => {
      // Avoid adding self if event is about current user joining
      if (data.playerId === currentUser.id) return;

      setPlayers(prev => prev.some(p => p.id === data.playerId) ? prev : [...prev, {
        id: data.playerId, name: data.playerName,
        avatarUrl: data.avatarSrc || DEFAULT_AVATAR_SRC, // Ensure PlayerJoinedPayload has avatarSrc
        isReady: false, isCurrentUser: false, dataAiHint: "player avatar"
      }]);
      toast({ title: "Player Joined", description: `${data.playerName} joined.` });
    };

    const handlePlayerLeft = (data: PlayerLeftPayload) => {
      setPlayers(prev => prev.filter(p => p.id !== data.playerId));
    };

    const handlePlayerReadyUpdate = (data: PlayerReadyUpdatePayload) => {
      setPlayers(prev => prev.map(p => p.id === data.playerId ? { ...p, isReady: data.isReady } : p));
      if (currentUser.id === data.playerId) { // CurrentUser is from closure, will be the one at time of subscription
        setCurrentUser(prevUser => (prevUser && prevUser.isReady !== data.isReady) ? { ...prevUser, isReady: data.isReady } : prevUser);
      }
    };

    const handlePlayerAvatarChanged = (data: PlayerAvatarChangedPayload) => {
      setPlayers(prev => prev.map(p => p.id === data.playerId ? { ...p, avatarUrl: data.avatarSrc } : p));
      if (currentUser.id === data.playerId) { // CurrentUser is from closure
        setCurrentUser(prevUser => {
          if (prevUser && prevUser.avatarUrl !== data.avatarSrc) {
            return { ...prevUser, avatarUrl: data.avatarSrc };
          }
          return prevUser;
        });
      }
    };

    const handleGamePhaseChanged = (data: GamePhaseChangedPayload) => {
      if (data.phase === "meme-selection") router.push(`/room/${roomId}/meme-selection`);
    };

    const unsubJoined = roomChannel.subscribe<PlayerJoinedPayload>(RoomEvent.PLAYER_JOINED, handlePlayerJoined);
    const unsubLeft = roomChannel.subscribe<PlayerLeftPayload>(RoomEvent.PLAYER_LEFT, handlePlayerLeft);
    const unsubReady = roomChannel.subscribe<PlayerReadyUpdatePayload>(RoomEvent.PLAYER_READY_UPDATE, handlePlayerReadyUpdate);
    const unsubPhase = roomChannel.subscribe<GamePhaseChangedPayload>(RoomEvent.GAME_PHASE_CHANGED, handleGamePhaseChanged);
    const unsubAvatar = roomChannel.subscribe<PlayerAvatarChangedPayload>(RoomEvent.PLAYER_AVATAR_CHANGED, handlePlayerAvatarChanged);

    return () => {
      unsubJoined(); unsubLeft(); unsubReady(); unsubPhase(); unsubAvatar();
    };
    // Dependencies:
    // roomChannel.isConnected and roomChannel.channel to re-subscribe if channel reconnects.
    // currentUser.id to ensure callbacks have the correct ID for self-filtering.
    // roomId, router, toast if used inside callbacks (router and toast are stable, roomId for nav).
    // The handlers themselves will close over the `currentUser` state at the time of subscription.
    // If these handlers need the *absolute latest* currentUser for complex logic,
    // you might need to use refs or pass currentUser into the Ably hook itself.
    // For simple ID checks and state updates, closure is usually fine.
  }, [roomChannel.isConnected, roomChannel.channel, currentUser?.id, roomId, router, toast]);

  const allPlayersReady = players.length > 0 && players.every(p => p.isReady);

  // useEffect for game start logic (unchanged)
  useEffect(() => {
    if (allPlayersReady && players.length >= MIN_PLAYERS_TO_START && !isStartingGame) {
      toast({ title: "Everyone's Ready!", description: "Starting game..." });
      setIsStartingGame(true);
    }
  }, [allPlayersReady, players.length, isStartingGame, toast]);

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

  // HANDLERS WILL NOW BE THE SOLE TRIGGERS FOR NON-INITIAL PRESENCE UPDATES
  const handleReadyToggle = useCallback(async (playerId: string, ready: boolean) => {
    if (!currentUser || playerId !== currentUser.id || !roomChannel.isConnected) return;
    try {
      await supabase.from('players').update({ is_ready: ready }).eq('id', playerId).throwOnError();

      // Update local state first
      const updatedUser = { ...currentUser, isReady: ready };
      setCurrentUser(updatedUser); // This will cause a re-render
      setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, isReady: ready } : p));

      // Publish Ably event
      await roomChannel.publish<PlayerReadyUpdatePayload>(RoomEvent.PLAYER_READY_UPDATE, { playerId, isReady: ready });

      // Update presence
      const presenceData: RoomPresenceData = {
          status: 'online',
          isReady: updatedUser.isReady, // Use the state that was just set
          lastActivity: Date.now(),
          avatarSrc: updatedUser.avatarUrl // Use the state that was just set
      };
      await roomChannel.updatePresence(presenceData);

    } catch (error: any) {
      console.error('Error updating ready status:', error);
      toast({ title: "Error", description: "Could not update ready status.", variant: "destructive" });
    }
  }, [currentUser, roomChannel, toast]); // currentUser is a dependency for its data

  const handleAvatarChange = useCallback(async (newAvatarFile: string) => {
    if (!currentUser || !roomChannel.isConnected) return;
    const newAvatarSrc = `${AVATAR_BASE_PATH}${newAvatarFile}`;

    // Prevent update if avatar is already the same
    if (currentUser.avatarUrl === newAvatarSrc) {
        // toast({ title: "No Change", description: "Avatar is already set to this."}); // Optional feedback
        return;
    }

    try {
      await supabase.from('players').update({ avatar_src: newAvatarSrc }).eq('id', currentUser.id).throwOnError();

      // Update local state first
      const updatedUser = { ...currentUser, avatarUrl: newAvatarSrc };
      setCurrentUser(updatedUser); // This will cause a re-render
      setPlayers(prevPlayers => prevPlayers.map(p => p.id === currentUser.id ? { ...p, avatarUrl: newAvatarSrc } : p));

      // Publish Ably event
      await roomChannel.publish<PlayerAvatarChangedPayload>(RoomEvent.PLAYER_AVATAR_CHANGED, {
        playerId: currentUser.id, avatarSrc: newAvatarSrc
      });

      // Update presence
      const presenceData: RoomPresenceData = {
          status: 'online',
          isReady: updatedUser.isReady, // Use the state that was just set
          lastActivity: Date.now(),
          avatarSrc: updatedUser.avatarUrl // Use the state that was just set
      };
      await roomChannel.updatePresence(presenceData);

      toast({ title: "Profile Updated", description: "Your avatar has been changed." });
    } catch (error: any) {
      console.error('Error updating avatar:', error);
      toast({ title: "Error", description: "Could not save your new avatar.", variant: "destructive" });
    }
  }, [currentUser, roomChannel, toast]); // currentUser is a dependency for its data

  const handleNameChange = useCallback(async (name: string) => {
    if (!currentUser || !roomChannel.isConnected) return;
    if (currentUser.name === name) return; // Prevent update if name is same

    try {
      await supabase.from('players').update({ username: name }).eq('id', currentUser.id).throwOnError();
      
      const updatedUser = { ...currentUser, name: name };
      setCurrentUser(updatedUser); // This will cause a re-render
      setPlayers(prev => prev.map(p => p.id === currentUser.id ? { ...p, name: name } : p));

      // Publish name change event if other players need to see it immediately (not just via presence)
      // await roomChannel.publish(RoomEvent.PLAYER_NAME_CHANGED, { playerId: currentUser.id, newName: name });

      // Update presence if name is part of presence data
      /*
      const presenceData: RoomPresenceData = {
          status: 'online',
          isReady: updatedUser.isReady,
          lastActivity: Date.now(),
          avatarSrc: updatedUser.avatarUrl,
          // name: updatedUser.name, // If name is in presence
      };
      await roomChannel.updatePresence(presenceData);
      */
      toast({ title: "Profile Updated", description: "Your name has been changed." });
    } catch (error: any) {
      console.error('Error updating name:', error);
      toast({ title: "Error", description: "Could not update name.", variant: "destructive" });
    }
  }, [currentUser, roomChannel, toast]); // currentUser is a dependency for its data

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
    router.push(`/room/${roomId}/meme-selection`);
  }, [roomId, roomChannel, router, toast]);

  const copyRoomCode = useCallback(() => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      toast({ title: "Room Code Copied!", description: `Code "${roomCode}" copied.` });
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
              currentAvatar={currentUser.avatarUrl.replace(AVATAR_BASE_PATH, '')}
              currentName={currentUser.name}
              onAvatarChange={handleAvatarChange}
              onNameChange={handleNameChange}
            />
          </div>
          <div className="space-y-4">
            {players.map(player => (
              <Card
                key={player.id}
                className={`p-4 flex justify-between items-center border transition-colors duration-200 ${player.isCurrentUser ? 'bg-primary/10 border-primary' : 'bg-card/80 border-secondary hover:border-primary'
                  }`}
              >
                <PlayerAvatar
                  name={player.name}
                  avatarUrl={player.avatarUrl}
                  dataAiHint={player.dataAiHint}
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