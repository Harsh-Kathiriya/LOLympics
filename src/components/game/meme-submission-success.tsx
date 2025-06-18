import { CheckCircle } from 'lucide-react';

/**
 * A component to display when a meme has been successfully submitted.
 */
export function MemeSubmissionSuccess() {
  return (
    <div className="text-center min-h-[400px] flex flex-col justify-center items-center">
      <CheckCircle className="h-20 w-20 text-green-500 mb-4" />
      <h2 className="text-3xl font-headline text-primary">Submission Received!</h2>
      <p className="text-muted-foreground mt-2">Waiting for other players to choose their memes.</p>
      <p className="text-muted-foreground mt-1">The next round will begin shortly.</p>
    </div>
  );
} 