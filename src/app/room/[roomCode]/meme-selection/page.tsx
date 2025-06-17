"use client";

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TimerBar } from '@/components/game/timer-bar';
import { MemeCard } from '@/components/game/meme-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Image as ImageIcon, CheckCircle, Shuffle, Loader2, MoreHorizontal } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { getTrendingTenorMemes, searchTenorMemes, TenorMeme } from '@/lib/tenor';
import { supabase } from '@/lib/supabase';

/**
 * MemeSelectionPage Component
 * 
 * This page allows players to select a meme for the current round.
 * It fetches memes from the Tenor API, allowing users to search, view trending memes,
 * and load more results. Once a meme is chosen, it's submitted for the next phase.
 */
export default function MemeSelectionPage() {
  const params = useParams();
  const roomCode = params.roomCode as string;
  const router = useRouter();
  const { toast } = useToast();
  
  // State for the room's DB info (ID and round number)
  const [roomInfo, setRoomInfo] = useState<{ id: string; current_round_number: number } | null>(null);
  const [isRoomInfoLoading, setIsRoomInfoLoading] = useState(true);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  // State for managing the list of memes displayed
  const [memes, setMemes] = useState<TenorMeme[]>([]);
  // State for the currently selected meme's ID
  const [selectedMemeId, setSelectedMemeId] = useState<string | null>(null);
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

  // Fetch essential room data (ID, round number) from Supabase on load
  useEffect(() => {
    const fetchRoomInfo = async () => {
        if (!roomCode) return;
        setIsRoomInfoLoading(true);
        try {
            const { data, error } = await supabase
                .from('rooms')
                .select('id, current_round_number')
                .eq('room_code', roomCode)
                .single();

            if (error) throw error;
            if (data) {
                setRoomInfo(data);
            }
        } catch (error: any) {
            console.error('Error fetching room info:', error);
            toast({
                title: 'Error Loading Room',
                description: 'Could not load room details. Please try refreshing.',
                variant: 'destructive'
            });
        } finally {
            setIsRoomInfoLoading(false);
        }
    };

    fetchRoomInfo();
  }, [roomCode, toast]);

  /**
   * Fetches memes from the Tenor API.
   * Can fetch either trending memes (if query is empty) or search results.
   * Handles both initial fetches and paginated "load more" fetches.
   * @param query The search term. An empty string fetches trending memes.
   * @param pos The pagination cursor for fetching the next set of results.
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
      setMemes(prev => pos ? [...prev, ...result.memes] : result.memes);
      setNextPagePos(result.next); // Store the cursor for the next page
    } catch (error: any) {
      console.error("Failed to fetch memes from Tenor:", error);
      toast({
        title: "Error Fetching Memes",
        description: error.message || "Could not load memes from Tenor. Please check your API key.",
        variant: "destructive",
      });
      // Clear memes on a new search error to avoid showing stale results
      if (!pos) setMemes([]); 
    } finally {
      // Reset loading states regardless of outcome
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [toast]); // Dependency on `toast` for error handling

  // Effect to fetch initial trending memes when the component mounts.
  useEffect(() => {
    fetchMemes('');
  }, [fetchMemes]); // Depends on the memoized `fetchMemes` function

  /**
   * Submits the chosen meme to the backend. Returns true on success.
   * @param memeToSubmit The meme object to be submitted.
   */
  const submitMeme = useCallback(async (memeToSubmit: TenorMeme): Promise<boolean> => {
    if (!roomInfo || hasSubmitted) return false;

    try {
        const { error } = await supabase.rpc('propose_meme', {
            p_room_id: roomInfo.id,
            p_round_number: roomInfo.current_round_number,
            p_meme_url: memeToSubmit.url,
            p_meme_name: memeToSubmit.name
        });

        if (error) throw error;

        setHasSubmitted(true);
        return true;
    } catch (error: any) {
        console.error('Error proposing meme:', error);
        toast({
            title: "Submission Failed",
            description: error.message || "Could not submit your meme. Please try again.",
            variant: "destructive",
        });
        return false;
    }
  }, [roomInfo, hasSubmitted, toast]);

  /**
   * Handles the timer expiration event. If the user hasn't submitted a meme,
   * it automatically submits one for them. Then navigates to the next phase.
   */
  const handleTimeUp = useCallback(async () => {
    // If we've already submitted and are moving to the next page, do nothing.
    if (hasSubmitted || isNavigating) {
        return;
    }

    if (!hasSubmitted) {
      let memeToSubmit: TenorMeme | undefined;

      // Prefer the meme the user has highlighted, even if not confirmed
      if (selectedMemeId) {
          memeToSubmit = memes.find(m => m.id === selectedMemeId);
      }
      // Otherwise, pick a random one from the currently displayed list
      else if (memes.length > 0) {
          const randomIndex = Math.floor(Math.random() * memes.length);
          memeToSubmit = memes[randomIndex];
      }

      if (memeToSubmit) {
          const success = await submitMeme(memeToSubmit);
          if (success) {
            toast({
              title: "Time's up!",
                          description: "Your meme choice has been submitted for you.",
              className: 'bg-card border-accent text-card-foreground',
            });
          }
      } else {
        // This is an edge case where meme list is empty. We just log it and move on.
        console.warn("No memes available to auto-select.");
      }
    }
    
    // TODO: This navigation will eventually be driven by a real-time Ably event.
    // A delay is added to allow the user to see any final toasts.
    setTimeout(() => {
        router.push(`/room/${roomCode}/meme-voting`);
    }, 1500);
  }, [hasSubmitted, isNavigating, selectedMemeId, memes, submitMeme, router, roomCode, toast]);

  /**
   * Toggles the selection of a meme.
   * Clicking an already selected meme will deselect it.
   * @param memeId The ID of the meme being clicked.
   */
  const handleSelectMeme = (memeId: string) => {
    if (hasSubmitted) return; // Don't allow changes after submitting
    setSelectedMemeId(memeId === selectedMemeId ? null : memeId);
  };

  /**
   * Confirms the user's meme selection and submits it.
   */
  const confirmSelection = async () => {
    if (!selectedMemeId) {
      toast({
        title: "No Meme Selected",
        description: "Please select a meme to proceed.",
        variant: "destructive",
      });
      return;
    }

    const selectedMeme = memes.find(m => m.id === selectedMemeId);
    if (selectedMeme) {
      const success = await submitMeme(selectedMeme);
      if (success) {
        toast({
            title: "Meme Submitted!",
            description: "Your choice is locked in. Waiting for other players...",
            className: 'bg-card border-primary text-card-foreground',
        });
        setIsNavigating(true);
        setTimeout(() => {
            router.push(`/room/${roomCode}/meme-voting`);
        }, 1500);
      }
    }
  };
  
  /**
   * Initiates a new meme search based on the current search term.
   */
  const handleSearch = () => {
    const query = searchTerm.trim();
    if (query) {
      // Store the query for pagination purposes
      setCurrentSearchTerm(query);
      // Fetch new results, replacing the old ones
      fetchMemes(query);
    }
  };

  /**
   * Loads the next page of results for the current search or for trending memes.
   */
  const handleLoadMore = () => {
    if (nextPagePos) {
      fetchMemes(currentSearchTerm, nextPagePos);
    }
  };

  /**
   * Resets the view to show the latest trending memes.
   * Clears any active search.
   */
  const handleShuffleMemes = () => {
    setSearchTerm('');
    setCurrentSearchTerm('');
    fetchMemes('');
     toast({
      title: "Refreshed!",
      description: "Showing trending memes.",
        className: 'bg-card border-primary text-card-foreground',
      });
  };

  const renderContent = () => {
    // While loading essential room info, show a generic loader.
    if (isRoomInfoLoading) {
      return (
        <div className="flex justify-center items-center min-h-[400px]">
          <Loader2 className="h-16 w-16 text-primary animate-spin" />
        </div>
      );
    }

    // After the player has submitted their meme
    if (hasSubmitted) {
      return (
        <div className="text-center min-h-[400px] flex flex-col justify-center items-center">
            <CheckCircle className="h-20 w-20 text-green-500 mb-4" />
            <h2 className="text-3xl font-headline text-primary">Submission Received!</h2>
            <p className="text-muted-foreground mt-2">Waiting for other players to choose their memes.</p>
            <p className="text-muted-foreground mt-1">The next round will begin shortly.</p>
        </div>
      );
    }

    // Default view for selecting a meme
    return (
      <>
        {/* Search and action buttons */}
          <div className="mb-6 flex flex-col sm:flex-row gap-3">
            <Input 
              type="text"
              placeholder="Search for memes (e.g., 'funny cat')"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-grow h-12 text-base border-2 border-input focus:border-accent placeholder:text-muted-foreground/70"
            />
            <Button onClick={handleSearch} size="lg" variant="secondary" className="btn-jackbox h-12">
              <Search className="mr-2 h-5 w-5" /> Search
            </Button>
            <Button onClick={handleShuffleMemes} size="lg" variant="outline" className="btn-jackbox h-12">
            <Shuffle className="mr-2 h-5 w-5" /> Trending
            </Button>
          </div>

        {/* Conditional rendering for Tenor API loading state vs. meme grid */}
        {isLoading ? (
          <div className="flex justify-center items-center min-h-[300px]">
            <Loader2 className="h-16 w-16 text-primary animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-6 min-h-[300px]">
            {/* Map over the fetched memes and render a card for each */}
            {memes.map(meme => (
              <MemeCard
                key={meme.id}
                memeUrl={meme.url}
                altText={meme.name}
                isSelected={selectedMemeId === meme.id}
                onClick={() => handleSelectMeme(meme.id)}
                className={selectedMemeId === meme.id ? "ring-4 ring-offset-2 ring-offset-background ring-accent shadow-accent/70" : "hover:ring-2 hover:ring-primary"}
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
        )}

        {/* "Load More" button, shown only if there are more results and not currently loading */}
        <div className="flex justify-center mt-4">
          {nextPagePos && !isLoading && (
            <Button 
              onClick={handleLoadMore} 
              disabled={isLoadingMore}
              variant="outline"
              className="btn-jackbox"
            >
              {isLoadingMore ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <MoreHorizontal className="mr-2 h-5 w-5" />}
              {isLoadingMore ? 'Loading...' : 'Load More'}
            </Button>
          )}
        </div>

         {/* Confirm selection button, enabled only when a meme is selected */}
         <div className="flex justify-end mt-8">
            <Button 
              size="lg" 
              onClick={confirmSelection} 
            disabled={!selectedMemeId || hasSubmitted}
              className="font-bold text-lg bg-accent hover:bg-accent/80 text-accent-foreground btn-jackbox min-w-[200px] h-14"
            >
              Confirm Selection <ImageIcon className="ml-2 h-6 w-6" />
            </Button>
          </div>
      </>
    );
  };

  return (
    <div className="max-w-5xl mx-auto py-8">
      <Card className="shadow-2xl card-jackbox border-2 border-primary/70">
        <CardHeader className="text-center border-b-2 border-border pb-6">
          <CardTitle className="font-headline text-5xl text-primary title-jackbox">Select a Meme</CardTitle>
          <CardDescription className="font-body text-lg">Choose a meme for this round. You have 30 seconds!</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {/* Timer bar is always visible for the phase */}
          <TimerBar durationSeconds={30} onTimeUp={handleTimeUp} className="mb-8" />
          {renderContent()}
        </CardContent>
      </Card>
    </div>
  );
}
