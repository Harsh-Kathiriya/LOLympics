"use client";

import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface MemeCardProps {
  memeUrl: string;
  altText?: string;
  isSelected?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
  className?: string;
  dataAiHint?: string;
}

export function MemeCard({
  memeUrl,
  altText = "Meme image",
  isSelected,
  onClick,
  children,
  className,
  dataAiHint = "funny meme"
}: MemeCardProps) {
  return (
    <Card 
      className={cn(
        "overflow-hidden transition-all duration-200 ease-in-out cursor-pointer hover:shadow-accent/50 hover:scale-105",
        isSelected ? "ring-4 ring-accent shadow-accent/70 scale-105" : "shadow-lg",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-0 relative aspect-[4/3]">
        <Image
          src={memeUrl}
          alt={altText}
          layout="fill"
          objectFit="cover"
          className="transition-opacity duration-300 group-hover:opacity-80"
          data-ai-hint={dataAiHint}
        />
        {children && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
            {children}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
