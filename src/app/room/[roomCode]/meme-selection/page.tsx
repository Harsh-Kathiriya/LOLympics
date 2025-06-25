"use client";

import { useParams } from 'next/navigation';
import { TimerBar } from '@/components/game/timer-bar';
import { Loader2, ImageIcon, Shuffle } from 'lucide-react';

// Import custom hooks
import { useMemeSearch } from '@/hooks/use-meme-search';
import { useMemeSelection } from '@/hooks/use-meme-selection';
import { useRoomInfo } from '@/hooks/use-room-info';

// Import custom components
import { MemeGrid } from '@/components/game/meme-grid';
import { MemeSearchBar } from '@/components/game/meme-search-bar';
import { LoadMoreButton } from '@/components/game/load-more-button';
import { MemeConfirmationButton } from '@/components/game/meme-confirmation-button';
import { MemeSubmissionSuccess } from '@/components/game/meme-submission-success';
import { MEME_SELECTION_DURATION } from '@/lib/constants';

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
  
  // Use custom hooks to manage different aspects of the page
  const { roomInfo, isRoomInfoLoading } = useRoomInfo(roomCode);
  
  const { 
    memes, 
    isLoading, 
    isLoadingMore, 
    hasNextPage,
    searchTerm, 
    setSearchTerm, 
    handleSearch, 
    handleLoadMore, 
    handleShuffleMemes 
  } = useMemeSearch();
  
  // Only initialize meme selection when roomInfo is available
  const { 
    selectedMemeId, 
    hasSubmitted, 
    isNavigating,
    handleSelectMeme, 
    confirmSelection, 
    handleTimeUp 
  } = useMemeSelection({
    roomId: roomInfo?.id || '',
    roomCode,
    roundNumber: roomInfo?.current_round_number || 0,
    memes
  });

  const renderContent = () => {
    // While loading essential room info, show a generic loader
    if (isRoomInfoLoading) {
      return (
        <div className="flex justify-center items-center min-h-[400px]">
          <Loader2 className="h-16 w-16 text-primary animate-spin" />
        </div>
      );
    }

    // After the player has submitted their meme
    if (hasSubmitted) {
      return <MemeSubmissionSuccess />;
    }

    // Default view for selecting a meme
    return (
      <>
        {/* Search bar component */}
        <MemeSearchBar
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          onSearch={handleSearch}
          onShuffle={handleShuffleMemes}
          disabled={hasSubmitted || isNavigating}
        />

        {/* Meme grid component */}
        <MemeGrid
          memes={memes}
          isLoading={isLoading}
          selectedMemeId={selectedMemeId}
          onSelectMeme={handleSelectMeme}
          disabled={hasSubmitted || isNavigating}
        />

        {/* Load more button */}
        <LoadMoreButton
          onLoadMore={handleLoadMore}
          isLoading={isLoadingMore}
          hasNextPage={hasNextPage}
          disabled={hasSubmitted || isNavigating}
        />

        {/* Confirm selection button */}
        <MemeConfirmationButton
          onConfirm={confirmSelection}
          disabled={!selectedMemeId || hasSubmitted || isNavigating}
        />
      </>
    );
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Header Section */}
      <div className="text-center mb-8">
        <h1 className="font-headline text-5xl text-primary title-jackbox mb-2">Pick Your LOLympic Meme</h1>
        <p className="text-muted-foreground text-lg mb-6">Choose a meme for this round. You've got {MEME_SELECTION_DURATION} seconds before the buzzer!</p>
        
        {/* Timer Bar - No box around it */}
        <div className="max-w-3xl mx-auto mb-8">
          <TimerBar durationSeconds={MEME_SELECTION_DURATION} onTimeUp={handleTimeUp} />
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-background/60 backdrop-blur-sm rounded-xl p-6 border border-border/50 shadow-lg">
        {renderContent()}
      </div>

      {/* Tenor attribution (required by Tenor Terms) */}
      <p className="mt-4 text-center text-xs text-muted-foreground select-none">
        Powered&nbsp;By&nbsp;Tenor
      </p>
    </div>
  );
}
