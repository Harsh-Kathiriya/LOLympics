"use client";

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface CaptionCardProps {
  captionText: string;
  captionNumber: number;
  isVoted?: boolean;
  className?: string;
}

export function CaptionCard({
  captionText,
  captionNumber,
  isVoted,
  className,
}: CaptionCardProps) {
  return (
    <Card className={cn(
      "flex flex-col justify-between h-full shadow-lg hover:shadow-primary/30 transition-all", 
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