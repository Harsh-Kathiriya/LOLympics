import { Button } from '@/components/ui/button';
import { Loader2, MoreHorizontal } from 'lucide-react';

interface LoadMoreButtonProps {
  onLoadMore: () => void;
  isLoading: boolean;
  hasNextPage: boolean;
  disabled?: boolean;
}

/**
 * A reusable "Load More" button component for pagination.
 */
export function LoadMoreButton({
  onLoadMore,
  isLoading,
  hasNextPage,
  disabled = false
}: LoadMoreButtonProps) {
  if (!hasNextPage) {
    return null;
  }

  return (
    <div className="flex justify-center mt-4">
      <Button 
        onClick={onLoadMore} 
        disabled={isLoading || disabled}
        variant="outline"
        className="btn-jackbox"
      >
        {isLoading ? (
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        ) : (
          <MoreHorizontal className="mr-2 h-5 w-5" />
        )}
        {isLoading ? 'Loading...' : 'Load More'}
      </Button>
    </div>
  );
} 