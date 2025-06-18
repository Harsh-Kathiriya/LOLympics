// FILE: /Users/harshkathiriya/Downloads/captionking-master/src/app/room/[roomCode]/caption-voting/page.tsx
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

// Define the structure of a caption with its metadata
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

  // State management
  const [isWaiting, setIsWaiting] = useState(true); // Waiting for all captions to be submitted
  const [roomInfo, setRoomInfo] = useState<{ id: string; current_round_number: number } | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [memeUrl, setMemeUrl] = useState<string>('');
  const [roundId, setRoundId] = useState<string | null>(null);
  
  // Track who has voted using a Set for automatic deduplication
  const [votedPlayerIds, setVotedPlayerIds] = useState<Set<string>>(new Set());
  
  // Track the current user's vote
  const [hasVoted, setHasVoted] = useState<string | null>(null);
  const hasTallied = useRef(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const roomChannel = useRoomChannel(roomCode);

  // Step 1: Fetch initial data (user, room) on component load
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

  // Step 2: Once we have room info, fetch the current round details and all players
  useEffect(() => {
    if (!roomInfo) return;
    
    const fetchRoundAndPlayers = async () => {
      try {
        const { data: roundInfo, error: roundInfoError } = await supabase.rpc('get_current_round_info', { p_room_id: roomInfo.id });
        const currentRound = Array.isArray(roundInfo) ? roundInfo[0] : roundInfo;
        
        if (roundInfoError || !currentRound) {
          throw new Error("Couldn't load the current round.");
        }
        
        setRoundId(currentRound.round_id);
        setMemeUrl(currentRound.meme_image_url);
        
        const { data: playersData, error: playersError } = await supabase.from('players').select('*').eq('room_id', roomInfo.id);
        if (playersError || !playersData) {
            throw new Error("Couldn't fetch players.");
        }
        setPlayers(playersData);
        
      } catch (error: any) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      }
    };
    
    fetchRoundAndPlayers();
  }, [roomInfo, toast]);

  // Step 3 (THE FIX): Poll for captions only when we have the roundId and players list.
  useEffect(() => {
    if (!roundId || players.length === 0 || !isWaiting) return;

    const totalPlayers = players.length;

    const intervalId = setInterval(async () => {
      // Efficiently get just the count of captions for the round
      const { error, count } = await supabase
        .from('captions')
        .select('*', { count: 'exact', head: true })
        .eq('round_id', roundId);
      
      if (error) {
        console.error("Polling for captions failed:", error);
        clearInterval(intervalId);
        return;
      }

      // Once all players have submitted, fetch the full caption data and stop polling.
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
    }, 2500); // Check every 2.5 seconds

    return () => clearInterval(intervalId);
  }, [roundId, players, isWaiting, toast]);


  // Handle the end of voting by tallying votes and advancing to the next phase
  const tallyVotesAndEndRound = useCallback(async () => {
    if (hasTallied.current || !roundId) return;
    hasTallied.current = true;
    
    toast({ title: 'Voting ended!', description: 'Tallying the results...' });
    
    try {
      const { error } = await supabase.rpc('tally_caption_votes_and_finalize_round', { p_round_id: roundId });
      if (error) throw error;
      
      await roomChannel.publish<GamePhaseChangedPayload>(RoomEvent.GAME_PHASE_CHANGED, { phase: 'round-results' });
    } catch (error: any) {
      if (error.code !== '23505') { // Ignore expected race condition error
        console.error('Error tallying votes:', error);
        toast({ title: "Error tallying votes", description: error.message, variant: 'destructive' });
        hasTallied.current = false;
      }
    }
  }, [roundId, roomChannel, toast]);

  // Subscribe to real-time events
  useEffect(() => {
    if (!roomChannel.isReady || !currentUserId) return;
    
    const handleVoteCast = (data: CaptionVoteCastPayload, message: Ably.Message) => {
      if (message.clientId === currentUserId) return; // Ignore self-sent events
      setVotedPlayerIds(prev => new Set(prev).add(data.voterPlayerId));
    };
    
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

  // Check if all players have voted
  useEffect(() => {
    if (isWaiting || players.length === 0) return;
    if (votedPlayerIds.size >= players.length) {
      tallyVotesAndEndRound();
    }
  }, [isWaiting, players.length, votedPlayerIds, tallyVotesAndEndRound]);

  // Handle a user voting for a caption
  const handleVote = async (caption: Caption) => {
    if (hasVoted || !currentUserId || !roundId) return;
    
    if (caption.player_id === currentUserId) {
      toast({ title: "Can't vote for your own caption!", variant: 'destructive' });
      return;
    }
    
    setHasVoted(caption.id);
    setVotedPlayerIds(prev => new Set(prev).add(currentUserId));
    
    try {
      const { error } = await supabase.rpc('submit_caption_vote', { p_caption_id: caption.id });
      if (error) throw error;
      
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
      
      setHasVoted(null);
      setVotedPlayerIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(currentUserId!);
        return newSet;
      });
    }
  };

  // Show loading state while waiting for captions
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
    <div className="max-w-6xl mx-auto py-8">
      <Card className="shadow-xl card-jackbox border-2 border-primary/70">
        <CardHeader className="text-center">
          <CardTitle className="font-headline text-4xl text-primary title-jackbox">Vote for the Best Caption!</CardTitle>
          <CardDescription>
            {votedPlayerIds.size} / {players.length} players have voted. You have 45 seconds!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TimerBar durationSeconds={45} onTimeUp={tallyVotesAndEndRound} className="mb-6" />

          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            <div className="md:col-span-2 rounded-lg overflow-hidden shadow-lg border border-border sticky top-24 self-start">
              <img
                src={memeUrl}
                alt="Meme being captioned"
                className="w-full max-h-[400px] object-contain bg-black"
              />
            </div>

            <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {captions.map((caption, index) => {
                const isOwnCaption = caption.player_id === currentUserId;
                return (
                  <div key={caption.id} className="relative group h-full">
                    <CaptionCard
                      captionText={caption.text_content}
                      captionNumber={index + 1}
                      isVoted={hasVoted === caption.id}
                      className={isOwnCaption ? "border-primary/50 bg-primary/5 cursor-not-allowed" : "cursor-pointer"}
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded-lg">
                      <Button
                        variant={hasVoted === caption.id ? "default" : "secondary"}
                        onClick={() => handleVote(caption)}
                        disabled={!!hasVoted || isOwnCaption}
                        className="w-3/4 font-semibold shadow-lg btn-jackbox"
                      >
                        <ThumbsUp className="mr-2 h-5 w-5" />
                        {hasVoted === caption.id ? "Voted!" : isOwnCaption ? "Your Caption" : "Vote"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
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