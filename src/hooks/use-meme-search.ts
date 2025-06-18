import { useState, useCallback, useEffect } from 'react';
import { getTrendingTenorMemes, searchTenorMemes, TenorMeme } from '@/lib/tenor';
import { useToast } from '@/hooks/use-toast';

interface UseMemeSearchResult {
  memes: TenorMeme[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasNextPage: boolean;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  handleSearch: () => void;
  handleLoadMore: () => void;
  handleShuffleMemes: () => void;
}

/**
 * Custom hook to handle meme search functionality.
 * Manages loading states, pagination, and search term.
 */
export function useMemeSearch(): UseMemeSearchResult {
  // State for managing the list of memes displayed
  const [memes, setMemes] = useState<TenorMeme[]>([]);
  // State for the user's input in the search bar
  const [searchTerm, setSearchTerm] = useState('');
  // State to track loading status for initial meme fetch or new searches
  const [isLoading, setIsLoading] = useState(true);
  // State to track loading status for the "Load More" action
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // State to hold the pagination cursor from Tenor API for loading the next page
  const [nextPagePos, setNextPagePos] = useState<string | undefined>(undefined);
  // State to keep track of the active search query for pagination
  const [currentSearchTerm, setCurrentSearchTerm] = useState<string>('');
  
  const { toast } = useToast();

  /**
   * Fetches memes from the Tenor API.
   * Can fetch either trending memes (if query is empty) or search results.
   * Handles both initial fetches and paginated "load more" fetches.
   */
  const fetchMemes = useCallback(async (query: string, pos?: string) => {
    // Differentiate between a new search and loading more for UI feedback
    if (pos) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    
    try {
      // Call the appropriate Tenor API function based on whether there's a search query
      const result = query
        ? await searchTenorMemes(query, 24, pos)
        : await getTrendingTenorMemes(24, pos);
      
      // If paginating, append results; otherwise, replace the list
      setMemes(prev => {
        if (pos) {
          // Create a Set of existing meme IDs for efficient lookup
          const existingMemeIds = new Set(prev.map((m: TenorMeme) => m.id));
          // Filter out any new memes that are already in the list to prevent key errors
          const uniqueNewMemes = result.memes.filter((m: TenorMeme) => !existingMemeIds.has(m.id));
          return [...prev, ...uniqueNewMemes];
        }
        // For a new search, just replace the list
        return result.memes;
      });
      setNextPagePos(result.next); // Store the cursor for the next page
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error("Failed to fetch memes from Tenor:", error);
      toast({
        title: "Error Fetching Memes",
        description: errorMessage || "Could not load memes from Tenor. Please try again.",
        variant: "destructive",
      });
      // Clear memes on a new search error to avoid showing stale results
      if (!pos) setMemes([]); 
    } finally {
      // Reset loading states regardless of outcome
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [toast]);

  // Effect to fetch initial trending memes when the hook is initialized
  useEffect(() => {
    fetchMemes('');
  }, [fetchMemes]);

  /**
   * Initiates a new meme search based on the current search term.
   */
  const handleSearch = useCallback(() => {
    const query = searchTerm.trim();
    if (query) {
      // Store the query for pagination purposes
      setCurrentSearchTerm(query);
      // Fetch new results, replacing the old ones
      fetchMemes(query);
    }
  }, [searchTerm, fetchMemes]);

  /**
   * Loads the next page of results for the current search or for trending memes.
   */
  const handleLoadMore = useCallback(() => {
    if (nextPagePos) {
      fetchMemes(currentSearchTerm, nextPagePos);
    }
  }, [currentSearchTerm, nextPagePos, fetchMemes]);

  /**
   * Resets the view to show the latest trending memes.
   * Clears any active search.
   */
  const handleShuffleMemes = useCallback(() => {
    setSearchTerm('');
    setCurrentSearchTerm('');
    fetchMemes('');
    toast({
      title: "Refreshed!",
      description: "Showing trending memes.",
      className: 'bg-card border-primary text-card-foreground',
    });
  }, [fetchMemes, toast]);

  return {
    memes,
    isLoading,
    isLoadingMore,
    hasNextPage: !!nextPagePos,
    searchTerm,
    setSearchTerm,
    handleSearch,
    handleLoadMore,
    handleShuffleMemes
  };
} 