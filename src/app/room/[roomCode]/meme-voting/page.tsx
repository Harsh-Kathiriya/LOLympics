"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
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
  const [votedPlayerIds, setVotedPlayerIds] = useState<Set<string>>(new Set());
  const [hasVoted, setHasVoted] = useState<string | null>(null);
  const hasTallied = useRef(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // New state to track the currently selected candidate before confirming
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  const roomChannel = useRoomChannel(roomCode);

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
        if (error.code !== '23505') {
            console.error('Error tallying votes:', error);
            toast({ title: "Error tallying votes", description: error.message, variant: 'destructive' });
            hasTallied.current = false;
        }
    }
  }, [roomInfo, roomChannel, toast]);
  
  useEffect(() => {
    if (!roomChannel.isReady || isWaiting || !currentUserId) return;
    
    const handleVoteCast = (data: MemeVoteCastPayload, message: Ably.Message) => {
        if (message.clientId === currentUserId) return;
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

  useEffect(() => {
    if (isWaiting || players.length === 0) return;
    if (votedPlayerIds.size >= players.length) {
      tallyVotesAndEndRound();
    }
  }, [isWaiting, players.length, votedPlayerIds, tallyVotesAndEndRound]);
  
  // New handler for selecting a meme card
  const handleSelectCandidate = (candidate: MemeCandidate) => {
    if (hasVoted || candidate.submitted_by_player_id === currentUserId) {
      return; // Don't allow selection if already voted or it's their own
    }
    setSelectedCandidateId(candidate.id);
  };

  // Renamed from handleVote to handle confirming the vote
  const handleConfirmVote = async () => {
    if (!selectedCandidateId || hasVoted || !currentUserId || !roomInfo) return;
    
    const candidate = candidates.find(c => c.id === selectedCandidateId);
    if (!candidate) return;

    setHasVoted(candidate.id);
    setVotedPlayerIds(prev => new Set(prev).add(currentUserId));

    try {
        const { error } = await supabase.rpc('vote_for_meme_candidate', { p_meme_candidate_id: candidate.id });
        if (error) throw error;

        await roomChannel.publish<MemeVoteCastPayload>(RoomEvent.MEME_VOTE_CAST, {
            voterPlayerId: currentUserId,
            votedForCandidateId: candidate.id,
        });
        toast({ title: 'Vote Cast!', description: 'Your choice is locked in.', className: 'bg-card border-primary text-card-foreground' });
    } catch (error: any) {
        console.error("Error casting vote:", error);
        toast({ title: 'Vote Failed', description: error.message, variant: 'destructive' });
        setHasVoted(null);
        setVotedPlayerIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(currentUserId!);
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
            {candidates.map(candidate => {
              const isOwnMeme = candidate.submitted_by_player_id === currentUserId;
              return (
                <div key={candidate.id} className="relative group">
                  <MemeCard
                    memeUrl={candidate.image_url}
                    altText={`Meme by ${candidate.submitter_name}`}
                    isSelected={selectedCandidateId === candidate.id}
                    onClick={() => handleSelectCandidate(candidate)}
                    className={isOwnMeme ? 'opacity-60 cursor-not-allowed' : ''}
                  />
                  <div className="flex justify-between items-center mt-2">
                      <p className="text-sm text-muted-foreground">By: {candidate.submitter_name}</p>
                      {isOwnMeme && (
                        <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-full">Your Meme</span>
                      )}
                  </div>
                </div>
              )
            })}
          </div>

          {!hasVoted && (
            <div className="mt-8 flex justify-center">
                <Button 
                  size="lg" 
                  onClick={handleConfirmVote} 
                  disabled={!selectedCandidateId || !!hasVoted}
                  className="font-bold text-lg bg-accent hover:bg-accent/80 text-accent-foreground btn-jackbox min-w-[250px] h-14"
                >
                  <ThumbsUp className="mr-2 h-6 w-6" />
                  Confirm Vote
                </Button>
            </div>
          )}

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