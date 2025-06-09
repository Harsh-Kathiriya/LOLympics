"use client";

import { useState, useEffect } from 'react';
import { Progress } from "@/components/ui/progress";
import { cn } from '@/lib/utils';
import { TimerIcon } from 'lucide-react';

interface TimerBarProps {
  durationSeconds: number;
  onTimeUp: () => void;
  className?: string;
}

export function TimerBar({ durationSeconds, onTimeUp, className }: TimerBarProps) {
  const [remainingTime, setRemainingTime] = useState(durationSeconds);
  const [progressColor, setProgressColor] = useState('bg-cyan-500'); // For progress bar fill

  useEffect(() => {
    if (remainingTime <= 0) {
      onTimeUp();
      return;
    }

    const timerId = setInterval(() => {
      setRemainingTime(prevTime => prevTime - 1);
    }, 1000);

    return () => clearInterval(timerId);
  }, [remainingTime, onTimeUp]);

  useEffect(() => {
    const percentage = (remainingTime / durationSeconds) * 100;
    if (percentage > 60) {
      setProgressColor('bg-cyan-500'); // Bright Cyan (like primary)
    } else if (percentage > 20) {
      setProgressColor('bg-yellow-400'); // Vibrant Yellow
    } else {
      setProgressColor('bg-pink-600'); // Hot Pink (like accent)
    }
  }, [remainingTime, durationSeconds]);

  const progressValue = (remainingTime / durationSeconds) * 100;

  return (
    <div className={cn("w-full space-y-2", className)}>
      <div className="flex justify-between items-center text-sm font-medium text-muted-foreground">
        <div className="flex items-center">
          <TimerIcon className="h-5 w-5 mr-2 text-accent" />
          <span className="font-code">Time Remaining</span>
        </div>
        <span className="font-code text-lg text-accent">{Math.max(0, remainingTime)}s</span>
      </div>
      <Progress 
        value={progressValue} 
        className="h-4 rounded-full overflow-hidden bg-muted/50 border border-border"
        indicatorClassName={cn("transition-all duration-500 ease-linear", progressColor)}
      />
    </div>
  );
}
