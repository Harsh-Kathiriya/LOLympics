"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { TimerBar } from '@/components/game/timer-bar';
import { CaptionInput } from '@/components/game/caption-input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';
import { CAPTION_ENTRY_DURATION } from '@/lib/constants';

/**
 * CaptionEntryPage Component
 * 
 * This page handles the caption entry phase of the game. Its responsibilities are:
 * 1. Fetching the winning meme that was selected in the previous phase (`meme-voting`).
 * 2. Displaying a timer and an input field for the player to write their caption.
 * 3. Submitting the player's caption to the database.
 * 4. Navigating the player to the next phase (`caption-voting`) immediately after submission or when the timer runs out.
 * 
 * This page operates without real-time Ably events. The synchronization of players
 * is handled by a "waiting room" on the subsequent `caption-voting` page.
 */
export default function CaptionEntryPage() {
  const params = useParams();
  const roomCode = params.roomCode as string;
  const router = useRouter();
  const { toast } = useToast();

  // UI state: true while fetching the initial round data.
  const [isLoading, setIsLoading] = useState(true);
  // UI state: true when a caption is being submitted to the backend.
  const [isSubmitting, setIsSubmitting] = useState(false);
  // State for the current round's unique ID.
  const [roundId, setRoundId] = useState<string | null>(null);
  // State for the URL of the meme to be captioned.
  const [memeUrl, setMemeUrl] = useState<string>('');

  // Step 1: Fetch the current round's winning meme to be captioned.
  useEffect(() => {
    const fetchRoundInfo = async () => {
      // First, get the room's UUID from its more user-friendly room_code.
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('id')
        .eq('room_code', roomCode)
        .single();

      if (roomError || !roomData) {
        toast({ title: "Error finding room", description: "This room doesn't seem to exist.", variant: "destructive" });
        router.push('/');
        return;
      }
      
      const roomId = roomData.id;

      // Now, get the current round info using the room's UUID.
      // This RPC fetches the active round ID and the corresponding meme's URL.
      const { data: roundInfo, error: roundInfoError } = await supabase.rpc('get_current_round_info', {
        p_room_id: roomId
      });
      
      // The RPC returns a single-element array, so we extract the first item.
      const currentRound = Array.isArray(roundInfo) ? roundInfo[0] : roundInfo;

      if (roundInfoError || !currentRound) {
        toast({ title: "Error loading round", description: "Couldn't load data for the current round. Returning to lobby.", variant: "destructive" });
        router.push(`/room/${roomCode}`);
        return;
      }
      
      setRoundId(currentRound.round_id);
      setMemeUrl(currentRound.meme_image_url);
      setIsLoading(false);
    };

    if (roomCode) {
      fetchRoundInfo();
    }
  }, [roomCode, router, toast]);

  /**
   * Called by the TimerBar component when the countdown reaches zero.
   * Navigates the player to the next page regardless of submission status.
   */
  const handleTimeUp = () => {
    toast({
      title: "Time's up!",
      description: "Moving to caption voting.",
    });
    // The next page will handle waiting for any players who didn't submit in time.
    router.push(`/room/${roomCode}/caption-voting`);
  };

  /**
   * Handles the user submitting their caption.
   * @param caption The text content of the caption from the CaptionInput component.
   */
  const handleSubmitCaption = async (caption: string) => {
    if (!roundId || isSubmitting) return;

    setIsSubmitting(true);
    try {
      // This RPC securely saves the caption to the database.
      const { error } = await supabase.rpc('submit_caption', {
        p_round_id: roundId,
        p_caption_text: caption,
      });

      if (error) throw error;

      toast({
        title: "Caption Submitted!",
        description: `Your caption is in! Get ready to vote.`,
      });
      
      // Navigate to the voting page immediately after a successful submission.
      router.push(`/room/${roomCode}/caption-voting`);

    } catch (error: any) {
      console.error("Error submitting caption:", error);
      toast({
        title: "Submission Failed",
        description: error.message,
        variant: "destructive",
      });
      setIsSubmitting(false); // Allow retry if submission fails.
    }
  };

  // While fetching initial data, show a loading screen.
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
          <Loader2 className="h-16 w-16 text-primary animate-spin mb-4" />
          <h1 className="font-headline text-3xl text-primary">Loading Round</h1>
          <p className="text-muted-foreground mt-2">Getting the winning meme ready...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      <Card className="shadow-xl card-jackbox border-2 border-primary/70">
        <CardHeader className="text-center">
          <CardTitle className="font-headline text-4xl text-primary title-jackbox">Caption This Meme!</CardTitle>
          <CardDescription>Write your funniest caption. You have {CAPTION_ENTRY_DURATION} seconds!</CardDescription>
        </CardHeader>
        <CardContent>
          <TimerBar durationSeconds={CAPTION_ENTRY_DURATION} onTimeUp={handleTimeUp} className="mb-6" />
          <CaptionInput 
            onSubmit={handleSubmitCaption} 
            memeImageUrl={memeUrl}
            isSubmitting={isSubmitting}
          />
        </CardContent>
      </Card>
    </div>
  );
}
