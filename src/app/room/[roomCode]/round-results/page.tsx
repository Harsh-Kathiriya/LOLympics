/**
 * RoundResultsPage Component
 *
 * This component displays the results of a completed round. It shows the meme,
 * the winning caption(s), points awarded, and an updated leaderboard.
 *
 * Core Logic:
 * 1.  Initialization & Polling:
 *     - On mount, it shows a loader and starts polling the `get_round_results_details`
 *       Supabase RPC. This is because it might take a moment for the server to
 *       finalize the results after the voting phase ends.
 *     - Polling stops once the results are successfully fetched.
 * 2.  Display Results:
 *     - Renders the meme image.
 *     - A helper function `renderWinnerInfo` displays the winner. It has special
 *       UI for ties, showing all winning captions and authors.
 *     - Shows a `LeaderboardSnippet` with updated player scores.
 * 3.  Automatic Advancement:
 *     - A 12-second timer is initiated. When it completes, the game automatically
 *       proceeds to the next phase, ensuring the game keeps a good pace.
 * 4.  Real-time Updates (Ably):
 *     - Listens for the 'game-phase-changed' event (triggered by one of the clients
 *       when the timer ends) to navigate all players simultaneously to the next
 *       stage (either 'meme-selection' or 'final-results').
 */
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LeaderboardSnippet } from '@/components/game/leaderboard-snippet';
import { PlayerAvatar } from '@/components/game/player-avatar';
import { Award, ArrowRightCircle, Loader2, Users } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabase';
import { useRoomChannel, RoomEvent, GamePhaseChangedPayload } from '@/hooks/use-room-channel';
import { ROUND_RESULTS_DURATION } from '@/lib/constants';
import { soundManager } from '@/lib/sound';

type WinningCaption = {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  avatarUrl?: string;
};

type RoundResult = {
  memeUrl: string;
  winningCaptions: WinningCaption[] | null;
  pointsAwarded: number;
  players: {
    id: string;
    name: string;
    score: number;
    avatarUrl?: string;
  }[];
  currentRound: number;
  totalRounds: number;
};

export default function RoundResultsPage() {
  const params = useParams();
  const roomCode = params.roomCode as string;
  const router = useRouter();
  const { toast } = useToast();
  
  // State to manage the loading screen while results are being tallied.
  const [isLoading, setIsLoading] = useState(true);
  const [results, setResults] = useState<RoundResult | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  // Ref to prevent navigation logic from firing multiple times.
  const isNavigating = useRef(false);
  
  // Establishes a real-time connection to the room's channel via Ably.
  const roomChannel = useRoomChannel(roomCode);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    // This effect fetches the results. It polls because there might be a slight delay
    // between this page loading and the server finalizing the previous round's results.
    const fetchRoundResults = async () => {
      try {
        const { data: roomData, error: roomError } = await supabase.from('rooms').select('id, current_round_number').eq('room_code', roomCode).single();
        if (roomError || !roomData) throw new Error("Could not find room");
        if (!roomId) setRoomId(roomData.id);
        
        const { data: roundData, error: roundError } = await supabase.from('rounds').select('id').eq('room_id', roomData.id).eq('round_number', roomData.current_round_number).single();
        if (roundError || !roundData) throw new Error("Could not find current round data.");

        const { data: resultsData, error: resultsError } = await supabase.rpc('get_round_results_details', { p_round_id: roundData.id });
        if (resultsError) throw resultsError;
        if (!resultsData) throw new Error("Failed to load round result details.");
        
        setResults(resultsData as RoundResult);
        setIsLoading(false);
        
        // Play round result sound when results are loaded
        if (soundManager) {
          soundManager.playRoundResult();
        }

      } catch (error: any) {
        console.log(error.message);
      }
    };
    
    // Start polling immediately if results are still loading.
    if (isLoading) {
      fetchRoundResults();
      const intervalId = setInterval(fetchRoundResults, 2000);
      // Stop polling once results are loaded.
      return () => clearInterval(intervalId);
    }
  }, [isLoading, roomCode, roomId]);

  // Advances the game to the next round or to the final results.
  const handleNext = useCallback(async () => {
    if (isNavigating.current || !results || !roomId) return;
    isNavigating.current = true;
    
    // Play button click sound
    if (soundManager) {
      soundManager.playButtonClick();
    }
    
    try {
      // Call the server function to update the room state.
      await supabase.rpc('advance_to_next_round', { p_room_id: roomId });
      // Determine the next phase based on the current round number.
      const nextPhase = results.currentRound < results.totalRounds ? 'meme-selection' : 'final-results';
      // Notify all clients to navigate to the next phase.
      await roomChannel.publish<GamePhaseChangedPayload>(RoomEvent.GAME_PHASE_CHANGED, { phase: nextPhase });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      isNavigating.current = false;
    }
  }, [results, roomId, roomChannel, toast]);

  useEffect(() => {
    // Automatically trigger the 'next' action after a delay to keep the game moving.
    if (isLoading || !results) return;
    const timer = setTimeout(() => handleNext(), ROUND_RESULTS_DURATION * 1000);
    return () => clearTimeout(timer);
  }, [isLoading, results, handleNext]);
  
  useEffect(() => {
    // Subscribes to the 'game-phase-changed' event to handle navigation.
    if (!roomChannel.isReady) return;
    const handlePhaseChange = (data: GamePhaseChangedPayload) => {
      if (data.phase === 'meme-selection') router.push(`/room/${roomCode}/meme-selection`);
      else if (data.phase === 'final-results') router.push(`/room/${roomCode}/final-results`);
    };
    const unsubPhase = roomChannel.subscribe<GamePhaseChangedPayload>(RoomEvent.GAME_PHASE_CHANGED, handlePhaseChange);
    return () => unsubPhase();
  }, [roomChannel.isReady, roomCode, router]);

  // Renders the information about the winner(s) of the round.
  const renderWinnerInfo = () => {
    if (!results || !results.winningCaptions || results.winningCaptions.length === 0) {
      return (
         <div className="absolute inset-x-0 bottom-0 bg-black/80 p-4 text-center">
            <p className="text-xl font-semibold text-white">No votes this round!</p>
            <p className="text-md text-muted-foreground mt-2">No points awarded.</p>
        </div>
      );
    }
    
    const { winningCaptions, pointsAwarded } = results;

    // UI for a single winner.
    if (winningCaptions.length === 1) {
      const winner = winningCaptions[0];
      return (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-6 pt-12 text-center">
            <p className="text-3xl font-bold text-white leading-tight drop-shadow-lg">"{winner.text}"</p>
            <p className="text-lg text-accent mt-3 font-semibold">by {winner.authorName} (+{pointsAwarded} points)</p>
        </div>
      );
    }

    // Special UI to handle ties, listing all winners.
    return (
      <div className="absolute inset-0 bg-black/80 p-4 flex flex-col justify-center items-center text-center">
        <h3 className="font-headline text-3xl text-yellow-400 font-bold tracking-wider animate-pulse">
          IT'S A TIE!
        </h3>
        <p className="text-muted-foreground mb-4">{winningCaptions.length} players share the victory!</p>
        <div className="flex flex-wrap justify-center gap-4">
          {winningCaptions.map(winner => (
            <div key={winner.id} className="bg-black/50 p-3 rounded-lg max-w-xs">
              <PlayerAvatar name={winner.authorName} avatarUrl={winner.avatarUrl} size="sm" />
              <p className="text-white text-lg mt-2">"{winner.text}"</p>
            </div>
          ))}
        </div>
        <p className="text-accent font-semibold mt-4 text-lg">
          All winners get +{pointsAwarded} points!
        </p>
      </div>
    );
  };

  if (isLoading) {
    return <div className="flex flex-col items-center justify-center min-h-screen"><Loader2 className="h-16 w-16 text-primary animate-spin mb-4" /><h1 className="font-headline text-3xl text-primary">Revealing the Winner...</h1></div>;
  }
  if (!results) {
    return <div className="flex flex-col items-center justify-center min-h-screen"><h1 className="font-headline text-3xl text-destructive">Error Loading Results</h1><Button className="mt-4" onClick={() => window.location.reload()}>Refresh</Button></div>;
  }

  return (
    <div className="max-w-4xl mx-auto py-8">
      <Card className="shadow-xl overflow-hidden card-jackbox border-2 border-primary/70">
        <CardHeader className="text-center bg-gradient-to-b from-primary/20 to-transparent pb-8">
          <CardTitle className="font-headline text-5xl text-primary flex items-center justify-center title-jackbox">
            <Award className="mr-3 h-12 w-12" /> Round {results.currentRound} Results!
          </CardTitle>
          <CardDescription className="text-lg">The votes are in!</CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-8">
          <Card className="relative shadow-lg border-2 border-accent overflow-hidden min-h-[300px]">
            <img src={results.memeUrl} alt="Winning meme" className="w-full h-full object-cover" />
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