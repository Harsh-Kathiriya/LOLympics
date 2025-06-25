"use client";

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface CaptionCardProps {
  captionText: string;
  captionNumber: number;
  isVoted?: boolean;
  className?: string;
  memeImageUrl?: string; // Optional meme image URL to display with caption
  positionX?: number; // Horizontal position (0-100%)
  positionY?: number; // Vertical position (0-100%)
  showOverlay?: boolean; // Whether to show caption as overlay on meme
}

/**
 * A component to display a caption, either as a standalone card or overlaid on a meme.
 * In voting mode, it displays as a standalone card with a number.
 * In results mode, it can display the caption overlaid on the meme at the specified position.
 */
export function CaptionCard({
  captionText,
  captionNumber,
  isVoted,
  className,
  memeImageUrl,
  positionX = 50,
  positionY = 50,
  showOverlay = false
}: CaptionCardProps) {
  // If we have a meme image and should show overlay, display the caption on the meme
  if (memeImageUrl && showOverlay) {
    return (
      <Card className={cn(
        "flex flex-col shadow-lg hover:shadow-primary/30 transition-all overflow-hidden", 
        className, 
        isVoted && "ring-4 ring-offset-2 ring-offset-background ring-accent"
      )}>
        <CardContent className="p-0 relative">
          <Image
            src={memeImageUrl}
            alt={`Meme with caption ${captionNumber}`}
            width={800}
            height={600}
            className="w-full object-contain bg-black max-h-[400px]"
            sizes="(max-width: 768px) 100vw, 800px"
            priority
          />
          <div 
            className="absolute p-2 bg-black/70 text-white font-bold text-center rounded"
            style={{
              left: `${positionX}%`,
              top: `${positionY}%`,
              transform: 'translate(-50%, -50%)',
              maxWidth: '80%',
              textShadow: '1px 1px 2px black'
            }}
          >
            {captionText}
          </div>
          <div className="absolute top-2 left-2 flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground font-bold text-lg font-headline">
            {captionNumber}
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Default: display as a standalone card
  return (
    <Card className={cn(
      "flex flex-col justify-between h-full shadow-lg hover:shadow-primary/30 transition-all overflow-hidden", 
      className, 
      isVoted && "ring-4 ring-offset-2 ring-offset-background ring-accent"
    )}>
      <CardContent className="p-4 flex-grow">
        <div className="flex items-start space-x-3">
          <span className="flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground font-bold text-lg font-headline">
            {captionNumber}
          </span>
          <p className="text-lg font-medium leading-relaxed">{captionText}</p>
        </div>
      </CardContent>
    </Card>
  );
}