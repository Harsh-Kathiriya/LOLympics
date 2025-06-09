"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { TimerBar } from '@/components/game/timer-bar';
import { CaptionCard } from '@/components/game/caption-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';
import { CheckSquare } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

// Placeholder for the chosen meme and submitted captions
const chosenMemeUrl = "https://placehold.co/600x400.png?text=Meme+For+Voting";
const submittedCaptions = [
  { id: 'c1', text: 'This is caption one. It is very funny, trust me bro.', submittedBy: 'Player A' },
  { id: 'c2', text: 'Caption two reporting for duty! Prepare for laughter.', submittedBy: 'Player B' },
  { id: 'c3', text: 'A wild caption appears! It uses humor. It is super effective!', submittedBy: 'Player C' },
  { id: 'c4', text: 'My attempt at being funny. Hope you like it more than my cooking.', submittedBy: 'Player D' },
];

export default function CaptionVotingPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const router = useRouter();
  const { toast } = useToast();
  
  const [votedCaptionId, setVotedCaptionId] = useState<string | null>(null);

  const handleTimeUp = () => {
    toast({
      title: "Time's up for caption voting!",
      description: "Revealing the round winner...",
    });
    router.push(`/room/${roomId}/round-results`);
  };

  const handleVote = (captionId: string) => {
    setVotedCaptionId(captionId);
    // Logic to submit vote to backend
    toast({
      title: "Vote Submitted!",
      description: "Your vote has been cast. Good luck to your favorite!",
    });
  };

  return (
    <div className="max-w-6xl mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="font-headline text-4xl text-primary">Vote for the Best Caption!</CardTitle>
          <CardDescription>Read the captions and vote for your favorite. You have 30 seconds!</CardDescription>
        </CardHeader>
        <CardContent>
          <TimerBar durationSeconds={30} onTimeUp={handleTimeUp} className="mb-6" />

          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            <div className="md:col-span-2 rounded-lg overflow-hidden shadow-lg border border-border sticky top-24 self-start">
              <Image
                src={chosenMemeUrl}
                alt="Meme being captioned"
                width={600}
                height={400}
                layout="responsive"
                objectFit="contain"
                className="bg-black"
                data-ai-hint="funny meme" 
              />
            </div>

            <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {submittedCaptions.map((caption, index) => (
                <CaptionCard
                  key={caption.id}
                  captionText={caption.text}
                  captionNumber={index + 1}
                  onVote={() => handleVote(caption.id)}
                  isVoted={votedCaptionId === caption.id}
                />
              ))}
            </div>
          </div>
          
          {votedCaptionId && (
             <div className="mt-8 text-center">
              <Button 
                size="lg" 
                onClick={() => router.push(`/room/${roomId}/round-results`)} 
                className="font-bold text-lg bg-primary hover:bg-primary/90"
              >
                Waiting for results... <CheckSquare className="ml-2 h-5 w-5"/>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
