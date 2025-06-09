"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TimerBar } from '@/components/game/timer-bar';
import { MemeCard } from '@/components/game/meme-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Image as ImageIcon, CheckCircle, Shuffle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

// Placeholder memes
// TODO: Future Integration - Replace initialDummyMemes with dynamic data.
// Memes should be fetched from a dynamic source, such as a Supabase database
// (if you have a predefined set or allow user uploads) or an external meme API.
// The selection of memes might also depend on game settings or round.
const initialDummyMemes = [
  { id: '1', url: 'https://placehold.co/400x300.png?text=Cool+Cat', name: 'Cool Cat', dataAiHint: 'cat sunglasses' },
  { id: '2', url: 'https://placehold.co/400x300.png?text=Doge+Wow', name: 'Doge Wow', dataAiHint: 'doge meme' },
  { id: '3', url: 'https://placehold.co/400x300.png?text=Thinker', name: 'Thinker', dataAiHint: 'man thinking' },
  { id: '4', url: 'https://placehold.co/400x300.png?text=Funny+Fail', name: 'Funny Fail', dataAiHint: 'fail compilation' },
  { id: '5', url: 'https://placehold.co/400x300.png?text=Work+Life', name: 'Work Life', dataAiHint: 'office humor' },
  { id: '6', url: 'https://placehold.co/400x300.png?text=Space+Face', name: 'Space Face', dataAiHint: 'astronaut funny' },
];

export default function MemeSelectionPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const router = useRouter();
  const { toast } = useToast();
  
  const [selectedMemeId, setSelectedMemeId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [memes, setMemes] = useState(initialDummyMemes); 

  const handleTimeUp = () => {
    // TODO: Future Integration - Centralize game state transitions.
    // Timer expiration and phase changes should be managed by a central game state
    // (Supabase + Ably). The server would determine the next phase and broadcast it.
    // Clients would react to this broadcast, not self-navigate.
    toast({
      title: "Time's up!",
      description: "Moving to meme voting.",
      className: 'bg-card border-accent text-card-foreground',
    });
    router.push(`/room/${roomId}/meme-voting`);
  };

  const handleSelectMeme = (memeId: string) => {
    setSelectedMemeId(memeId === selectedMemeId ? null : memeId); // Allow deselect
  };

  const confirmSelection = () => {
    if (!selectedMemeId) {
      toast({
        title: "No Meme Selected",
        description: "Please select a meme to proceed.",
        variant: "destructive",
      });
      return;
    }
    // TODO: Future Integration - Submit selected meme and centralize game state transitions.
    // 1. The selectedMemeId should be sent to the server (Supabase) to record the choice for this round.
    // 2. The transition to the next phase (e.g., caption entry for the selected meme, then meme voting)
    //    should be a server-driven event broadcast via Ably. Clients react to this state change.
    //    The current direct navigation to 'meme-voting' might be a simplification;
    //    typically, caption entry would follow meme selection.
    toast({
      title: "Meme Selected!",
      description: `You chose ${memes.find(m=>m.id === selectedMemeId)?.name || 'a great meme'}. Waiting for others...`,
      className: 'bg-card border-primary text-card-foreground',
    });
    router.push(`/room/${roomId}/meme-voting`); 
  };
  
  const handleSearch = () => {
    if(searchTerm.trim()) {
      toast({
        title: "Search Submitted",
        description: `Searching for "${searchTerm}"... (Demo: showing new placeholder)`,
      });
      const newMeme = { id: `search-${Date.now()}`, url: `https://placehold.co/400x300.png?text=${encodeURIComponent(searchTerm.trim())}`, name: searchTerm.trim(), dataAiHint: searchTerm.trim().split(' ').slice(0,2).join(' ') };
      setMemes(prev => [newMeme, ...prev.filter(m => m.id !== newMeme.id).slice(0,5)]);
      setSearchTerm('');
    }
  };

  const handleShuffleMemes = () => {
    setMemes(prevMemes => [...prevMemes].sort(() => 0.5 - Math.random()));
     toast({
        title: "Memes Shuffled!",
        description: "Enjoy the new selection.",
        className: 'bg-card border-primary text-card-foreground',
      });
  };

  return (
    <div className="max-w-5xl mx-auto py-8">
      <Card className="shadow-2xl card-jackbox border-2 border-primary/70">
        <CardHeader className="text-center border-b-2 border-border pb-6">
          <CardTitle className="font-headline text-5xl text-primary title-jackbox">Select a Meme</CardTitle>
          <CardDescription className="font-body text-lg">Choose a meme for this round. You have 30 seconds!</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <TimerBar durationSeconds={30} onTimeUp={handleTimeUp} className="mb-8" />
          
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
              <Shuffle className="mr-2 h-5 w-5" /> Shuffle
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mb-6 min-h-[300px]">
            {memes.map(meme => (
              <MemeCard
                key={meme.id}
                memeUrl={meme.url}
                altText={meme.name}
                isSelected={selectedMemeId === meme.id}
                onClick={() => handleSelectMeme(meme.id)}
                dataAiHint={meme.dataAiHint}
                className={selectedMemeId === meme.id ? "ring-4 ring-offset-2 ring-offset-background ring-accent shadow-accent/70" : "hover:ring-2 hover:ring-primary"}
              >
                {selectedMemeId === meme.id && (
                  <div className="absolute inset-0 bg-accent/80 flex items-center justify-center rounded-sm">
                    <CheckCircle className="h-16 w-16 text-accent-foreground animate-ping" />
                     <CheckCircle className="h-16 w-16 text-accent-foreground absolute" />
                  </div>
                )}
              </MemeCard>
            ))}
          </div>
           <div className="flex justify-end mt-8">
            <Button 
              size="lg" 
              onClick={confirmSelection} 
              disabled={!selectedMemeId}
              className="font-bold text-lg bg-accent hover:bg-accent/80 text-accent-foreground btn-jackbox min-w-[200px] h-14"
            >
              Confirm Selection <ImageIcon className="ml-2 h-6 w-6" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
