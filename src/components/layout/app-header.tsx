
"use client";

import Link from 'next/link';
import { Gamepad2, SlidersHorizontal, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SettingsContent } from './settings-content';
import { TutorialContent } from './tutorial-content';

export function AppHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/50">
      <div className="container flex h-16 max-w-screen-2xl items-center justify-between">
        <Link href="/" className="flex items-center space-x-2 group">
          <Gamepad2 className="h-8 w-8 text-primary group-hover:text-accent transition-colors duration-300 transform group-hover:rotate-[-15deg]" />
          <span className="font-headline text-2xl font-bold text-primary group-hover:text-accent transition-colors duration-300">Caption Clash</span>
        </Link>
        <div className="flex items-center gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="How to Play" className="text-muted-foreground hover:text-accent btn-jackbox">
                <HelpCircle className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent className="bg-card border-accent/50 text-card-foreground w-full max-w-md overflow-y-auto">
              <SheetHeader className="mb-6">
                <SheetTitle className="font-headline text-3xl text-accent title-jackbox flex items-center">
                  <HelpCircle className="mr-3 h-8 w-8" /> How to Play
                </SheetTitle>
                <SheetDescription className="font-body text-muted-foreground/80">
                  Get ready to clash! Here's the lowdown on becoming a caption champion.
                </SheetDescription>
              </SheetHeader>
              <TutorialContent />
            </SheetContent>
          </Sheet>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Settings" className="text-muted-foreground hover:text-accent btn-jackbox">
                <SlidersHorizontal className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent className="bg-card border-accent/50 text-card-foreground w-full max-w-md">
              <SheetHeader className="mb-6">
                <SheetTitle className="font-headline text-3xl text-accent title-jackbox flex items-center">
                  <SlidersHorizontal className="mr-3 h-8 w-8" /> Settings
                </SheetTitle>
                <SheetDescription className="font-body text-muted-foreground/80">
                  Customize your Caption Clash experience.
                </SheetDescription>
              </SheetHeader>
              <SettingsContent />
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
