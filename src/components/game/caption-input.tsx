"use client";

import { useState, useRef, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Send, Loader2, MoveVertical, GripHorizontal } from 'lucide-react';
import { soundManager } from '@/lib/sound';
import Image from 'next/image';

interface CaptionInputProps {
  /** Function to call when the user submits their caption. */
  onSubmit: (caption: string, positionX: number, positionY: number) => void;
  /** The maximum allowed length for the caption. Defaults to 150. */
  maxLength?: number;
  /** The URL of the meme image to be displayed above the input. */
  memeImageUrl: string;
  /** If true, the input and button will be disabled, and a loader will be shown. */
  isSubmitting?: boolean;
}

/**
 * A reusable form component for entering a caption for a meme.
 * It includes the meme image, a text area for input, a character counter,
 * and a submit button that shows a loading state.
 * Now supports positioning the caption on the meme image.
 */
export function CaptionInput({ onSubmit, maxLength = 150, memeImageUrl, isSubmitting = false }: CaptionInputProps) {
  const [caption, setCaption] = useState('');
  const [positionX, setPositionX] = useState(50); // Default to center horizontally (%)
  const [positionY, setPositionY] = useState(20); // Default to top area (%)
  const [isDragging, setIsDragging] = useState(false);
  const memeContainerRef = useRef<HTMLDivElement>(null);
  const captionOverlayRef = useRef<HTMLDivElement>(null);
  const charsLeft = maxLength - caption.length;

  // Handle caption position calculation
  const updateCaptionPosition = (clientX: number, clientY: number) => {
    if (!memeContainerRef.current || !isDragging) return;
    
    const rect = memeContainerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    // Calculate position as percentage of container dimensions
    const newPositionX = Math.max(0, Math.min(100, (x / rect.width) * 100));
    const newPositionY = Math.max(0, Math.min(100, (y / rect.height) * 100));
    
    setPositionX(newPositionX);
    setPositionY(newPositionY);
  };

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isSubmitting) return;
    setIsDragging(true);
    // Play settings click sound for drag start
    if (soundManager) {
      soundManager.playSettingsClick();
    }
    e.preventDefault(); // Prevent text selection
  };
  
  const handleMouseMove = (e: React.MouseEvent) => {
    updateCaptionPosition(e.clientX, e.clientY);
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  // Touch event handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isSubmitting) return;
    setIsDragging(true);
    // Play settings click sound for drag start
    if (soundManager) {
      soundManager.playSettingsClick();
    }
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    updateCaptionPosition(touch.clientX, touch.clientY);
  };
  
  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Add document-level event listeners for mouse/touch move and up events
  useEffect(() => {
    if (!isDragging) return;

    const handleDocumentMouseMove = (e: MouseEvent) => {
      updateCaptionPosition(e.clientX, e.clientY);
    };

    const handleDocumentTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        updateCaptionPosition(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleDocumentMouseUp = () => {
      setIsDragging(false);
    };

    const handleDocumentTouchEnd = () => {
      setIsDragging(false);
    };

    // Add document-level event listeners
    document.addEventListener('mousemove', handleDocumentMouseMove);
    document.addEventListener('mouseup', handleDocumentMouseUp);
    document.addEventListener('touchmove', handleDocumentTouchMove, { passive: false });
    document.addEventListener('touchend', handleDocumentTouchEnd);

    // Cleanup
    return () => {
      document.removeEventListener('mousemove', handleDocumentMouseMove);
      document.removeEventListener('mouseup', handleDocumentMouseUp);
      document.removeEventListener('touchmove', handleDocumentTouchMove);
      document.removeEventListener('touchend', handleDocumentTouchEnd);
    };
  }, [isDragging]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (caption.trim() && !isSubmitting) {
      // Play button click sound
      if (soundManager) {
        soundManager.playButtonClick();
      }
      
      onSubmit(caption.trim(), positionX, positionY);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-lg overflow-hidden shadow-lg border border-border relative" ref={memeContainerRef}>
        <Image
          src={memeImageUrl}
          alt="Meme to caption"
          width={800}
          height={600}
          className="w-full max-h-[400px] object-contain bg-black"
          sizes="(max-width: 768px) 100vw, 800px"
          priority
          data-ai-hint="funny meme"
        />
        
        {caption && (
          <div 
            ref={captionOverlayRef}
            className={`absolute p-2 bg-black/70 text-white font-bold text-center rounded select-none 
              ${isDragging ? 'ring-2 ring-accent shadow-lg' : 'hover:ring-1 hover:ring-accent/50'} 
              ${isSubmitting ? 'cursor-not-allowed opacity-80' : 'cursor-grab active:cursor-grabbing'}`}
            style={{
              left: `${positionX}%`,
              top: `${positionY}%`,
              transform: 'translate(-50%, -50%)',
              maxWidth: '80%',
              textShadow: '1px 1px 2px black',
              touchAction: 'none', // Prevents browser handling of touch events
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={isDragging ? handleMouseMove : undefined}
            onMouseUp={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={isDragging ? handleTouchMove : undefined}
            onTouchEnd={handleTouchEnd}
          >
            <div className="flex items-center justify-center mb-1 text-xs text-accent">
              <GripHorizontal size={14} className="mr-1 animate-pulse" /> Drag to position
            </div>
            {caption}
          </div>
        )}
      </div>
      
      <div>
        <Label htmlFor="caption-input" className="block text-lg font-medium text-primary mb-2 font-headline">
          Enter Your Caption
        </Label>
        <Textarea
          id="caption-input"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Make it witty, make it funny!"
          maxLength={maxLength}
          className="min-h-[100px] text-base p-4 rounded-md shadow-sm focus:ring-accent focus:border-accent"
          aria-describedby="char-count"
          readOnly={isSubmitting}
        />
        <div id="char-count" className="text-sm text-muted-foreground mt-2 text-right">
          {charsLeft} / {maxLength} characters remaining
        </div>
      </div>
      
      <Button type="submit" size="lg" className="w-full font-bold text-lg bg-accent hover:bg-accent/90 text-accent-foreground" disabled={!caption.trim() || isSubmitting}>
        {isSubmitting && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
        {isSubmitting ? 'Submitting...' : 'Submit Caption'}
        {!isSubmitting && <Send className="ml-2 h-5 w-5" />}
      </Button>
    </form>
  );
}
