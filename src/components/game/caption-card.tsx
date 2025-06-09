"use client";

import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ThumbsUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CaptionCardProps {
  captionText: string;
  captionNumber: number;
  onVote?: (captionNumber: number) => void;
  isVoted?: boolean;
  votesCount?: number;
  showVotes?: boolean;
  className?: string;
}

export function CaptionCard({
  captionText,
  captionNumber,
  onVote,
  isVoted,
  votesCount,
  showVotes = false,
  className,
}: CaptionCardProps) {
  return (
    <Card className={cn("flex flex-col justify-between h-full shadow-lg hover:shadow-primary/30 transition-shadow", className, isVoted && "ring-2 ring-accent")}>
      <CardContent className="p-4 flex-grow">
        <div className="flex items-start space-x-3">
          <span className="flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground font-bold text-lg font-headline">
            {captionNumber}
          </span>
          <p className="text-lg font-medium leading-relaxed">{captionText}</p>
        </div>
      </CardContent>
      {(onVote || showVotes) && (
        <CardFooter className="p-3 border-t">
          {onVote && (
            <Button 
              variant={isVoted ? "default" : "outline"} 
              size="sm" 
              className="w-full" 
              onClick={() => onVote(captionNumber)}
              disabled={isVoted}
            >
              <ThumbsUp className="mr-2 h-4 w-4" /> {isVoted ? 'Voted!' : 'Vote'}
            </Button>
          )}
          {showVotes && votesCount !== undefined && (
            <div className="flex items-center text-sm text-muted-foreground w-full justify-center">
              <ThumbsUp className="mr-1 h-4 w-4 text-accent" /> {votesCount} {votesCount === 1 ? 'Vote' : 'Votes'}
            </div>
          )}
        </CardFooter>
      )}
    </Card>
  );
}
