"use client";

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlayerAvatar } from './player-avatar';

// Define the available avatars
const AVATAR_BASE_PATH = '/assets/avatars/';
const avatars = [
  { name: 'Eduardo', file: 'eduardo.png' },
  { name: 'Slimarhea', file: 'slimarhea.png' },
  { name: 'Largylintus', file: 'largylintus.png' },
  { name: 'Brad Bio', file: 'brad_bio.png' },
  { name: 'Mecha', file: 'mecha.png' },
  { name: 'Turret', file: 'turret.png' },
  { name: 'Malandrinho', file: 'malandrinho.png' },
  { name: 'Kingshroom', file: 'kingshroom.png' },
  { name: 'Spider', file: 'spider_01.png' },
  { name: 'Buggy', file: 'buggy.png' },
  { name: 'Dragon', file: 'dragon.png' },
  { name: 'Turtle', file: 'turtle_01.png' },
  { name: 'Ghost', file: 'ghost.png' },
  { name: 'Furfur', file: 'furfur.png' },
  { name: 'Bat', file: 'bat_little.png' },
  { name: 'Skell', file: 'skell.png' },
  { name: 'Gili', file: 'gili.png' },
];

interface AvatarSelectorProps {
  currentAvatar: string; // This will now be just the filename, e.g., 'eduardo.png'
  currentName: string;
  onAvatarChange: (avatarName: string) => void;
  onNameChange: (name: string) => void;
}

export function AvatarSelector({ 
  currentAvatar, 
  currentName, 
  onAvatarChange, 
  onNameChange
}: AvatarSelectorProps) {
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<string>(currentAvatar);
  const [playerName, setPlayerName] = useState<string>(currentName);
  const [open, setOpen] = useState(false);

  // Reset state when the dialog opens
  useEffect(() => {
    if (open) {
      setSelectedAvatarFile(currentAvatar);
      setPlayerName(currentName);
    }
  }, [open, currentAvatar, currentName]);

  const handleSave = () => {
    onAvatarChange(selectedAvatarFile);
    onNameChange(playerName);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full sm:w-auto btn-jackbox">
          Edit Profile
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-headline">Choose Your Avatar</DialogTitle>
          <DialogDescription>
            Select an avatar and customize your name for the game.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-4">
          <div className="flex justify-center mb-4">
            <PlayerAvatar 
              name={playerName} 
              avatarUrl={`${AVATAR_BASE_PATH}${selectedAvatarFile}`} 
              size="lg" 
              dataAiHint="selected avatar preview"
            />
          </div>
          
          <div className="mb-4">
            <Label htmlFor="playerName">Your Name</Label>
            <Input
              id="playerName"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="mt-1"
              maxLength={20}
            />
          </div>
          
          <div className="grid grid-cols-4 gap-3 max-h-[300px] overflow-y-auto p-1">
            {avatars.map((avatar) => (
              <div 
                key={avatar.name} 
                className={`relative cursor-pointer rounded-md p-2 transition-all ${
                  selectedAvatarFile === avatar.file 
                    ? 'bg-primary/20 ring-2 ring-primary' 
                    : 'hover:bg-secondary'
                }`}
                onClick={() => setSelectedAvatarFile(avatar.file)}
              >
                <div className="relative h-16 w-16 mx-auto">
                  <Image
                    src={`${AVATAR_BASE_PATH}${avatar.file}`}
                    alt={avatar.name}
                    fill
                    className="object-contain"
                  />
                </div>
                <p className="text-center text-xs mt-1 truncate">{avatar.name}</p>
              </div>
            ))}
          </div>
        </div>
        
        <DialogFooter>
          <Button onClick={() => setOpen(false)} variant="outline">Cancel</Button>
          <Button onClick={handleSave} disabled={!playerName.trim()}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 