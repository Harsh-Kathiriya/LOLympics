"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from '@/lib/utils';

interface PlayerAvatarProps {
  name: string;
  avatarUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  dataAiHint?: string;
}

// Default avatar path if none is provided
const DEFAULT_AVATAR = '/assests/avatars/eduardo.png';

export function PlayerAvatar({ name, avatarUrl, size = 'md', dataAiHint = "person user" }: PlayerAvatarProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const avatarSizeClass = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16',
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

  return (
    <div className="flex items-center space-x-3">
      <Avatar className={cn(avatarSizeClass, "border-2 border-primary/50")} data-ai-hint={dataAiHint}>
        <AvatarImage 
          src={avatarUrl || DEFAULT_AVATAR} 
          alt={name} 
        />
        <AvatarFallback className={cn("bg-secondary text-secondary-foreground font-bold font-headline", fallbackTextSizeClass)}>
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>
      <span className={cn("font-medium font-headline text-foreground", textSizeClass)}>{name}</span>
    </div>
  );
}
