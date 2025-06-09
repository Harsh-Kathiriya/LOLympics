"use client";

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface CountdownOverlayProps {
  duration: number; // e.g., 3 for 3-2-1
  onCountdownEnd: () => void;
}

export function CountdownOverlay({ duration, onCountdownEnd }: CountdownOverlayProps) {
  const [count, setCount] = useState(duration);
  const [isVisible, setIsVisible] = useState(true);
  const [animationClass, setAnimationClass] = useState('animate-bounce-custom');

  useEffect(() => {
    if (count > 0) {
      // Sound effect: Drumroll tick
      // new Audio('/sounds/drum_tick.mp3').play(); 
      setAnimationClass('animate-bounce-custom'); // Reset animation for each number
      const timer = setTimeout(() => {
        setCount(count - 1);
        setAnimationClass(''); // Remove class to allow re-trigger
      }, 1000);
      return () => clearTimeout(timer);
    } else if (count === 0) {
      // Sound effect: Final drumroll hit / Go sound
      // new Audio('/sounds/drum_finish.mp3').play();
      setAnimationClass('animate-bounce-custom');
      const timer = setTimeout(() => {
        console.log("CountdownOverlay: Countdown finished. Calling onCountdownEnd."); // Added log
        setIsVisible(false);
        onCountdownEnd();
      }, 1000); // Show "GO!" for 1 second
      return () => clearTimeout(timer);
    }
  }, [count, onCountdownEnd]);

  if (!isVisible) return null;

  const displayText = count > 0 ? count.toString() : "GO!";

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100]">
      <div 
        key={count} // Re-trigger animation on count change
        className={cn(
          "font-headline text-9xl md:text-[12rem] lg:text-[15rem] font-bold text-accent",
          "transform transition-all duration-300 ease-out",
           animationClass // Apply custom bounce for emphasis
        )}
        style={{
            textShadow: '0 0 10px hsl(var(--accent) / 0.7), 0 0 20px hsl(var(--accent) / 0.5), 0 0 30px hsl(var(--accent) / 0.3)',
        }}
      >
        {displayText}
      </div>
      <style jsx global>{`
        @keyframes bounce-custom {
          0%, 100% {
            transform: translateY(-5%) scale(1.1);
            animation-timing-function: cubic-bezier(0.8,0,1,1);
          }
          50% {
            transform: translateY(0) scale(1);
            animation-timing-function: cubic-bezier(0,0,0.2,1);
          }
        }
        .animate-bounce-custom {
          animation: bounce-custom 0.8s ease-out;
        }
      `}</style>
    </div>
  );
}
