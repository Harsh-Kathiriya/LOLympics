"use client";

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LeaderboardSnippet } from '@/components/game/leaderboard-snippet';
import Image from 'next/image';
import { Award, ArrowRightCircle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

// Placeholder data
const memeUrl = "https://placehold.co/600x400.png?text=Round+Winner+Meme";
const winningCaption = {
  text: "This is the hilariously witty winning caption that won the round!",
  author: "Player SuperStar",
  pointsAwarded: 100,
};

const playersData = [
  { id: '1', name: 'Player One', score: 250, avatarUrl: 'https://placehold.co/48x48.png?text=P1' },
  { id: '2', name: 'Player SuperStar', score: 350, avatarUrl: 'https://placehold.co/48x48.png?text=PS' },
  { id: '3', name: 'Player Three', score: 180, avatarUrl: 'https://placehold.co/48x48.png?text=P3' },
  { id: '4', name: 'Player Four', score: 150, avatarUrl: 'https://placehold.co/48x48.png?text=P4' },
];
const currentRound = 3;
const totalRounds = 5;

export default function RoundResultsPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const timer = setTimeout(() => {
      handleNext();
    }, 8000); // Auto-advance after 8 seconds

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNext = () => {
    if (currentRound < totalRounds) {
      toast({
        title: `Starting Round ${currentRound + 1}`,
        description: "Get ready for the next meme!",
      });
      router.push(`/room/${roomId}/meme-selection`);
    } else {
      toast({
        title: "Game Over!",
        description: "Let's see the final results.",
      });
      router.push(`/room/${roomId}/final-results`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8">
      <Card className="shadow-xl overflow-hidden">
        <CardHeader className="text-center bg-gradient-to-b from-accent/30 to-transparent pb-8">
          <CardTitle className="font-headline text-5xl text-accent flex items-center justify-center">
            <Award className="mr-3 h-12 w-12" /> Round {currentRound} Results!
          </CardTitle>
          <CardDescription className="text-lg">
            The votes are in! Here's the winning caption.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-8">
          <Card className="relative shadow-lg border-2 border-accent overflow-hidden">
            <Image
              src={memeUrl}
              alt="Winning meme"
              width={600}
              height={400}
              layout="responsive"
              objectFit="contain"
              className="bg-black"
              data-ai-hint="funny meme"
            />
            <div className="absolute inset-x-0 bottom-0 bg-black/80 p-4 text-center">
              <p className="text-2xl font-semibold text-white leading-tight">
                "{winningCaption.text}"
              </p>
              <p className="text-md text-accent mt-2">
                by {winningCaption.author} (+{winningCaption.pointsAwarded} points)
              </p>
            </div>
          </Card>

          <LeaderboardSnippet players={playersData} currentPlayerId="2" />
          
          <div className="text-center pt-4">
            <Button 
              size="lg" 
              onClick={handleNext} 
              className="font-bold text-lg bg-primary hover:bg-primary/90 group"
            >
              {currentRound < totalRounds ? 'Next Round' : 'View Final Results'}
              <ArrowRightCircle className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
