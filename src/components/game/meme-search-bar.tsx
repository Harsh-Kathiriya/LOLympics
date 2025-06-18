import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Shuffle } from 'lucide-react';

interface MemeSearchBarProps {
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  onSearch: () => void;
  onShuffle: () => void;
  disabled?: boolean;
}

/**
 * A reusable search bar component for meme search functionality.
 * Includes search input, search button, and trending/shuffle button.
 */
export function MemeSearchBar({
  searchTerm,
  onSearchTermChange,
  onSearch,
  onShuffle,
  disabled = false
}: MemeSearchBarProps) {
  return (
    <div className="mb-6 flex flex-col sm:flex-row gap-3">
      <Input 
        type="text"
        placeholder="Search for memes (e.g., 'funny cat')"
        value={searchTerm}
        onChange={(e) => onSearchTermChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && !disabled && onSearch()}
        className="flex-grow h-12 text-base border-2 border-input focus:border-accent placeholder:text-muted-foreground/70"
        disabled={disabled}
      />
      <Button 
        onClick={onSearch} 
        size="lg" 
        variant="secondary" 
        className="btn-jackbox h-12"
        disabled={disabled}
      >
        <Search className="mr-2 h-5 w-5" /> Search
      </Button>
      <Button 
        onClick={onShuffle} 
        size="lg" 
        variant="outline" 
        className="btn-jackbox h-12"
        disabled={disabled}
      >
        <Shuffle className="mr-2 h-5 w-5" /> Trending
      </Button>
    </div>
  );
} 