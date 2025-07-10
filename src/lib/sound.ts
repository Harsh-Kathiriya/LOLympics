/**
 * Sound Utility Module
 * 
 * This module provides functions to play, pause, and manage sounds throughout the application.
 * It handles both sound effects and background music with volume control and mute functionality.
 */

// Constants for sound paths
export const SOUNDS = {
  // Sound effects
  BUTTON_CLICK: '/assets/sounds/buttonClick2.mp3',
  SETTINGS_CLICK: '/assets/sounds/buttonClick3.mp3',
  ROUND_RESULT: '/assets/sounds/finalResult.mp3',
  FINAL_RESULT: '/assets/sounds/finalResult2.mp3',
  
  // Background music
  BACKGROUND_MUSIC: '/assets/sounds/background.mp3',
};

// Singleton class to manage sound across the application
class SoundManager {
  private static instance: SoundManager;
  
  // Audio elements
  private backgroundMusic: HTMLAudioElement | null = null;
  
  // Settings
  private soundEffectsEnabled: boolean = true;
  private musicEnabled: boolean = false;
  private volume: number = 0.6; // Default volume (0-1)
  
  // Cache for sound effects
  private soundEffectsCache: Map<string, HTMLAudioElement> = new Map();
  
  private constructor() {
    if (typeof window !== 'undefined') {
      this.loadSettings();
      // Do NOT create audio assets here to avoid large network hits at first paint.
    }
  }
  
  public static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }
  
  // Load settings from localStorage
  private loadSettings(): void {
    if (typeof window !== 'undefined') {
      const savedSoundEffects = localStorage.getItem('soundEffectsEnabled');
      const savedMusic = localStorage.getItem('musicEnabled');
      const savedVolume = localStorage.getItem('soundVolume');
      
      this.soundEffectsEnabled = savedSoundEffects !== null ? savedSoundEffects === 'true' : true;
      this.musicEnabled = savedMusic !== null ? savedMusic === 'true' : false;
      this.volume = savedVolume !== null ? parseFloat(savedVolume) : 0.6;
    }
  }
  
  // Save settings to localStorage
  private saveSettings(): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('soundEffectsEnabled', String(this.soundEffectsEnabled));
      localStorage.setItem('musicEnabled', String(this.musicEnabled));
      localStorage.setItem('soundVolume', String(this.volume));
    }
  }
  
  // Lazily instantiate the background Audio element
  private ensureBackgroundAudio(): void {
    if (!this.backgroundMusic && typeof window !== 'undefined') {
      this.backgroundMusic = new Audio(SOUNDS.BACKGROUND_MUSIC);
      this.backgroundMusic.loop = true;
      this.backgroundMusic.volume = this.volume;
    }
  }
  
  // Play a sound effect
  public playSoundEffect(soundPath: string): void {
    if (!this.soundEffectsEnabled || typeof window === 'undefined') return;
    
    try {
      // Check if we have this sound cached
      let sound = this.soundEffectsCache.get(soundPath);
      
      if (!sound) {
        // Create and cache a new audio element
        sound = new Audio(soundPath);
        this.soundEffectsCache.set(soundPath, sound);
      } else {
        // Reset the sound if it's already cached
        sound.currentTime = 0;
      }
      
      sound.volume = this.volume;
      sound.play().catch(err => console.error('Error playing sound:', err));
    } catch (error) {
      console.error('Failed to play sound effect:', error);
    }
  }
  
  // Play background music
  public playBackgroundMusic(): void {
    if (!this.musicEnabled || typeof window === 'undefined') return;

    this.ensureBackgroundAudio();

    try {
      if (this.backgroundMusic && this.backgroundMusic.paused) {
        this.backgroundMusic.play().catch(err => console.error('Error playing background music:', err));
      }
    } catch (error) {
      console.error('Failed to play background music:', error);
    }
  }
  
  // Pause background music
  public pauseBackgroundMusic(): void {
    if (!this.backgroundMusic || typeof window === 'undefined') return;
    
    try {
      this.backgroundMusic.pause();
    } catch (error) {
      console.error('Failed to pause background music:', error);
    }
  }
  
  // Toggle sound effects
  public toggleSoundEffects(enabled: boolean): void {
    this.soundEffectsEnabled = enabled;
    this.saveSettings();
  }
  
  // Toggle background music
  public toggleBackgroundMusic(enabled: boolean): void {
    this.musicEnabled = enabled;
    this.saveSettings();
    
    if (enabled) {
      this.playBackgroundMusic();
    } else {
      this.pauseBackgroundMusic();
    }
  }
  
  // Set volume for all sounds
  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume)); // Ensure volume is between 0 and 1
    this.saveSettings();
    
    // Update background music volume
    if (this.backgroundMusic) {
      this.backgroundMusic.volume = this.volume;
    }
    
    // Update all cached sound effects
    this.soundEffectsCache.forEach(sound => {
      sound.volume = this.volume;
    });
  }
  
  // Get current settings
  public getSettings() {
    return {
      soundEffectsEnabled: this.soundEffectsEnabled,
      musicEnabled: this.musicEnabled,
      volume: this.volume
    };
  }
  
  // Convenience methods for common sounds
  public playButtonClick(): void {
    this.playSoundEffect(SOUNDS.BUTTON_CLICK);
  }
  
  public playSettingsClick(): void {
    this.playSoundEffect(SOUNDS.SETTINGS_CLICK);
  }
  
  public playRoundResult(): void {
    this.playSoundEffect(SOUNDS.ROUND_RESULT);
  }
  
  public playFinalResult(): void {
    this.playSoundEffect(SOUNDS.FINAL_RESULT);
  }
}

// Export a singleton instance
export const soundManager = typeof window !== 'undefined' ? SoundManager.getInstance() : null;

// React hook for using sound in components
export function useSound() {
  return soundManager;
} 
