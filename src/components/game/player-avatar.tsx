"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from '@/lib/utils';
import { CheckCircle } from "lucide-react";

interface PlayerAvatarProps {
  name: string;
  avatarUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  dataAiHint?: string;
  isReady?: boolean;
  compact?: boolean;
}

// Default avatar path if none is provided
const DEFAULT_AVATAR = '/assets/avatars/eduardo.png';

export function PlayerAvatar({ name, avatarUrl, size = 'md', dataAiHint = "person user", isReady, compact = false }: PlayerAvatarProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const avatarSizeClass = {
    sm: compact ? 'h-6 w-6' : 'h-8 w-8',
    md: compact ? 'h-10 w-10' : 'h-12 w-12',
    lg: compact ? 'h-14 w-14' : 'h-16 w-16',
  }[size];
  
  const textSizeClass = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  }[size];
  
  const fallbackTextSizeClass = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-xl',
  }[size];

  const checkmarkSizeClass = {
    sm: 'h-4 w-4 p-0.5',
    md: 'h-5 w-5 p-0.5',
    lg: 'h-6 w-6 p-0.5',
  }[size];

  return (
    <div className={cn(
      "flex items-center", 
      compact ? "space-x-1" : "space-x-3"
    )}>
      <div className="relative">
        <Avatar 
          className={cn(
            avatarSizeClass, 
            "border-2", 
            isReady ? 'border-green-500' : 'border-primary/50'
          )} 
          data-ai-hint={dataAiHint}
        >
          <AvatarImage 
            src={avatarUrl || DEFAULT_AVATAR} 
            alt={name} 
          />
          <AvatarFallback className={cn("bg-secondary text-secondary-foreground font-bold font-headline", fallbackTextSizeClass)}>
            {getInitials(name)}
          </AvatarFallback>
        </Avatar>
        {isReady && (
          <CheckCircle 
            className={cn(
              "absolute bottom-0 right-0 bg-background text-green-500 rounded-full",
              checkmarkSizeClass
            )} 
          />
        )}
      </div>
      {!compact && (
        <span className={cn("font-medium font-headline text-foreground", textSizeClass)}>
          {name}
        </span>
      )}
    </div>
  );
}
