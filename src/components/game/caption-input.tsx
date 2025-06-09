"use client";

import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';

interface CaptionInputProps {
  onSubmit: (caption: string) => void;
  maxLength?: number;
  memeImageUrl: string;
}

export function CaptionInput({ onSubmit, maxLength = 150, memeImageUrl }: CaptionInputProps) {
  const [caption, setCaption] = useState('');
  const charsLeft = maxLength - caption.length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (caption.trim()) {
      onSubmit(caption.trim());
      setCaption(''); // Clear after submit
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
        />
        <div id="char-count" className="text-sm text-muted-foreground mt-2 text-right">
          {charsLeft} / {maxLength} characters remaining
        </div>
      </div>
      <Button type="submit" size="lg" className="w-full font-bold text-lg bg-accent hover:bg-accent/90 text-accent-foreground" disabled={!caption.trim()}>
        Submit Caption <Send className="ml-2 h-5 w-5" />
      </Button>
    </form>
  );
}
