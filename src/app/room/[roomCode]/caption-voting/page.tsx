/**
 * CaptionVotingPage Component
 *
 * This component manages the caption voting phase of the game. It displays each
 * player's meme with their caption positioned on it. Players vote for their
 * favorite caption within a time limit.
 *
 * Core Logic:
 * 1.  Initialization: Fetches room, player, and current round data.
 * 2.  Waiting Phase: Polls the database until all players have submitted captions.
 * 3.  Voting Phase:
 *     - Displays each player's meme with their caption positioned on it.
 *     - Players can select a caption and confirm their vote.
 *     - Own captions are disabled.
 * 4.  Real-time Updates (Ably):
 *     - Listens for votes from other players to update the vote count UI.
 *     - Listens for a 'game-phase-changed' event to navigate to the results page.
 * 5.  Round Finalization:
 *     - A timer or all players voting triggers the tallying of votes.
 *     - Calls a Supabase RPC to finalize the round, which in turn triggers the
 *       'game-phase-changed' event for all clients.
 */
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { TimerBar } from '@/components/game/timer-bar';
import { CaptionCard } from '@/components/game/caption-card';
import { Card, CardContent } from '@/components/ui/card';
import { ThumbsUp, Vote, CheckCircle, Loader2, Clock } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabase';
import { useRoomChannel, RoomEvent, GamePhaseChangedPayload, CaptionVoteCastPayload } from '@/hooks/use-room-channel';
import { Player } from '@/types/player';
import Ably from 'ably';
import { PlayerAvatar } from '@/components/game/player-avatar';
import { CAPTION_VOTING_DURATION } from '@/lib/constants';
import { soundManager } from '@/lib/sound';

type Caption = {
  id: string;
  text_content: string;
  player_id: string;
  round_id: string;
  position_x: number;
  position_y: number;
  memeUrl?: string; // The URL of the meme this caption is for
  playerName?: string; // The name of the player who submitted this caption
};

export default function CaptionVotingPage() {
  const params = useParams();
  const roomCode = params.roomCode as string;
  const router = useRouter();
  const { toast } = useToast();

  // State to show a loader while waiting for all captions to be submitted.
  const [isWaiting, setIsWaiting] = useState(true);
  const [roomInfo, setRoomInfo] = useState<{ id: string; current_round_number: number } | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [roundId, setRoundId] = useState<string | null>(null);
  // Tracks which players have voted to update the UI and determine when everyone has voted.
  const [votedPlayerIds, setVotedPlayerIds] = useState<Set<string>>(new Set());
  // Tracks if the current user has voted to disable the voting UI.
  const [hasVoted, setHasVoted] = useState<string | null>(null);
  // Ref to prevent the tallying function from being called multiple times.
  const hasTallied = useRef(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // State to track the user's selected caption before they confirm the vote.
  const [selectedCaptionId, setSelectedCaptionId] = useState<string | null>(null);

  // Establishes a real-time connection to the room's channel via Ably.
  const roomChannel = useRoomChannel(roomCode);

  // Step 1: Fetch initial room and player data.
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Get the user's ID to identify their own captions later.
        const { data: { user } } = await supabase.auth.getUser();
        if (user) setCurrentUserId(user.id);
        
        // Get room info from the room code.
        const { data: roomData, error: roomError } = await supabase
          .from('rooms')
          .select('id, current_round_number')
          .eq('room_code', roomCode)
          .single();
          
        if (roomError || !roomData) {
          toast({ title: "Error finding room", description: "This room doesn't seem to exist.", variant: "destructive" });
          router.push('/');
          return;
        }
        
        setRoomInfo(roomData);
        
        // Get the current round ID.
        const { data: roundData, error: roundError } = await supabase
          .from('rounds')
          .select('id')
          .eq('room_id', roomData.id)
          .eq('round_number', roomData.current_round_number)
          .single();
          
        if (roundError || !roundData) {
          toast({ title: "Error finding round", description: "Could not find the current round.", variant: "destructive" });
          router.push(`/room/${roomCode}`);
          return;
        }
        
        setRoundId(roundData.id);
        
        // Get all players in the room.
        const { data: playerData, error: playerError } = await supabase
          .from('players')
          .select('*')
          .eq('room_id', roomData.id);
          
        if (playerError) {
          toast({ title: "Error loading players", description: playerError.message, variant: "destructive" });
        } else {
          setPlayers(playerData || []);
        }
      } catch (error: any) {
        console.error("Error in initial data fetch:", error);
        toast({ title: "Error", description: "Something went wrong loading the game.", variant: "destructive" });
      }
    };
    
    fetchInitialData();
  }, [roomCode, router, toast]);

  // Function to tally votes and end the round.
  const tallyVotesAndEndRound = useCallback(async () => {
    if (!roundId || hasTallied.current) return;
    
    // Set a flag to prevent multiple calls.
    hasTallied.current = true;
    
    try {
      // This RPC tallies the votes, awards points, and updates the room status.
      const { data, error } = await supabase.rpc('tally_caption_votes_and_finalize_round', {
        p_round_id: roundId
      });
      
      if (error) throw error;
      
      // Broadcast phase change so all clients navigate.
      try {
        await roomChannel.publish<GamePhaseChangedPayload>(RoomEvent.GAME_PHASE_CHANGED, { phase: 'round-results' });
      } catch (pubErr) {
        console.warn('Unable to publish phase change via Ably:', pubErr);
      }

      // Navigate immediately as a fallback (in case Ably publish fails or we are the only client)
      router.push(`/room/${roomCode}/round-results`);
      
    } catch (error: any) {
      console.error("Error tallying votes:", error);
      toast({ title: "Error", description: "Could not finalize the round.", variant: "destructive" });
      hasTallied.current = false; // Reset flag to allow retry.
    }
  }, [roundId, toast, roomChannel, router, roomCode]);

  useEffect(() => {
    // This effect handles the "waiting" phase. It polls the DB to check if all players have submitted captions.
    if (!roundId || players.length === 0 || !isWaiting) return;

    const totalPlayers = players.length;

    const intervalId = setInterval(async () => {
      const { error, count } = await supabase
        .from('captions')
        .select('*', { count: 'exact', head: true })
        .eq('round_id', roundId);
      
      if (error) {
        console.error("Polling for captions failed:", error);
        clearInterval(intervalId);
        return;
      }

      // Once all captions are in, fetch them and switch to the voting view.
      if (count !== null && count >= totalPlayers) {
        clearInterval(intervalId);
        
        // Get captions with player info and meme URLs
        const { data: captionsData, error: captionsError } = await supabase
          .from('captions')
          .select(`
            id, 
            text_content, 
            player_id, 
            round_id,
            position_x,
            position_y,
            players:player_id (username)
          `)
          .eq('round_id', roundId);
          
        if (captionsError) {
          toast({ title: 'Error fetching captions', variant: 'destructive' });
          return;
        }
        
        // Get meme URLs for each player's selected meme
        const enhancedCaptions = await Promise.all((captionsData || []).map(async (caption) => {
          const { data: memeData, error: memeError } = await supabase
            .from('player_round_memes')
            .select(`
              memes:meme_id (image_url)
            `)
            .eq('round_id', roundId)
            .eq('player_id', caption.player_id)
            .single();

          // Safely extract username (handles array or object)
          let playerName: string | undefined;
          if (Array.isArray((caption as any).players)) {
            playerName = (caption as any).players[0]?.username;
          } else if ((caption as any).players) {
            playerName = (caption as any).players.username;
          }

          // Safely extract meme URL (handles array or object)
          let memeUrl: string | undefined;
          if (!memeError && memeData) {
            const memesField: any = (memeData as any).memes;
            memeUrl = Array.isArray(memesField) ? memesField[0]?.image_url : memesField?.image_url;
          }

          return {
            ...caption,
            playerName: playerName || 'Unknown Player',
            memeUrl,
          };
        }));
        
        setCaptions(enhancedCaptions || []);
        setIsWaiting(false);
      }
    }, 2500);

    return () => clearInterval(intervalId);
  }, [roundId, players, isWaiting, toast]);

  useEffect(() => {
    // Sets up Ably subscriptions for real-time events.
    if (!roomChannel.isReady || !currentUserId) return;
    
    // Handles vote events from other players to update the UI.
    const handleVoteCast = (data: CaptionVoteCastPayload, message: Ably.Message) => {
      if (message.clientId === currentUserId) return; // Ignore our own vote event
      setVotedPlayerIds(prev => new Set(prev).add(data.voterPlayerId));
    };
    
    // Handles the signal to navigate to the next phase of the game.
    const handlePhaseChange = (data: GamePhaseChangedPayload) => {
      if (data.phase === 'round-results') {
        router.push(`/room/${roomCode}/round-results`);
      }
    };
    
    const unsubVote = roomChannel.subscribe<CaptionVoteCastPayload>(RoomEvent.CAPTION_VOTE_CAST, handleVoteCast);
    const unsubPhaseChange = roomChannel.subscribe<GamePhaseChangedPayload>(RoomEvent.GAME_PHASE_CHANGED, handlePhaseChange);
    
    return () => {
      unsubVote();
      unsubPhaseChange();
    };
  }, [roomChannel.isReady, router, roomCode, currentUserId]);

  useEffect(() => {
    // Checks if all players have voted. If so, end the round.
    if (isWaiting || players.length === 0) return;
    if (votedPlayerIds.size >= players.length) {
      tallyVotesAndEndRound();
    }
  }, [isWaiting, players.length, votedPlayerIds, tallyVotesAndEndRound]);
  
  // Stores the ID of the caption the user clicks on.
  const handleSelectCaption = (caption: Caption) => {
    // Can't vote for self or change vote.
    if (hasVoted || caption.player_id === currentUserId) return;
    
    // Play settings click sound (buttonClick3) for caption selection
    if (soundManager) {
      soundManager.playSettingsClick();
    }
    
    setSelectedCaptionId(caption.id);
  };

  // Confirms the selected caption as the user's final vote.
  const handleConfirmVote = async () => {
    if (!selectedCaptionId || hasVoted || !currentUserId || !roundId) return;
    
    // Play button click sound
    if (soundManager) {
      soundManager.playButtonClick();
    }
    
    const caption = captions.find(c => c.id === selectedCaptionId);
    if (!caption) return;
    
    // Mark as voted locally (disables UI)
    setHasVoted(caption.id);

    try {
      // 1. Persist vote in DB
      const { error } = await supabase.rpc('submit_caption_vote', { p_caption_id: caption.id });
      if (error) throw error;

      // 2. Now that the vote is stored, update local voted list
      setVotedPlayerIds(prev => new Set(prev).add(currentUserId));

      // 3. Broadcast to other clients
      await roomChannel.publish<CaptionVoteCastPayload>(RoomEvent.CAPTION_VOTE_CAST, {
        voterPlayerId: currentUserId,
        votedForCaptionId: caption.id,
      });

      toast({
        title: 'Vote Cast!',
        description: 'Your vote has been recorded.',
        className: 'bg-card border-primary text-card-foreground',
      });
    } catch (error: any) {
      console.error('Error casting vote:', error);
      toast({ title: 'Vote Failed', description: error.message, variant: 'destructive' });

      // Roll back voted state
      setHasVoted(null);
    }
  };

  // Display a loading spinner while waiting for captions.
  if (isWaiting) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-16 w-16 text-primary animate-spin mb-4" />
        <h1 className="font-headline text-3xl text-primary">Waiting for Captions</h1>
        <p className="text-muted-foreground mt-2">Waiting for all players to submit their masterpieces...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Header Section */}
      <div className="text-center mb-8">
        <h1 className="font-headline text-5xl text-primary title-jackbox mb-2">Vote for the Gold Medal Caption!</h1>
        <p className="text-muted-foreground text-lg mb-6">You have {CAPTION_VOTING_DURATION} seconds to crown a champion. Choose wisely, judge!</p>
        
        {/* Timer Bar - No box around it */}
        <div className="max-w-3xl mx-auto mb-8">
          <TimerBar durationSeconds={CAPTION_VOTING_DURATION} onTimeUp={tallyVotesAndEndRound} />
        </div>
      </div>

      {/* Voting Status - More compact design */}
      <div className="bg-background/60 backdrop-blur-sm rounded-xl p-4 mb-8 max-w-2xl mx-auto border border-border/50 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Vote className="h-6 w-6 text-accent mr-2" />
            <h2 className="font-headline text-xl text-primary">
              <span className="text-accent font-bold">{votedPlayerIds.size}</span> out of <span className="text-accent font-bold">{players.length}</span> players have voted
            </h2>
          </div>
          <div className="flex space-x-1">
            {players.map(p => (
              <PlayerAvatar 
                key={p.id}
                name={p.username}
                avatarUrl={p.avatar_src ?? undefined}
                isReady={votedPlayerIds.has(p.id)}
                size="sm"
                compact={true}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Captions Grid - More prominent cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
        {captions.map((caption, index) => {
          const isOwnCaption = caption.player_id === currentUserId;
          const isSelected = selectedCaptionId === caption.id;
          return (
            <div
              key={caption.id}
              onClick={() => handleSelectCaption(caption)}
              className={`transform transition-all duration-300 ${isSelected ? 'scale-105' : ''} ${isOwnCaption ? 'opacity-70' : 'hover:scale-102'}`}
            >
              <CaptionCard
                captionText={caption.text_content}
                captionNumber={index + 1}
                isVoted={isSelected}
                memeImageUrl={caption.memeUrl}
                positionX={caption.position_x}
                positionY={caption.position_y}
                showOverlay={true}
                className={`shadow-xl transition-all duration-200 ${
                  isOwnCaption 
                    ? "border-primary/50 bg-primary/5 cursor-not-allowed" 
                    : isSelected
                      ? "border-accent border-4 shadow-accent/30"
                      : "cursor-pointer hover:border-accent/70 border-2"
                }`}
              />
              <div className="mt-3 text-center">
                <span className={`font-medium text-lg px-4 py-1 rounded-full ${isOwnCaption ? 'bg-primary/20 text-primary' : 'bg-background/80 text-foreground'}`}>
                  {isOwnCaption ? '✏️ Your Caption' : caption.playerName || "Player"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Vote Button - More prominent */}
      {!hasVoted && (
        <div className="flex justify-center mb-8">
          <Button 
            size="lg" 
            onClick={handleConfirmVote} 
            disabled={!selectedCaptionId || !!hasVoted}
            className="font-bold text-xl bg-accent hover:bg-accent/80 text-accent-foreground btn-jackbox min-w-[300px] h-16 shadow-xl transform hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ThumbsUp className="mr-3 h-7 w-7" />
            Lock In Your Vote
          </Button>
        </div>
      )}

      {/* Vote Confirmation - More visually appealing */}
      {hasVoted && (
        <div className="flex justify-center mb-8">
          <div className="bg-gradient-to-r from-accent/20 to-primary/20 backdrop-blur-sm rounded-xl p-6 text-center border border-accent/30 shadow-lg animate-pulse">
            <h3 className="font-headline text-2xl text-primary flex items-center justify-center">
              <CheckCircle className="mr-3 h-8 w-8 text-green-500"/>
              Vote Locked In!
            </h3>
            <p className="text-muted-foreground mt-2">Waiting for the other players to cast their votes...</p>
          </div>
        </div>
      )}
    </div>
  );
}