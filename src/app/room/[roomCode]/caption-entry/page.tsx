"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { TimerBar } from '@/components/game/timer-bar';
import { CaptionInput } from '@/components/game/caption-input';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabase';
import { Loader2, PencilLine } from 'lucide-react';
import { CAPTION_ENTRY_DURATION } from '@/lib/constants';
import { useRoomInfo } from '@/hooks/use-room-info';

/**
 * CaptionEntryPage Component
 * 
 * This page handles the caption entry phase of the game. Its responsibilities are:
 * 1. Fetching the player's selected meme for the current round.
 * 2. Displaying a timer and an input field for the player to write their caption.
 * 3. Allowing the player to position their caption on the meme.
 * 4. Submitting the player's caption and position to the database.
 * 5. Navigating the player to the next phase (`caption-voting`) immediately after submission or when the timer runs out.
 * 
 * This page operates without real-time Ably events. The synchronization of players
 * is handled by a "waiting room" on the subsequent `caption-voting` page.
 */
export default function CaptionEntryPage() {
  const params = useParams();
  const roomCode = params.roomCode as string;
  const router = useRouter();
  const { toast } = useToast();
  const { roomInfo, isRoomInfoLoading } = useRoomInfo(roomCode);

  // UI state: true while fetching the initial round data.
  const [isLoading, setIsLoading] = useState(true);
  // UI state: true when a caption is being submitted to the backend.
  const [isSubmitting, setIsSubmitting] = useState(false);
  // State for the current round's unique ID.
  const [roundId, setRoundId] = useState<string | null>(null);
  // State for the URL of the meme to be captioned.
  const [memeUrl, setMemeUrl] = useState<string>('');
  // State to track if we're waiting for all players to select their memes
  const [isWaitingForPlayers, setIsWaitingForPlayers] = useState(true);

  // Step 1: Check room status and wait for all players to select their memes
  useEffect(() => {
    if (isRoomInfoLoading || !roomInfo) return;

    // If room status is not 'caption-entry', we're still waiting for players
    if (roomInfo.status !== 'caption-entry') {
      setIsWaitingForPlayers(true);
      
      // Set up polling to check room status
      const intervalId = setInterval(async () => {
        try {
          const { data, error } = await supabase
            .from('rooms')
            .select('status')
            .eq('room_code', roomCode)
            .single();
            
          if (error) throw error;
          
          if (data && data.status === 'caption-entry') {
            setIsWaitingForPlayers(false);
            clearInterval(intervalId);
          }
        } catch (error) {
          console.error("Error checking room status:", error);
        }
      }, 2000);
      
      return () => clearInterval(intervalId);
    } else {
      setIsWaitingForPlayers(false);
    }
  }, [roomInfo, isRoomInfoLoading, roomCode]);

  // Step 2: Fetch the current round's winning meme to be captioned.
  useEffect(() => {
    // Only fetch round info if we're not waiting for players
    if (isWaitingForPlayers) return;
    
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
      // This RPC fetches the active round ID and the player's selected meme URL.
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
  }, [roomCode, router, toast, isWaitingForPlayers]);

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
   * @param positionX The horizontal position (0-100) of the caption on the meme.
   * @param positionY The vertical position (0-100) of the caption on the meme.
   */
  const handleSubmitCaption = async (caption: string, positionX: number, positionY: number) => {
    if (!roundId || isSubmitting) return;

    setIsSubmitting(true);
    try {
      // This RPC securely saves the caption to the database with position information.
      const { error } = await supabase.rpc('submit_caption', {
        p_round_id: roundId,
        p_caption_text: caption,
        p_position_x: positionX,
        p_position_y: positionY
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

  // While waiting for all players to select their memes
  if (isWaitingForPlayers) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-16 w-16 text-primary animate-spin mb-4" />
        <h1 className="font-headline text-3xl text-primary">Waiting for Players</h1>
        <p className="text-muted-foreground mt-2">Waiting for all players to select their memes...</p>
      </div>
    );
  }

  // While fetching initial data, show a loading screen.
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
          <Loader2 className="h-16 w-16 text-primary animate-spin mb-4" />
          <h1 className="font-headline text-3xl text-primary">Loading Round</h1>
          <p className="text-muted-foreground mt-2">Getting your meme ready...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Header Section */}
      <div className="text-center mb-8">
        <h1 className="font-headline text-5xl text-primary title-jackbox mb-2">Craft Your LOLympic Caption!</h1>
        <p className="text-muted-foreground text-lg mb-6">Type your wittiest line and drag it into place. You have {CAPTION_ENTRY_DURATION} seconds to impress the judges!</p>
        
        {/* Timer Bar - No box around it */}
        <div className="max-w-3xl mx-auto mb-8">
          <TimerBar durationSeconds={CAPTION_ENTRY_DURATION} onTimeUp={handleTimeUp} />
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-background/60 backdrop-blur-sm rounded-xl p-6 border border-border/50 shadow-lg max-w-4xl mx-auto">
        <CaptionInput 
          onSubmit={handleSubmitCaption} 
          memeImageUrl={memeUrl}
          isSubmitting={isSubmitting}
        />
      </div>
    </div>
  );
}
