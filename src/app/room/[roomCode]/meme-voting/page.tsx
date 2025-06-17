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
import { Player } from '@/types/player';
import Ably from 'ably';

type MemeCandidate = {
  id: string;
  meme_id: string;
  image_url: string;
  name: string;
  submitted_by_player_id: string;
  submitter_name: string;
};

export default function MemeVotingPage() {
  const params = useParams();
  const roomCode = params.roomCode as string;
  const router = useRouter();
  const { toast } = useToast();

  const [isWaiting, setIsWaiting] = useState(true);
  const [roomInfo, setRoomInfo] = useState<{ id: string; current_round_number: number } | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [candidates, setCandidates] = useState<MemeCandidate[]>([]);
  
  // A Set is used to automatically handle duplicate IDs and track who has voted.
  const [votedPlayerIds, setVotedPlayerIds] = useState<Set<string>>(new Set());
  
  // State to track if the current user has voted (disables their UI).
  const [hasVoted, setHasVoted] = useState<string | null>(null);
  const hasTallied = useRef(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const roomChannel = useRoomChannel(roomCode);

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
  useEffect(() => {
    if (!roomInfo) return;
    const intervalId = setInterval(async () => {
      const { data: playersData } = await supabase.from('players').select('*').eq('room_id', roomInfo.id);
      const { data: candidatesData } = await supabase.rpc('get_meme_candidates_for_round', {
          p_room_id: roomInfo.id,
          p_round_number: roomInfo.current_round_number
      });

      const currentPlayers = playersData || [];
      const currentCandidates = candidatesData || [];

      if (currentPlayers.length > 0 && currentCandidates.length >= currentPlayers.length) {
        setPlayers(currentPlayers);
        setCandidates(currentCandidates);
        setIsWaiting(false);
        clearInterval(intervalId);
      }
    }, 3000);

    return () => clearInterval(intervalId);
  }, [roomInfo]);
  
  // Called when voting ends. Triggers the backend to tally votes.
  const tallyVotesAndEndRound = useCallback(async () => {
    if (hasTallied.current || !roomInfo) return;
    hasTallied.current = true;
    toast({ title: 'Voting ended!', description: 'Tallying the results...' });
    try {
        const { error } = await supabase.rpc('tally_votes_and_create_round', {
            p_room_id: roomInfo.id,
            p_round_number: roomInfo.current_round_number,
        });
        if (error) throw error;
        await roomChannel.publish<GamePhaseChangedPayload>(RoomEvent.GAME_PHASE_CHANGED, { phase: 'caption-entry' });
    } catch (error: any) {
        if (error.code !== '23505') { // Ignore expected race condition
            console.error('Error tallying votes:', error);
            toast({ title: "Error tallying votes", description: error.message, variant: 'destructive' });
            hasTallied.current = false;
        }
    }
  }, [roomInfo, roomChannel, toast]);
  
  // This useEffect handles all real-time Ably event subscriptions.
  useEffect(() => {
    if (!roomChannel.isReady || isWaiting || !currentUserId) return;
    
    // NEW LOGIC: Implements echo cancellation.
    const handleVoteCast = (data: MemeVoteCastPayload, message: Ably.Types.Message) => {
        // If the message came from the current user, ignore it.
        // Their UI was already updated optimistically.
        if (message.clientId === currentUserId) {
            return;
        }
        // For all other users, update the list of who has voted.
        setVotedPlayerIds(prev => new Set(prev).add(data.voterPlayerId));
    };

    const handlePhaseChange = (data: GamePhaseChangedPayload) => {
        if (data.phase === 'caption-entry') {
            router.push(`/room/${roomCode}/caption-entry`);
        }
    };

    const unsubVote = roomChannel.subscribe<MemeVoteCastPayload>(RoomEvent.MEME_VOTE_CAST, handleVoteCast);
    const unsubPhaseChange = roomChannel.subscribe<GamePhaseChangedPayload>(RoomEvent.GAME_PHASE_CHANGED, handlePhaseChange);

    return () => {
        unsubVote();
        unsubPhaseChange();
    };
  }, [roomChannel.isReady, isWaiting, router, roomCode, currentUserId]);

  // This separate effect handles the game logic progression.
  useEffect(() => {
    if (isWaiting || players.length === 0) return;
    if (votedPlayerIds.size >= players.length) {
      tallyVotesAndEndRound();
    }
  }, [isWaiting, players.length, votedPlayerIds, tallyVotesAndEndRound]);
  
  // Handles the user clicking the "Vote" button.
  const handleVote = async (candidate: MemeCandidate) => {
    if (hasVoted || !currentUserId || !roomInfo) return;
    if (candidate.submitted_by_player_id === currentUserId) {
        toast({ title: "Can't vote for your own meme!", variant: 'destructive' });
        return;
    }
    
    // Lock the UI for the current user.
    setHasVoted(candidate.id);

    // **OPTIMISTIC UPDATE**: Immediately update the local state for instant feedback.
    setVotedPlayerIds(prev => new Set(prev).add(currentUserId));

    try {
        // Step 1: Tell the database about the vote.
        const { error } = await supabase.rpc('vote_for_meme_candidate', { p_meme_candidate_id: candidate.id });
        if (error) throw error;

        // Step 2: Publish the event so other clients can update their state.
        await roomChannel.publish<MemeVoteCastPayload>(RoomEvent.MEME_VOTE_CAST, {
            voterPlayerId: currentUserId,
            votedForCandidateId: candidate.id,
        });
    } catch (error: any) {
        console.error("Error casting vote:", error);
        toast({ title: 'Vote Failed', description: error.message, variant: 'destructive' });
        // **REVERT**: If the backend call fails, revert the optimistic updates.
        setHasVoted(null);
        setVotedPlayerIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(currentUserId);
            return newSet;
        });
    }
  };

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
          <CardDescription>
            {votedPlayerIds.size} / {players.length} players have voted. You have 30 seconds!
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                </div>
                 {hasVoted === candidate.id && (
                  <div className="absolute top-2 right-2 bg-accent text-accent-foreground p-2 rounded-full shadow-lg">
                    <CheckCircle className="h-6 w-6" />
                  </div>
                )}
              </div>
            ))}
          </div>

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