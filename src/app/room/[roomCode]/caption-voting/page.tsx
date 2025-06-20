/**
 * CaptionVotingPage Component
 *
 * This component manages the caption voting phase of the game. It displays the
 * round's meme and the captions submitted by players. Players vote for their
 * favorite caption within a time limit.
 *
 * Core Logic:
 * 1.  Initialization: Fetches room, player, and current round data.
 * 2.  Waiting Phase: Polls the database until all players have submitted captions.
 * 3.  Voting Phase:
 *     - Displays the meme and all submitted captions.
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ThumbsUp, Vote, CheckCircle, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabase';
import { useRoomChannel, RoomEvent, GamePhaseChangedPayload, CaptionVoteCastPayload } from '@/hooks/use-room-channel';
import { Player } from '@/types/player';
import Ably from 'ably';
import { PlayerAvatar } from '@/components/game/player-avatar';
import { CAPTION_VOTING_DURATION } from '@/lib/constants';

type Caption = {
  id: string;
  text_content: string;
  player_id: string;
  round_id: string;
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
  const [memeUrl, setMemeUrl] = useState<string>('');
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

  useEffect(() => {
    // Fetches the current user and room information on component mount.
    const initialize = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
          toast({ title: 'Not authenticated!', variant: 'destructive' });
          router.push('/');
          return;
      }
      setCurrentUserId(user.id);

      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('id, current_round_number')
        .eq('room_code', roomCode)
        .single();
      
      if (roomError || !roomData) {
        toast({ title: 'Error fetching room data', variant: 'destructive' });
        return;
      }
      setRoomInfo(roomData);
    };
    initialize();
  }, [roomCode, router, toast]);

  useEffect(() => {
    if (!roomInfo) return;
    
    // Fetches details for the current round (meme, etc.) and the list of players in the room.
    const fetchRoundAndPlayers = async () => {
      try {
        const { data: roundInfo, error: roundInfoError } = await supabase.rpc('get_current_round_info', { p_room_id: roomInfo.id });
        const currentRound = Array.isArray(roundInfo) ? roundInfo[0] : roundInfo;
        
        if (roundInfoError || !currentRound) throw new Error("Couldn't load the current round.");
        
        setRoundId(currentRound.round_id);
        setMemeUrl(currentRound.meme_image_url);
        
        const { data: playersData, error: playersError } = await supabase.from('players').select('*').eq('room_id', roomInfo.id);
        if (playersError || !playersData) throw new Error("Couldn't fetch players.");
        
        setPlayers(playersData);
        
      } catch (error: any) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      }
    };
    
    fetchRoundAndPlayers();
  }, [roomInfo, toast]);

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
        const { data: finalCaptions, error: finalCaptionsError } = await supabase
          .from('captions')
          .select('*')
          .eq('round_id', roundId);
        
        if (finalCaptionsError) {
          toast({ title: 'Error fetching captions', variant: 'destructive' });
        } else {
          setCaptions(finalCaptions || []);
        }
        setIsWaiting(false);
      }
    }, 2500);

    return () => clearInterval(intervalId);
  }, [roundId, players, isWaiting, toast]);

  // This function is called when the timer runs out or all players have voted.
  const tallyVotesAndEndRound = useCallback(async () => {
    // Use a ref to ensure this is only called once per client.
    if (hasTallied.current || !roundId) return;
    hasTallied.current = true;
    
    toast({ title: 'Voting ended!', description: 'Tallying the results...' });
    
    try {
      // This RPC now includes a server-side check. It only tallies if all votes are in the DB.
      // It returns `true` if it successfully finalized the round, `false` otherwise.
      const { data: finalized, error } = await supabase.rpc('tally_caption_votes_and_finalize_round', { p_round_id: roundId });
      
      if (error) throw error;
      
      // Only the client that successfully triggers the finalization will publish the event.
      if (finalized) {
        await roomChannel.publish<GamePhaseChangedPayload>(RoomEvent.GAME_PHASE_CHANGED, { phase: 'round-results' });
      } else {
        // This can happen if this client's trigger was premature. 
        // Resetting the ref allows this client to potentially try again if needed.
        hasTallied.current = false;
      }
    } catch (error: any) {
      if (error.code !== '23505') { // Ignore unique violation errors, which can happen in race conditions.
        console.error('Error tallying votes:', error);
        toast({ title: "Error tallying votes", description: error.message, variant: 'destructive' });
        hasTallied.current = false; // Reset if there was a real error.
      }
    }
  }, [roundId, roomChannel, toast]);

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
    setSelectedCaptionId(caption.id);
  };

  // Confirms the selected caption as the user's final vote.
  const handleConfirmVote = async () => {
    if (!selectedCaptionId || hasVoted || !currentUserId || !roundId) return;
    
    const caption = captions.find(c => c.id === selectedCaptionId);
    if (!caption) return;
    
    // Optimistically update the UI to show the vote has been cast.
    setHasVoted(caption.id);
    setVotedPlayerIds(prev => new Set(prev).add(currentUserId));
    
    try {
      // Call the server function to securely record the vote.
      const { error } = await supabase.rpc('submit_caption_vote', { p_caption_id: caption.id });
      if (error) throw error;
      
      // Announce the vote to other clients via Ably.
      await roomChannel.publish<CaptionVoteCastPayload>(RoomEvent.CAPTION_VOTE_CAST, {
        voterPlayerId: currentUserId,
        votedForCaptionId: caption.id
      });
      
      toast({
        title: 'Vote Cast!',
        description: 'Your vote has been recorded.',
        className: 'bg-card border-primary text-card-foreground',
      });
    } catch (error: any) {
      console.error("Error casting vote:", error);
      toast({ title: 'Vote Failed', description: error.message, variant: 'destructive' });
      
      // Revert the optimistic UI update if the vote failed.
      setHasVoted(null);
      setVotedPlayerIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(currentUserId!);
        return newSet;
      });
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Column: Meme and Game Info */}
        <div className="lg:col-span-1 space-y-6 lg:sticky top-24">
          <Card className="shadow-xl card-jackbox border-2 border-primary/70 overflow-hidden">
            <CardHeader className="text-center pb-2">
              <CardTitle className="font-headline text-3xl text-primary title-jackbox">The Meme</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg overflow-hidden shadow-lg border border-border">
                <img
                  src={memeUrl}
                  alt="Meme to be captioned"
                  className="w-full max-h-[400px] object-contain bg-black"
                />
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-xl card-jackbox border-2 border-primary/70">
            <CardHeader>
              <CardTitle className="font-headline text-2xl text-primary title-jackbox flex items-center">
                <Vote className="mr-3 h-6 w-6"/>
                Voting Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg text-center">
                <span className="font-bold text-accent">{votedPlayerIds.size}</span> out of <span className="font-bold text-accent">{players.length}</span> players have voted.
              </p>
              <div className="mt-4 flex justify-center space-x-2">
                {players.map(p => (
                  <PlayerAvatar 
                    key={p.id}
                    name={p.username}
                    avatarUrl={p.avatar_src ?? undefined}
                    isReady={votedPlayerIds.has(p.id)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Title, Timer, Captions, and Actions */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-xl card-jackbox border-2 border-primary/70 text-center">
            <CardHeader>
              <CardTitle className="font-headline text-4xl text-primary title-jackbox">Vote for the Best Caption!</CardTitle>
              <CardDescription>
                You have {CAPTION_VOTING_DURATION} seconds to pick your favorite. Choose wisely!
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TimerBar durationSeconds={CAPTION_VOTING_DURATION} onTimeUp={tallyVotesAndEndRound} />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {captions.map((caption, index) => {
              const isOwnCaption = caption.player_id === currentUserId;
              return (
                <div
                  key={caption.id}
                  className="h-full"
                  onClick={() => handleSelectCaption(caption)}
                >
                  <CaptionCard
                    captionText={caption.text_content}
                    captionNumber={index + 1}
                    isVoted={selectedCaptionId === caption.id}
                    className={`transition-all duration-200 ${isOwnCaption ? "border-primary/50 bg-primary/5 cursor-not-allowed opacity-70" : "cursor-pointer hover:scale-105 hover:border-accent"}`}
                  />
                </div>
              );
            })}
          </div>

          {!hasVoted && (
            <div className="pt-4 flex justify-center">
              <Button 
                size="lg" 
                onClick={handleConfirmVote} 
                disabled={!selectedCaptionId || !!hasVoted}
                className="font-bold text-lg bg-accent hover:bg-accent/80 text-accent-foreground btn-jackbox min-w-[300px] h-16 shadow-lg transform hover:scale-105 transition-transform"
              >
                <ThumbsUp className="mr-3 h-7 w-7" />
                Lock In Your Vote
              </Button>
            </div>
          )}

          {hasVoted && (
            <div className="pt-4 text-center">
              <Card className="bg-background/80 p-6 inline-block">
                <h3 className="font-headline text-2xl text-primary flex items-center justify-center">
                  <CheckCircle className="mr-3 h-8 w-8 text-green-500"/>
                  Vote Locked In!
                </h3>
                <p className="text-muted-foreground mt-2">Waiting for the other players to cast their votes...</p>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}