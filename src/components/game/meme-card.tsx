"use client";

import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface MemeCardProps {
  memeUrl: string;
  altText?: string;
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
  dataAiHint?: string;
  children?: React.ReactNode;
}

export function MemeCard({
  memeUrl,
  altText = "Meme image",
  isSelected,
  onClick,
  className,
  dataAiHint = "funny meme",
  children,
}: MemeCardProps) {
  return (
    <Card
      className={cn(
        "group overflow-hidden transition-all duration-200 ease-in-out cursor-pointer hover:shadow-accent/50 hover:scale-105",
        isSelected ? "ring-4 ring-accent shadow-accent/70 scale-105" : "shadow-lg",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-0 relative aspect-[4/3]">
        <Image
          src={memeUrl}
          alt={altText}
          fill
          priority={false}
          className="object-contain bg-background"
          data-ai-hint={dataAiHint}
        />

        {children}
      </CardContent>
    </Card>
  );
}