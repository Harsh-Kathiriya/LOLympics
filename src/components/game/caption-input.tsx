"use client";

import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Send, Loader2 } from 'lucide-react';
import { soundManager } from '@/lib/sound';

interface CaptionInputProps {
  /** Function to call when the user submits their caption. */
  onSubmit: (caption: string) => void;
  /** The maximum allowed length for the caption. Defaults to 150. */
  maxLength?: number;
  /** The URL of the meme image to be displayed above the input. */
  memeImageUrl: string;
  /** If true, the input and button will be disabled, and a loader will be shown. */
  isSubmitting?: boolean;
}

/**
 * A reusable form component for entering a caption for a meme.
 * It includes the meme image, a text area for input, a character counter,
 * and a submit button that shows a loading state.
 */
export function CaptionInput({ onSubmit, maxLength = 150, memeImageUrl, isSubmitting = false }: CaptionInputProps) {
  const [caption, setCaption] = useState('');
  const charsLeft = maxLength - caption.length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (caption.trim() && !isSubmitting) {
      // Play button click sound
      if (soundManager) {
        soundManager.playButtonClick();
      }
      
      onSubmit(caption.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-lg overflow-hidden shadow-lg border border-border">
        <img src={memeImageUrl} alt="Meme to caption" className="w-full max-h-[400px] object-contain bg-black" data-ai-hint="funny meme" />
      </div>
      <div>
        <Label htmlFor="caption-input" className="block text-lg font-medium text-primary mb-2 font-headline">
          Enter Your Caption
        </Label>
        <Textarea
          id="caption-input"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Make it witty, make it funny!"
          maxLength={maxLength}
          className="min-h-[100px] text-base p-4 rounded-md shadow-sm focus:ring-accent focus:border-accent"
          aria-describedby="char-count"
          readOnly={isSubmitting}
        />
        <div id="char-count" className="text-sm text-muted-foreground mt-2 text-right">
          {charsLeft} / {maxLength} characters remaining
        </div>
      </div>
      <Button type="submit" size="lg" className="w-full font-bold text-lg bg-accent hover:bg-accent/90 text-accent-foreground" disabled={!caption.trim() || isSubmitting}>
        {isSubmitting && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
        {isSubmitting ? 'Submitting...' : 'Submit Caption'}
        {!isSubmitting && <Send className="ml-2 h-5 w-5" />}
      </Button>
    </form>
  );
}
