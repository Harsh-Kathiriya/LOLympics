import { MemeCard } from '@/components/game/meme-card';
import { TenorMeme } from '@/lib/tenor';
import { CheckCircle, Loader2 } from 'lucide-react';

interface MemeGridProps {
  memes: TenorMeme[];
  isLoading: boolean;
  selectedMemeId: string | null;
  onSelectMeme: (memeId: string) => void;
  disabled?: boolean;
}

/**
 * A reusable grid component for displaying memes.
 * Handles loading states and selection of memes.
 */
export function MemeGrid({
  memes,
  isLoading,
  selectedMemeId,
  onSelectMeme,
  disabled = false
}: MemeGridProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[300px]">
        <Loader2 className="h-16 w-16 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-6 min-h-[300px]">
      {memes.map(meme => (
        <MemeCard
          key={meme.id}
          memeUrl={meme.url}
          altText={meme.name}
          isSelected={selectedMemeId === meme.id}
          onClick={() => !disabled && onSelectMeme(meme.id)}
          className={selectedMemeId === meme.id 
            ? "ring-4 ring-offset-2 ring-offset-background ring-accent shadow-accent/70" 
            : "hover:ring-2 hover:ring-primary"
          }
        >
          {/* Visual feedback for selected meme */}
          {selectedMemeId === meme.id && (
            <div className="absolute inset-0 bg-accent/80 flex items-center justify-center rounded-sm">
              <CheckCircle className="h-12 w-12 text-accent-foreground animate-ping" />
              <CheckCircle className="h-12 w-12 text-accent-foreground absolute" />
            </div>
          )}
        </MemeCard>
      ))}
    </div>
  );
} 