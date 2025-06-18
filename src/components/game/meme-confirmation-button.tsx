import { Button } from '@/components/ui/button';
import { Image as ImageIcon } from 'lucide-react';

interface MemeConfirmationButtonProps {
  onConfirm: () => void;
  disabled: boolean;
}

/**
 * A reusable button component for confirming meme selection.
 */
export function MemeConfirmationButton({
  onConfirm,
  disabled
}: MemeConfirmationButtonProps) {
  return (
    <div className="flex justify-end mt-8">
      <Button 
        size="lg" 
        onClick={onConfirm} 
        disabled={disabled}
        className="font-bold text-lg bg-accent hover:bg-accent/80 text-accent-foreground btn-jackbox min-w-[200px] h-14"
      >
        Confirm Selection <ImageIcon className="ml-2 h-6 w-6" />
      </Button>
    </div>
  );
} 