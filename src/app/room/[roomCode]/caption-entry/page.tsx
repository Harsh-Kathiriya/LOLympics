"use client";

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { TimerBar } from '@/components/game/timer-bar';
import { CaptionInput } from '@/components/game/caption-input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from "@/hooks/use-toast";

// Placeholder for the winning meme from previous step
const chosenMemeUrl = "https://placehold.co/600x450.png?text=Chosen+Meme";

export default function CaptionEntryPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const router = useRouter();
  const { toast } = useToast();

  const handleTimeUp = () => {
    toast({
      title: "Time's up for captions!",
      description: "Moving to caption voting.",
    });
    router.push(`/room/${roomId}/caption-voting`);
  };

  const handleSubmitCaption = (caption: string) => {
    // Logic to submit caption to backend
    toast({
      title: "Caption Submitted!",
      description: `Your caption: "${caption.substring(0,30)}..." is in! Waiting for others...`,
    });
    // In a real app, you might wait for server confirmation or all players
    // For now, let's wait for the timer to expire or for all players to submit
    // Optionally, navigate after submission if all players done:
    // router.push(`/room/${roomId}/caption-voting`);
  };

  return (
    <div className="max-w-2xl mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="font-headline text-4xl text-primary">Caption This Meme!</CardTitle>
          <CardDescription>Write your funniest caption. You have 60 seconds!</CardDescription>
        </CardHeader>
        <CardContent>
          <TimerBar durationSeconds={60} onTimeUp={handleTimeUp} className="mb-6" />
          <CaptionInput 
            onSubmit={handleSubmitCaption} 
            memeImageUrl={chosenMemeUrl} 
          />
        </CardContent>
      </Card>
    </div>
  );
}
