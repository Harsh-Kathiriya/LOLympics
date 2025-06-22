"use client";

import { useState, useEffect } from 'react';
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Volume2, VolumeX, Music, Moon, Sun } from 'lucide-react';
import { soundManager, SOUNDS, useSound } from '@/lib/sound';

export function SettingsContent() {
  // Initialize state with default values
  const [soundEffects, setSoundEffects] = useState(true);
  const [music, setMusic] = useState(false);
  const [volume, setVolume] = useState(70); // 0-100 scale for UI
  const [darkMode, setDarkMode] = useState(true);

  // Load settings from sound manager on component mount
  useEffect(() => {
    if (soundManager) {
      const settings = soundManager.getSettings();
      setSoundEffects(settings.soundEffectsEnabled);
      setMusic(settings.musicEnabled);
      setVolume(Math.round(settings.volume * 100));
    }
  }, []);

  const handleToggleSoundEffects = (enabled: boolean) => {
    setSoundEffects(enabled);
    if (soundManager) {
      soundManager.toggleSoundEffects(enabled);
      // Play a sound effect when enabling to demonstrate
      if (enabled) {
        soundManager.playSettingsClick();
      }
    }
  };

  const handleToggleMusic = (enabled: boolean) => {
    setMusic(enabled);
    if (soundManager) {
      soundManager.toggleBackgroundMusic(enabled);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (soundManager) {
      soundManager.setVolume(newVolume / 100);
      // Play a sound to demonstrate the new volume if sound effects are enabled
      if (soundEffects) {
        soundManager.playSettingsClick();
      }
    }
  };

  const handleToggleDarkMode = (enabled: boolean) => {
    setDarkMode(enabled);
    if (enabled) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    // Play settings click sound
    if (soundManager && soundEffects) {
      soundManager.playSettingsClick();
    }
    localStorage.setItem('darkMode', String(enabled));
  };

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
            onCheckedChange={handleToggleSoundEffects}
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
            onCheckedChange={handleToggleMusic}
            className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted"
          />
        </div>
        <div className="p-3 bg-background/50 rounded-md border border-border">
          <div className="flex items-center justify-between mb-2">
            <Label htmlFor="volume-slider" className="flex items-center text-base">
              {volume > 0 ? (
                <Volume2 className="mr-3 h-5 w-5 text-primary" />
              ) : (
                <VolumeX className="mr-3 h-5 w-5 text-primary" />
              )}
              Volume
            </Label>
            <span className="text-sm font-medium text-muted-foreground">{volume}%</span>
          </div>
          <Slider
            id="volume-slider"
            value={[volume]}
            min={0}
            max={100}
            step={1}
            onValueChange={handleVolumeChange}
            className="w-full"
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
