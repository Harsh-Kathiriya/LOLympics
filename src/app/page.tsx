"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, LogIn, ArrowRight, User } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabase';
import { useAbly } from '@/components/AblyContext';

export default function HomePage() {
  const [roomCode, setRoomCode] = useState('');
  const [username, setUsername] = useState('');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const { initializeAbly } = useAbly();

  useEffect(() => {
    const signInAnonymously = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const { error } = await supabase.auth.signInAnonymously();
        if (error) {
          toast({
            title: "Authentication Error",
            description: "Could not sign in anonymously. Please refresh the page.",
            variant: "destructive",
          });
          console.error("Anonymous sign-in error:", error);
          return;
        }
      }
      setIsAuthenticated(true);
    };

    signInAnonymously();
  }, [toast]);

  const ensureAuthenticated = async () => {
    if (isAuthenticated) return true;
    
    toast({
      title: "Authenticating...",
      description: "Please wait a moment while we get things ready.",
    });

    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setIsAuthenticated(true);
      return true;
    }
    
    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
       toast({
        title: "Authentication Failed",
        description: "Could not authenticate your session. Please try again.",
        variant: "destructive",
      });
      return false;
    }

    setIsAuthenticated(true);
    return true;
  };

  const handleCreateRoom = async () => {
    if (!(await ensureAuthenticated())) return;

    if (!username.trim()) {
      toast({
        title: "Username Required",
        description: "Please enter a username to create a room.",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingRoom(true);

    try {
      const { data, error } = await supabase.rpc('create_room', { p_username: username.trim() });

      if (error) {
        console.error('Error creating room:', error);
        toast({
          title: "Error Creating Room",
          description: error.message || "An unexpected error occurred. Please try again.",
          variant: "destructive",
        });
        return;
      }

      if (data && data.length > 0) {
        const { new_room_id, generated_room_code } = data[0];
        
        initializeAbly();
        
        toast({
          title: "Room Created!",
          description: `Room Code: ${generated_room_code}. Share this code with your friends! Redirecting...`,
          className: 'bg-card border-primary text-card-foreground',
          duration: 5000,
        });
        router.push(`/room/${generated_room_code}`);
      } else {
        toast({
          title: "Error Creating Room",
          description: "Could not retrieve room details. Please try again.",
          variant: "destructive",
        });
      }
    } catch (e: any) {
      console.error('Unexpected error during room creation:', e);
      toast({
        title: "Unexpected Error",
        description: e.message || "An unexpected error occurred. Please check console.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!(await ensureAuthenticated())) return;

    if (!username.trim()) {
      toast({
        title: "Username Required",
        description: "Please enter a username to join a room.",
        variant: "destructive",
      });
      return;
    }

    if (!roomCode.trim()) {
      toast({
        title: "Room Code Required",
        description: "Please enter a room code to join.",
        variant: "destructive",
      });
      return;
    }

    setIsJoiningRoom(true);

    try {
      const { data, error } = await supabase.rpc('join_room', {
        p_room_code: roomCode.trim().toUpperCase(),
        p_username: username.trim(),
      });

      if (error || (data && data[0].error_message)) {
        const message = error?.message || data[0].error_message;
        console.error('Error joining room:', message);
        toast({
          title: "Error Joining Room",
          description: message,
          variant: "destructive",
        });
        return;
      }

      if (data && data.length > 0 && data[0].joined_room_id) {
        const { joined_room_id } = data[0];
        
        initializeAbly();
        
        toast({
          title: "Joined Room!",
          description: `Successfully joined room. Redirecting...`,
          className: 'bg-card border-secondary text-card-foreground',
        });
        router.push(`/room/${roomCode.trim().toUpperCase()}`);
      } else {
        toast({
          title: "Error Joining Room",
          description: "Could not join the room. Please check the code and try again.",
          variant: "destructive",
        });
      }
    } catch (e: any) {
      console.error('Unexpected error during room join:', e);
      toast({
        title: "Unexpected Error",
        description: e.message || "An unexpected error occurred. Please check console.",
        variant: "destructive",
      });
    } finally {
      setIsJoiningRoom(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] py-12">
      <div className="text-center mb-8">
        <h1 className="font-headline text-7xl font-bold text-primary animate-pulse title-jackbox">
          Caption Clash
        </h1>
        <p className="text-muted-foreground text-xl mt-2 font-body">
          The Ultimate Multiplayer Meme Captioning Game
        </p>
      </div>

      <div className="w-full max-w-sm mb-8">
          <Card className="card-jackbox border-muted">
              <CardHeader className="p-4">
                  <label htmlFor="username" className="text-lg font-medium text-muted-foreground font-headline flex items-center justify-center">
                      <User className="mr-3 h-6 w-6" /> First, Enter Your Nickname
                  </label>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                  <Input
                      id="username"
                      type="text"
                      placeholder="Your cool nickname..."
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="h-14 text-center text-xl border-2 border-input focus:border-accent placeholder:text-muted-foreground/70 font-body"
                      maxLength={20}
                  />
              </CardContent>
          </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        <Card className="card-jackbox border-primary hover:border-accent">
          <CardHeader>
            <CardTitle className="font-headline text-3xl flex items-center text-accent">
              <PlusCircle className="mr-3 h-8 w-8" />
              Create a New Room
            </CardTitle>
            <CardDescription className="font-body">
              Start a new game and invite your friends to the clash!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-body text-sm text-muted-foreground">Enter a nickname above, then click here to start a new game.</p>
          </CardContent>
          <CardFooter>
            <Button
              size="lg"
              className="w-full font-bold text-lg group btn-jackbox bg-primary text-primary-foreground hover:bg-primary/80"
              onClick={handleCreateRoom}
              disabled={isCreatingRoom || !isAuthenticated}
            >
              {isCreatingRoom ? 'Creating Room...' : 'Create Room'}
              {!isCreatingRoom && <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />}
            </Button>
          </CardFooter>
        </Card>

        <Card className="card-jackbox border-secondary hover:border-accent">
          <CardHeader>
            <CardTitle className="font-headline text-3xl flex items-center text-accent">
              <LogIn className="mr-3 h-8 w-8" />
              Join an Existing Room
            </CardTitle>
            <CardDescription className="font-body">
              Got a room code? Enter it here to join the fun!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              type="text"
              placeholder="ENTER ROOM CODE"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              className="text-center text-xl font-code tracking-widest h-14 border-2 border-input focus:border-accent placeholder:text-muted-foreground/70"
              maxLength={6}
            />
          </CardContent>
          <CardFooter>
            <Button
              size="lg"
              variant="secondary"
              className="w-full font-bold text-lg group btn-jackbox bg-secondary text-secondary-foreground hover:bg-secondary/80"
              onClick={handleJoinRoom}
              disabled={isJoiningRoom || !isAuthenticated}
            >
              {isJoiningRoom ? 'Joining Room...' : 'Join Room'}
              {!isJoiningRoom && <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />}
            </Button>
          </CardFooter>
        </Card>
      </div>
       <p className="mt-12 text-sm text-muted-foreground">
          Tip: Press <kbd className="kbd-jackbox">Ctrl/Cmd</kbd> + <kbd className="kbd-jackbox">B</kbd> to toggle sidebar
        </p>
    </div>
  );
}
