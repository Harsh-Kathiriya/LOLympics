// FILE: /Users/harshkathiriya/Downloads/captionking-master/src/app/room/[roomCode]/round-results/page.tsx
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LeaderboardSnippet } from '@/components/game/leaderboard-snippet';
import { Award, ArrowRightCircle, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabase';
import { useRoomChannel, RoomEvent, GamePhaseChangedPayload } from '@/hooks/use-room-channel';

// Updated type to include tie information
type RoundResult = {
  memeUrl: string;
  winningCaption: {
    id: string;
    text: string;
    authorId: string;
    authorName: string;
    pointsAwarded: number;
  };
  players: {
    id: string;
    name: string;
    score: number;
    avatarUrl?: string;
  }[];
  currentRound: number;
  totalRounds: number;
  winnerCount: number; // How many players tied for the win
  winnerNames: string[] | null; // List of all winners' names, can be null
};

export default function RoundResultsPage() {
  const params = useParams();
  const roomCode = params.roomCode as string;
  const router = useRouter();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [results, setResults] = useState<RoundResult | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const isNavigating = useRef(false);
  
  const roomChannel = useRoomChannel(roomCode);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    // This function is now inside the effect to avoid useCallback dependencies.
    const fetchRoundResults = async () => {
      try {
        // Step 1: Get room and current round IDs
        const { data: roomData, error: roomError } = await supabase.from('rooms').select('id, current_round_number').eq('room_code', roomCode).single();
        if (roomError || !roomData) throw new Error("Could not find room");
        if (!roomId) setRoomId(roomData.id);
        
        const { data: roundData, error: roundError } = await supabase.from('rounds').select('id, winning_caption_id').eq('room_id', roomData.id).eq('round_number', roomData.current_round_number).single();
        if (roundError) throw new Error("Could not find current round data.");
        
        // If winner isn't set, server is still tallying. We'll retry.
        if (!roundData || !roundData.winning_caption_id) {
          throw new Error("Winner not yet determined. Retrying...");
        }

        // Step 2: Call the new single RPC to get all details
        const { data: resultsData, error: resultsError } = await supabase.rpc(
          'get_round_results_details',
          { p_round_id: roundData.id }
        );

        if (resultsError) throw resultsError;
        if (!resultsData) throw new Error("Failed to load round result details.");
        
        setResults(resultsData as RoundResult);
        setIsLoading(false);

      } catch (error: any) {
         // This is not a fatal error, just a temporary state, so no destructive toast.
        console.log(error.message);
      }
    };
    
    // Set up a polling interval that stops once data is loaded.
    if (isLoading) {
      fetchRoundResults(); // Initial call
      const intervalId = setInterval(fetchRoundResults, 2000);
      return () => clearInterval(intervalId);
    }
  }, [isLoading, roomCode, roomId]);

  const handleNext = useCallback(async () => {
    if (isNavigating.current || !results || !roomId) return;
    isNavigating.current = true;
    
    try {
      await supabase.rpc('advance_to_next_round', { p_room_id: roomId });
      
      const nextPhase = results.currentRound < results.totalRounds ? 'meme-selection' : 'final-results';
      await roomChannel.publish<GamePhaseChangedPayload>(RoomEvent.GAME_PHASE_CHANGED, { phase: nextPhase });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      isNavigating.current = false;
    }
  }, [results, roomId, roomChannel, toast]);

  useEffect(() => {
    if (isLoading || !results) return;
    
    const timer = setTimeout(() => handleNext(), 12000); // Increased to 12s to allow reading names
    return () => clearTimeout(timer);
  }, [isLoading, results, handleNext]);
  
  useEffect(() => {
    if (!roomChannel.isReady) return;
    
    const handlePhaseChange = (data: GamePhaseChangedPayload) => {
      if (data.phase === 'meme-selection') router.push(`/room/${roomCode}/meme-selection`);
      else if (data.phase === 'final-results') router.push(`/room/${roomCode}/final-results`);
    };
    
    const unsubPhase = roomChannel.subscribe<GamePhaseChangedPayload>(RoomEvent.GAME_PHASE_CHANGED, handlePhaseChange);
    return () => unsubPhase();
  }, [roomChannel.isReady, roomCode, router]);

  const renderWinnerInfo = () => {
    if (!results || !results.winningCaption) return null;

    const { winningCaption, winnerCount, winnerNames } = results;

    // Case 1: No votes were cast at all.
    if (winnerCount === 0) {
      return (
         <div className="absolute inset-x-0 bottom-0 bg-black/80 p-4 text-center">
            <p className="text-xl font-semibold text-white leading-tight">No votes this round!</p>
            <p className="text-md text-muted-foreground mt-2">No points awarded.</p>
        </div>
      );
    }
    
    // Case 2: A single, clear winner.
    if (winnerCount === 1) {
      return (
        <div className="absolute inset-x-0 bottom-0 bg-black/80 p-4 text-center">
            <p className="text-2xl font-semibold text-white leading-tight">"{winningCaption.text}"</p>
            <p className="text-md text-accent mt-2">by {winningCaption.authorName} (+{winningCaption.pointsAwarded} points)</p>
        </div>
      );
    }

    // Case 3: A tie between multiple players.
    const otherWinners = winnerNames?.filter(name => name !== winningCaption.authorName) || [];
    const andOthersText = otherWinners.length > 0 ? ` & ${otherWinners.join(', ')}` : '';
    
    return (
        <div className="absolute inset-x-0 bottom-0 bg-black/80 p-4 text-center">
            <p className="text-sm text-yellow-400 font-bold">A TIE BETWEEN {winnerCount} PLAYERS!</p>
            <p className="text-2xl font-semibold text-white leading-tight mt-1">"{winningCaption.text}"</p>
            <p className="text-md text-accent mt-2">
                One of the winning captions by {winningCaption.authorName}.
            </p>
            <p className="text-sm text-accent">
                All winners get +{winningCaption.pointsAwarded} points!
            </p>
        </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="h-16 w-16 text-primary animate-spin mb-4" />
        <h1 className="font-headline text-3xl text-primary">Revealing the Winner...</h1>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="font-headline text-3xl text-destructive">Error Loading Results</h1>
        <p className="text-muted-foreground mt-2">Could not load round results. Please try refreshing.</p>
        <Button className="mt-4" onClick={() => window.location.reload()}>Refresh</Button>
      </div>
    );
  }


  return (
    <div className="max-w-4xl mx-auto py-8">
      <Card className="shadow-xl overflow-hidden card-jackbox border-2 border-primary/70">
        <CardHeader className="text-center bg-gradient-to-b from-accent/30 to-transparent pb-8">
          <CardTitle className="font-headline text-5xl text-accent flex items-center justify-center title-jackbox">
            <Award className="mr-3 h-12 w-12" /> Round {results.currentRound} Results!
          </CardTitle>
          <CardDescription className="text-lg">The votes are in!</CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-8">
          <Card className="relative shadow-lg border-2 border-accent overflow-hidden">
            <img src={results.memeUrl} alt="Winning meme" className="w-full max-h-[400px] object-contain bg-black" />
            {renderWinnerInfo()}
          </Card>
          <LeaderboardSnippet players={results.players} currentPlayerId={currentUserId || undefined} />
          <div className="text-center pt-4">
            <Button size="lg" onClick={handleNext} disabled={isNavigating.current} className="font-bold text-lg bg-primary hover:bg-primary/90 group btn-jackbox">
              {isNavigating.current && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              {results.currentRound < results.totalRounds ? 'Next Round' : 'View Final Results'}
              {!isNavigating.current && <ArrowRightCircle className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}