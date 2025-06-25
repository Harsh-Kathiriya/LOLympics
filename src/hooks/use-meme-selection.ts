import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { TenorMeme } from '@/lib/tenor';
import { useToast } from '@/hooks/use-toast';
import { soundManager } from '@/lib/sound';

interface UseMemeSelectionProps {
  roomId: string;
  roomCode: string;
  roundNumber: number;
  memes: TenorMeme[];
}

interface UseMemeSelectionResult {
  selectedMemeId: string | null;
  hasSubmitted: boolean;
  isNavigating: boolean;
  handleSelectMeme: (memeId: string) => void;
  confirmSelection: () => Promise<void>;
  handleTimeUp: () => Promise<void>;
}

/**
 * Custom hook to handle meme selection and submission logic.
 */
export function useMemeSelection({
  roomId,
  roomCode,
  roundNumber,
  memes
}: UseMemeSelectionProps): UseMemeSelectionResult {
  const router = useRouter();
  const { toast } = useToast();
  
  // State for the currently selected meme's ID
  const [selectedMemeId, setSelectedMemeId] = useState<string | null>(null);
  // State to track if the user has submitted their meme
  const [hasSubmitted, setHasSubmitted] = useState(false);
  // State to track if we're in the process of navigating away
  const [isNavigating, setIsNavigating] = useState(false);

  /**
   * Submits the chosen meme to the backend. Returns true on success.
   */
  const submitMeme = useCallback(async (memeToSubmit: TenorMeme): Promise<boolean> => {
    if (!roomId || hasSubmitted) return false;

    try {
      // Get the current round ID for the room
      const { data: roundData, error: roundError } = await supabase
        .from('rounds')
        .select('id')
        .eq('room_id', roomId)
        .eq('round_number', roundNumber)
        .single();

      if (roundError || !roundData) {
        throw new Error('Could not find the current round');
      }

      // Use the new select_player_meme function
      const { error } = await supabase.rpc('select_player_meme', {
        p_round_id: roundData.id,
        p_meme_url: memeToSubmit.url,
        p_meme_name: memeToSubmit.name
      });

      if (error) throw error;

      setHasSubmitted(true);
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error selecting meme:', error);
      toast({
        title: "Submission Failed",
        description: errorMessage || "Could not submit your meme. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  }, [roomId, roundNumber, hasSubmitted, toast]);

  /**
   * Toggles the selection of a meme.
   * Clicking an already selected meme will deselect it.
   */
  const handleSelectMeme = useCallback((memeId: string) => {
    if (hasSubmitted) return; // Don't allow changes after submitting
    
    // Play settings click sound (buttonClick3) for meme selection
    if (soundManager) {
      soundManager.playSettingsClick();
    }
    
    setSelectedMemeId(prevId => memeId === prevId ? null : memeId);
  }, [hasSubmitted]);

  /**
   * Confirms the user's meme selection and submits it.
   */
  const confirmSelection = useCallback(async () => {
    if (!selectedMemeId) {
      toast({
        title: "No Meme Selected",
        description: "Please select a meme to proceed.",
        variant: "destructive",
      });
      return;
    }

    // Play button click sound
    if (soundManager) {
      soundManager.playButtonClick();
    }

    const selectedMeme = memes.find(m => m.id === selectedMemeId);
    if (selectedMeme) {
      const success = await submitMeme(selectedMeme);
      if (success) {
        toast({
          title: "Meme Submitted!",
          description: "Your choice is locked in. Waiting for other players...",
          className: 'bg-card border-primary text-card-foreground',
        });
        setIsNavigating(true);
        setTimeout(() => {
          // Go directly to caption-entry instead of meme-voting
          router.push(`/room/${roomCode}/caption-entry`);
        }, 1500);
      }
    }
  }, [selectedMemeId, memes, submitMeme, router, roomCode, toast]);

  /**
   * Handles the timer expiration event. If the user hasn't submitted a meme,
   * it automatically submits one for them. Then navigates to the next phase.
   */
  const handleTimeUp = useCallback(async () => {
    // If we've already submitted and are moving to the next page, do nothing.
    if (hasSubmitted || isNavigating) {
      return;
    }

    if (!hasSubmitted) {
      let memeToSubmit: TenorMeme | undefined;

      // Prefer the meme the user has highlighted, even if not confirmed
      if (selectedMemeId) {
        memeToSubmit = memes.find(m => m.id === selectedMemeId);
      }
      // Otherwise, pick a random one from the currently displayed list
      else if (memes.length > 0) {
        const randomIndex = Math.floor(Math.random() * memes.length);
        memeToSubmit = memes[randomIndex];
      }

      if (memeToSubmit) {
        const success = await submitMeme(memeToSubmit);
        if (success) {
          toast({
            title: "Time's up!",
            description: "Your meme choice has been submitted for you.",
            className: 'bg-card border-accent text-card-foreground',
          });
        }
      } else {
        // This is an edge case where meme list is empty. We just log it and move on.
        console.warn("No memes available to auto-select.");
      }
    }
    
    // Go directly to caption-entry instead of meme-voting
    setTimeout(() => {
      router.push(`/room/${roomCode}/caption-entry`);
    }, 1500);
  }, [hasSubmitted, isNavigating, selectedMemeId, memes, submitMeme, router, roomCode, toast]);

  return {
    selectedMemeId,
    hasSubmitted,
    isNavigating,
    handleSelectMeme,
    confirmSelection,
    handleTimeUp
  };
} 