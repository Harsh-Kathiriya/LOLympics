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
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/50 shadow-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 group" aria-label="Caption Clash Home">
          <Gamepad2 className="h-7 w-7 text-primary transition-transform duration-300 group-hover:-rotate-12 group-hover:text-accent" />
          <span className="font-headline text-xl font-bold text-primary transition-colors duration-300 group-hover:text-accent">Caption Clash</span>
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="How to Play" className="rounded-full p-2 text-muted-foreground hover:bg-accent/10 hover:text-accent transition-colors">
                <HelpCircle className="h-5 w-5" />
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
              <Button variant="ghost" size="icon" aria-label="Settings" className="rounded-full p-2 text-muted-foreground hover:bg-accent/10 hover:text-accent transition-colors">
                <SlidersHorizontal className="h-5 w-5" />
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
