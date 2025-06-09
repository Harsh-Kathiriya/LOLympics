"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { TimerBar } from '@/components/game/timer-bar';
import { MemeCard } from '@/components/game/meme-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle }   from '@/components/ui/card';
import { ThumbsUp, Vote, CheckCircle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

// Placeholder for memes nominated by players (or selected by system)
const nominatedMemes = [
  { id: 'm1', url: 'https://placehold.co/400x300.png?text=Nominee+1', submittedBy: 'Player A', dataAiHint: 'dog happy' },
  { id: 'm2', url: 'https://placehold.co/400x300.png?text=Nominee+2', submittedBy: 'Player B', dataAiHint: 'cat confused' },
  { id: 'm3', url: 'https://placehold.co/400x300.png?text=Nominee+3', submittedBy: 'Player C', dataAiHint: 'person thinking' },
];

export default function MemeVotingPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const router = useRouter();
  const { toast } = useToast();

  const [votedMemeId, setVotedMemeId] = useState<string | null>(null);

  const handleTimeUp = () => {
     toast({
      title: "Time's up for voting!",
      description: "Tallying votes for the chosen meme.",
    });
    // Logic to determine winning meme and navigate
    router.push(`/room/${roomId}/caption-entry`);
  };

  const handleVote = (memeId: string) => {
    setVotedMemeId(memeId);
    // In a real app, send vote to backend
    toast({
      title: "Vote Cast!",
      description: `You voted for a meme. Results coming soon!`,
    });
    // Optionally, disable further voting or navigate after vote.
    // For now, we wait for timer or manual progression.
  };

  return (
    <div className="max-w-5xl mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="font-headline text-4xl text-primary">Vote for a Meme</CardTitle>
          <CardDescription>Choose the meme you want to caption. You have 15 seconds!</CardDescription>
        </CardHeader>
        <CardContent>
          <TimerBar durationSeconds={15} onTimeUp={handleTimeUp} className="mb-6" />

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {nominatedMemes.map(meme => (
              <div key={meme.id} className="relative group">
                <MemeCard
                  memeUrl={meme.url}
                  altText={`Meme submitted by ${meme.submittedBy}`}
                  isSelected={votedMemeId === meme.id}
                  className="w-full"
                  dataAiHint={meme.dataAiHint}
                >
                  <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <Button
                      variant={votedMemeId === meme.id ? "default" : "secondary"}
                      onClick={() => handleVote(meme.id)}
                      disabled={!!votedMemeId && votedMemeId !== meme.id}
                      className="w-3/4 font-semibold"
                    >
                      <ThumbsUp className="mr-2 h-5 w-5" />
                      {votedMemeId === meme.id ? "Voted!" : "Vote for this"}
                    </Button>
                  </div>
                </MemeCard>
                <p className="text-center mt-2 text-sm text-muted-foreground">
                  Nominated by: {meme.submittedBy}
                </p>
                 {votedMemeId === meme.id && (
                  <div className="absolute top-2 right-2 bg-accent text-accent-foreground p-2 rounded-full shadow-lg">
                    <CheckCircle className="h-6 w-6" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {votedMemeId && (
            <div className="mt-8 text-center">
              <Button
                size="lg"
                onClick={() => router.push(`/room/${roomId}/caption-entry`)}
                className="font-bold text-lg bg-primary hover:bg-primary/90"
              >
                Waiting for others... <Vote className="ml-2 h-5 w-5"/>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
