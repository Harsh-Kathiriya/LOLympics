"use client";

import { useState } from 'react';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'; // Added Loader2 for potential loading state

interface ReadyToggleProps {
  isReady: boolean;
  onToggle: (ready: boolean) => void;
  playerId: string;
  disabled?: boolean;
}

export function ReadyToggle({ isReady: initialIsReady, onToggle, playerId, disabled = false }: ReadyToggleProps) {
  const [isReady, setIsReady] = useState(initialIsReady);
  // const [isLoading, setIsLoading] = useState(false); // Example for async toggle

  const handleToggle = async (checked: boolean) => {
    if (disabled) return;
    
    // setIsLoading(true); // Example for async
    setIsReady(checked);
    onToggle(checked); // In a real app, this might be an API call
    // await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call
    // setIsLoading(false); // Example for async
  };

  // if (isLoading) {
  //   return <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />;
  // }

  return (
    <div className="flex items-center space-x-3">
      {isReady ? (
        <CheckCircle2 className="h-7 w-7 text-green-400 animate-pulse" />
      ) : (
        <XCircle className="h-7 w-7 text-red-500" />
      )}
      <Switch
        id={`ready-switch-${playerId}`}
        checked={isReady}
        onCheckedChange={handleToggle}
        aria-label="Ready status"
        disabled={disabled}
        className={`data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500/70 focus-visible:ring-accent ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      />
      <Label 
        htmlFor={`ready-switch-${playerId}`} 
        className={`font-semibold font-headline text-lg ${
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
        } ${isReady ? 'text-green-400' : 'text-red-500'}`}
      >
        {isReady ? 'READY!' : 'Not Ready'}
      </Label>
    </div>
  );
}
