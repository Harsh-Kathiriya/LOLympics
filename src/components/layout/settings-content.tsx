
"use client";

import { useState } from 'react';
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Volume2, Music, Moon, Sun } from 'lucide-react';

export function SettingsContent() {
  const [soundEffects, setSoundEffects] = useState(true);
  const [music, setMusic] = useState(false); // Default music off for now
  const [darkMode, setDarkMode] = useState(true); // Assuming default dark theme

  const handleToggleDarkMode = (enabled: boolean) => {
    setDarkMode(enabled);
    if (enabled) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    // In a real app, you'd persist this preference (e.g., localStorage)
  }

  return (
    <div className="space-y-6 p-2 font-body">
      <div className="space-y-4">
        <h3 className="font-headline text-xl text-primary">Audio</h3>
        <div className="flex items-center justify-between p-3 bg-background/50 rounded-md border border-border">
          <Label htmlFor="sound-effects-toggle" className="flex items-center text-base">
            <Volume2 className="mr-3 h-5 w-5 text-primary" />
            Sound Effects
          </Label>
          <Switch
            id="sound-effects-toggle"
            checked={soundEffects}
            onCheckedChange={setSoundEffects}
            className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted"
          />
        </div>
        <div className="flex items-center justify-between p-3 bg-background/50 rounded-md border border-border">
          <Label htmlFor="music-toggle" className="flex items-center text-base">
            <Music className="mr-3 h-5 w-5 text-primary" />
            Background Music
          </Label>
          <Switch
            id="music-toggle"
            checked={music}
            onCheckedChange={setMusic}
            className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted"
          />
        </div>
      </div>

      <Separator className="my-6 bg-border/50" />

      <div className="space-y-4">
        <h3 className="font-headline text-xl text-primary">Appearance</h3>
        <div className="flex items-center justify-between p-3 bg-background/50 rounded-md border border-border">
          <Label htmlFor="dark-mode-toggle" className="flex items-center text-base">
            {darkMode ? <Moon className="mr-3 h-5 w-5 text-primary" /> : <Sun className="mr-3 h-5 w-5 text-primary" />}
            Dark Mode
          </Label>
          <Switch
            id="dark-mode-toggle"
            checked={darkMode}
            onCheckedChange={handleToggleDarkMode}
            className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted"
          />
        </div>
        <p className="text-xs text-muted-foreground px-1">
          Note: Full light mode theme might require app reload or further theme adjustments.
        </p>
      </div>
       <Separator className="my-6 bg-border/50" />
        <div>
            <p className="text-center text-xs text-muted-foreground/70 mt-8">
                Caption Clash v1.0.0 <br />
                More settings coming soon!
            </p>
        </div>
    </div>
  );
}
