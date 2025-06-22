// FILE: /Users/harshkathiriya/Downloads/captionking-master/src/app/room/[roomCode]/final-results/page.tsx
"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FullLeaderboard } from '@/components/game/full-leaderboard';
import { Share2, RotateCcw, Home, Trophy, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabase';
import { useRoomChannel, RoomEvent, GamePhaseChangedPayload } from '@/hooks/use-room-channel';
import { soundManager } from '@/lib/sound';

type PlayerData = {
  id: string;
  name: string;
  score: number;
  avatarUrl?: string;
};

export default function FinalResultsPage() {
  const params = useParams();
  const roomCode = params.roomCode as string;
  const router = useRouter();
  const { toast } = useToast();
  const roomChannel = useRoomChannel(roomCode);
  
  const [isLoading, setIsLoading] = useState(true);
  const [players, setPlayers] = useState<PlayerData[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isPlayingAgain, setIsPlayingAgain] = useState(false);
  const [isLeavingGame, setIsLeavingGame] = useState(false);
  
  const overallWinner = players.length > 0 ? [...players].sort((a, b) => b.score - a.score)[0] : null;

  useEffect(() => {
    const fetchGameResults = async () => {
      try {
        const { data: roomData, error: roomError } = await supabase.from('rooms').select('id').eq('room_code', roomCode).single();
        if (roomError || !roomData) throw new Error("Could not find room");
        setRoomId(roomData.id);
        
        const { data: playersData, error: playersError } = await supabase.from('players').select('id, username, current_score, avatar_src').eq('room_id', roomData.id);
        if (playersError || !playersData) throw new Error("Could not fetch players data");
        
        const formattedPlayers: PlayerData[] = playersData.map(player => ({ id: player.id, name: player.username, score: player.current_score, avatarUrl: player.avatar_src || undefined }));
        setPlayers(formattedPlayers);
        
        // Play final result sound when results are loaded
        if (soundManager) {
          soundManager.playFinalResult();
        }
      } catch (error: any) {
        toast({ title: "Error loading results", description: error.message, variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchGameResults();
  }, [roomCode, toast]);

  const handlePlayAgain = async () => {
    if (!roomId || isPlayingAgain) return;
    setIsPlayingAgain(true);
    
    // Play button click sound
    if (soundManager) {
      soundManager.playButtonClick();
    }
    
    try {
      const { error } = await supabase.rpc('reset_game', { p_room_id: roomId });
      if (error) throw error;
      
      toast({ title: "Play Again!", description: `Restarting game in room ${roomCode}...` });
      
      await roomChannel.publish<GamePhaseChangedPayload>(RoomEvent.GAME_PHASE_CHANGED, { phase: 'lobby' });
      router.push(`/room/${roomCode}`);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setIsPlayingAgain(false);
    }
  };

  const handleNewGame = async () => {
    if (isLeavingGame || !roomId) return;
    setIsLeavingGame(true);
    
    // Play button click sound
    if (soundManager) {
      soundManager.playButtonClick();
    }
    
    try {
      await supabase.rpc('leave_room', { p_room_id: roomId });
      toast({ title: "New Game", description: "Returning to home screen." });
      router.push('/');
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setIsLeavingGame(false);
    }
  };

  const handleShare = () => {
    if (!overallWinner) return;
    
    // Play button click sound
    if (soundManager) {
      soundManager.playButtonClick();
    }
    
    const shareText = `I just played Caption Clash! ${overallWinner.name} won with ${overallWinner.score} points in room ${roomCode}!`;
    if (navigator.share) {
      navigator.share({ title: 'Caption Clash Results', text: shareText, url: window.location.href });
    } else {
      navigator.clipboard.writeText(`${shareText} Join the fun: ${window.location.origin}`);
      toast({ title: "Results Copied!", description: "Share message copied to clipboard." });
    }
  };
  
  // Listen for phase change to go back to lobby
  useEffect(() => {
    if (!roomChannel.isReady) return;
    const handlePhaseChange = (data: GamePhaseChangedPayload) => {
      if (data.phase === 'lobby') {
        router.push(`/room/${roomCode}`);
      }
    };
    const unsub = roomChannel.subscribe<GamePhaseChangedPayload>(RoomEvent.GAME_PHASE_CHANGED, handlePhaseChange);
    return () => unsub();
  }, [roomChannel, roomCode, router]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="h-16 w-16 text-primary animate-spin mb-4" />
        <h1 className="font-headline text-3xl text-primary">Loading Final Results</h1>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8">
      <Card className="shadow-2xl overflow-hidden card-jackbox border-2 border-primary/70">
        <CardHeader className="text-center bg-gradient-to-b from-primary/30 to-transparent pb-10">
          <Trophy className="mx-auto h-24 w-24 text-yellow-400 animate-bounce" />
          <CardTitle className="font-headline text-5xl text-primary mt-4 title-jackbox">Game Over!</CardTitle>
          <CardDescription className="text-xl mt-2">And the Grand Champion is...</CardDescription>
          {overallWinner && (
            <>
              <p className="font-headline text-4xl text-accent mt-4 animate-pulse">{overallWinner.name}</p>
              <p className="text-2xl text-muted-foreground">with {overallWinner.score} points!</p>
            </>
          )}
        </CardHeader>
        <CardContent className="p-6 space-y-8">
          <FullLeaderboard players={players} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6">
            <Button size="lg" variant="outline" onClick={handleShare} disabled={!overallWinner} className="font-semibold btn-jackbox">
              <Share2 className="mr-2 h-5 w-5" /> Share Results
            </Button>
            <Button size="lg" variant="secondary" onClick={handlePlayAgain} disabled={isPlayingAgain} className="font-semibold btn-jackbox">
              {isPlayingAgain ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <RotateCcw className="mr-2 h-5 w-5" />}
              Play Again
            </Button>
            <Button size="lg" onClick={handleNewGame} disabled={isLeavingGame} className="font-semibold bg-accent hover:bg-accent/90 text-accent-foreground btn-jackbox">
              {isLeavingGame ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Home className="mr-2 h-5 w-5" />}
              New Game
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}