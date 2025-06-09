"use client";

import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FullLeaderboard } from '@/components/game/full-leaderboard';
import { Share2, RotateCcw, Home, Trophy } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

// Placeholder data
const playersData = [
  { id: '2', name: 'Player SuperStar', score: 1250, avatarUrl: 'https://placehold.co/64x64.png?text=PS' },
  { id: '1', name: 'Player One', score: 980, avatarUrl: 'https://placehold.co/64x64.png?text=P1' },
  { id: '3', name: 'Player Three', score: 750, avatarUrl: 'https://placehold.co/64x64.png?text=P3' },
  { id: '4', name: 'Player Four', score: 600, avatarUrl: 'https://placehold.co/64x64.png?text=P4' },
];

const overallWinner = playersData.sort((a,b) => b.score - a.score)[0];

export default function FinalResultsPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const router = useRouter();
  const { toast } = useToast();

  const handlePlayAgain = () => {
    // Logic to restart game with same players/room (might go back to lobby)
    toast({
      title: "Play Again!",
      description: `Restarting game in room ${roomId}...`,
    });
    router.push(`/room/${roomId}`); // Navigate to lobby
  };

  const handleNewGame = () => {
    toast({
      title: "New Game",
      description: "Returning to home screen to create/join a new room.",
    });
    router.push('/');
  };

  const handleShare = () => {
    const shareText = `I just played Caption Clash! ${overallWinner.name} won with ${overallWinner.score} points in room ${roomId}!`;
    if (navigator.share) {
      navigator.share({
        title: 'Caption Clash Results',
        text: shareText,
        url: window.location.href,
      }).catch(error => console.log('Error sharing:', error));
    } else {
      navigator.clipboard.writeText(`${shareText} Join the fun: ${window.location.origin}`);
      toast({
        title: "Results Copied!",
        description: "Share message copied to clipboard.",
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8">
      <Card className="shadow-2xl overflow-hidden">
        <CardHeader className="text-center bg-gradient-to-b from-primary/30 to-transparent pb-10">
          <Trophy className="mx-auto h-24 w-24 text-yellow-400 animate-bounce" />
          <CardTitle className="font-headline text-5xl text-primary mt-4">
            Game Over!
          </CardTitle>
          <CardDescription className="text-xl mt-2">
            And the Grand Champion is...
          </CardDescription>
          <p className="font-headline text-4xl text-accent mt-4 animate-pulse">
            {overallWinner.name}
          </p>
          <p className="text-2xl text-muted-foreground">with {overallWinner.score} points!</p>
        </CardHeader>
        <CardContent className="p-6 space-y-8">
          <FullLeaderboard players={playersData} />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6">
            <Button size="lg" variant="outline" onClick={handleShare} className="font-semibold">
              <Share2 className="mr-2 h-5 w-5" /> Share Results
            </Button>
            <Button size="lg" variant="secondary" onClick={handlePlayAgain} className="font-semibold">
              <RotateCcw className="mr-2 h-5 w-5" /> Play Again
            </Button>
            <Button size="lg" onClick={handleNewGame} className="font-semibold bg-accent hover:bg-accent/90 text-accent-foreground">
              <Home className="mr-2 h-5 w-5" /> New Game
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

