"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { TimerBar } from '@/components/game/timer-bar';
import { MemeCard } from '@/components/game/meme-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ThumbsUp, Vote, CheckCircle, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabase';
import { useRoomChannel, RoomEvent, MemeVoteCastPayload, GamePhaseChangedPayload } from '@/hooks/use-room-channel';
import { Player } from '@/types/player'; // Assuming a shared player type exists

// Defines the structure for a meme candidate, joining info from memes and players tables.
type MemeCandidate = {
  id: string; // meme_candidate_id
  meme_id: string;
  image_url: string;
  name: string;
  submitted_by_player_id: string;
  submitter_name: string;
};

/**
 * MemeVotingPage Component
 * 
 * This page orchestrates the meme voting phase of the game. It handles:
 * 1. Waiting for all players to submit their meme proposals.
 * 2. Fetching the proposed memes (candidates) from the database.
 * 3. Allowing users to cast one vote for a meme (but not their own).
 * 4. Displaying live vote counts using Ably for real-time updates.
 * 5. Triggering the end-of-round tallying process when the timer expires or all votes are in.
 * 6. Listening for the final "phase change" event to navigate all players simultaneously.
 */
export default function MemeVotingPage() {
  const params = useParams();
  const roomCode = params.roomCode as string;
  const router = useRouter();
  const { toast } = useToast();

  // UI state: true while waiting for all meme submissions to be registered.
  const [isWaiting, setIsWaiting] = useState(true);
  // State for the room's core details from the DB.
  const [roomInfo, setRoomInfo] = useState<{ id: string; current_round_number: number } | null>(null);
  // State for all players in the room.
  const [players, setPlayers] = useState<Player[]>([]);
  // State for the list of meme candidates to vote on.
  const [candidates, setCandidates] = useState<MemeCandidate[]>([]);
  // State to track live vote counts for each meme candidate.
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});
  // State to track if the current user has voted (stores the ID of the voted meme).
  const [hasVoted, setHasVoted] = useState<string | null>(null);
  // Ref to prevent the tallying function from being called multiple times by the same client.
  // Using a ref avoids re-renders that can interfere with the async flow.
  const hasTallied = useRef(false);
  // State for the current authenticated user's ID.
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const roomChannel = useRoomChannel(roomCode);

  // Memoized calculation of the total votes cast so far.
  const totalVotes = useMemo(() => Object.values(voteCounts).reduce((sum, count) => sum + count, 0), [voteCounts]);

  // Step 1: Fetch initial static data (room, user) on component load.
  useEffect(() => {
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

  // Step 2: Poll for meme candidates AND the player list until everyone has submitted.
  // This smarter polling prevents race conditions if players join late.
  useEffect(() => {
    if (!roomInfo) return;

    // Start an interval to check for submissions and the latest player count.
    const intervalId = setInterval(async () => {
      // Fetch the latest player list on each poll
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomInfo.id);

      if (playersError) {
        console.error("Error polling for players:", playersError);
        return;
      }
      const currentPlayers = playersData || [];

      // RPC call to fetch the list of candidates for the current round.
      const { data: candidatesData, error: candidatesError } = await supabase.rpc('get_meme_candidates_for_round', {
          p_room_id: roomInfo.id,
          p_round_number: roomInfo.current_round_number
      });

      if (candidatesError) {
          console.error("Error polling for candidates:", candidatesError);
          return;
      }
      const currentCandidates = candidatesData || [];

      // Once the number of candidates matches the number of players, we are synced and ready.
      if (currentPlayers.length > 0 && currentCandidates.length >= currentPlayers.length) {
        setPlayers(currentPlayers);
        setCandidates(currentCandidates);
        setIsWaiting(false); // This will trigger the UI to show the voting grid.
        clearInterval(intervalId);
      }
    }, 3000); // Poll every 3 seconds

    // Cleanup the interval when the component unmounts.
    return () => clearInterval(intervalId);
  }, [roomInfo]);
  
  /**
   * Called when voting ends (either by timer or all votes in).
   * This function tells the backend to tally votes and create the official round.
   * The client that calls this becomes the "leader" for this action.
   */
  const tallyVotesAndEndRound = useCallback(async () => {
    // Use the ref to ensure this client only tries to tally once.
    if (hasTallied.current || !roomInfo) return;
    hasTallied.current = true;

    toast({ title: 'Voting ended!', description: 'Tallying the results...' });

    try {
        // This RPC handles the core logic of finding the winning meme and creating the round.
        const { error } = await supabase.rpc('tally_votes_and_create_round', {
            p_room_id: roomInfo.id,
            p_round_number: roomInfo.current_round_number,
        });

        if (error) throw error;
        
        // Broadcast the event to all clients to trigger navigation.
        await roomChannel.publish<GamePhaseChangedPayload>(RoomEvent.GAME_PHASE_CHANGED, {
            phase: 'caption-entry'
        });

        // The phase change listener will handle navigation for this client as well.

    } catch (error: any) {
        // This specific error code (23505) indicates a unique constraint violation.
        // It's an expected race condition if another client calls this first. We can safely ignore it.
        if (error.code === '23505') {
            // Do nothing further; just wait for the GAME_PHASE_CHANGED event from the leader.
        } else {
            // For any other unexpected error, log it and notify the user.
            console.error('Error tallying votes:', error);
            toast({ title: "Error tallying votes", description: error.message, variant: 'destructive' });
            hasTallied.current = false; // Allow retry for other, unexpected errors.
        }
    }
  }, [roomInfo, roomChannel, toast]);
  
  // This useEffect handles all real-time events and game logic progression.
  useEffect(() => {
    if (!roomChannel.isReady || isWaiting) return;
    
    // Check if all votes are in. This runs every time the vote count changes.
    if (players.length > 0 && totalVotes >= players.length) {
      tallyVotesAndEndRound();
    }
    
    const handleVoteCast = (data: MemeVoteCastPayload) => {
        setVoteCounts(prev => ({
            ...prev,
            [data.memeCandidateId]: (prev[data.memeCandidateId] || 0) + 1
        }));
    };

    const handlePhaseChange = (data: GamePhaseChangedPayload) => {
        if (data.phase === 'caption-entry') {
            // The "leader" client who called the tally RPC will also get this event.
            // All clients navigate at the same time.
            router.push(`/room/${roomCode}/caption-entry`);
        }
    };

    const unsubVote = roomChannel.subscribe<MemeVoteCastPayload>(RoomEvent.MEME_VOTE_CAST, handleVoteCast);
    const unsubPhaseChange = roomChannel.subscribe<GamePhaseChangedPayload>(RoomEvent.GAME_PHASE_CHANGED, handlePhaseChange);

    return () => {
        unsubVote();
        unsubPhaseChange();
    };
  }, [roomChannel.isReady, isWaiting, players, totalVotes, tallyVotesAndEndRound, router, roomCode]);

  
  /**
   * Handles the user clicking the "Vote" button on a meme.
   * @param candidate The meme candidate object being voted for.
   */
  const handleVote = async (candidate: MemeCandidate) => {
    // Prevent voting if already voted, not authenticated, or no room info.
    if (hasVoted || !currentUserId || !roomInfo) return;
    // Prevent a player from voting for their own submission.
    if (candidate.submitted_by_player_id === currentUserId) {
        toast({ title: "Can't vote for your own meme!", variant: 'destructive' });
        return;
    }
    
    // Immediately update the UI to show the vote has been cast.
    setHasVoted(candidate.id);

    try {
        // Call the database function to securely record the vote.
        const { error } = await supabase.rpc('vote_for_meme_candidate', {
            p_meme_candidate_id: candidate.id
        });
        if (error) throw error;

        // On success, publish the event to all other clients via Ably.
        await roomChannel.publish<MemeVoteCastPayload>(RoomEvent.MEME_VOTE_CAST, {
            memeCandidateId: candidate.id
        });
    } catch (error: any) {
        console.error("Error casting vote:", error);
        toast({ title: 'Vote Failed', description: error.message, variant: 'destructive' });
        setHasVoted(null); // On failure, reset state to allow user to try again.
    }
  };

  // UI state for when we are waiting for all meme proposals.
  if (isWaiting || !roomInfo) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
          <Loader2 className="h-16 w-16 text-primary animate-spin mb-4" />
          <h1 className="font-headline text-3xl text-primary">Waiting for Submissions</h1>
          <p className="text-muted-foreground mt-2">Waiting for all players to propose a meme...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8">
      <Card className="shadow-xl card-jackbox border-2 border-primary/70">
        <CardHeader className="text-center">
          <CardTitle className="font-headline text-4xl text-primary title-jackbox">Vote for a Meme</CardTitle>
          <CardDescription>Choose the meme you want to caption. You have 30 seconds!</CardDescription>
        </CardHeader>
        <CardContent>
          {/* The timer bar that triggers the end of the voting phase. */}
          <TimerBar durationSeconds={30} onTimeUp={tallyVotesAndEndRound} className="mb-6" />

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {candidates.map(candidate => (
              <div key={candidate.id} className="relative group">
                <MemeCard
                  memeUrl={candidate.image_url}
                  altText={`Meme by ${candidate.submitter_name}`}
                  isSelected={hasVoted === candidate.id}
                  className="w-full"
                >
                  <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <Button
                      variant={hasVoted === candidate.id ? "default" : "secondary"}
                      onClick={() => handleVote(candidate)}
                      disabled={!!hasVoted || candidate.submitted_by_player_id === currentUserId}
                      className="w-3/4 font-semibold"
                    >
                      <ThumbsUp className="mr-2 h-5 w-5" />
                      {hasVoted === candidate.id ? "Voted!" : candidate.submitted_by_player_id === currentUserId ? "Your Meme" : "Vote"}
                    </Button>
                  </div>
                </MemeCard>
                <div className="flex justify-between items-center mt-2">
                    <p className="text-sm text-muted-foreground">By: {candidate.submitter_name}</p>
                    {/* Live vote count display */}
                    <div className="flex items-center gap-1 text-primary font-bold">
                        <ThumbsUp className="h-5 w-5" />
                        <span>{voteCounts[candidate.id] || 0}</span>
                    </div>
                </div>
                 {/* Visual indicator for the user's own vote. */}
                 {hasVoted === candidate.id && (
                  <div className="absolute top-2 right-2 bg-accent text-accent-foreground p-2 rounded-full shadow-lg">
                    <CheckCircle className="h-6 w-6" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Shows a message after the user has voted, while waiting for others. */}
          {hasVoted && (
            <div className="mt-8 text-center">
              <Button size="lg" disabled className="font-bold text-lg bg-primary hover:bg-primary/90">
                Waiting for others to vote... <Vote className="ml-2 h-5 w-5 animate-pulse"/>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}