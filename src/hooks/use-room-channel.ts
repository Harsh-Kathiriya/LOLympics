'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAbly } from '@/components/AblyContext';
import Ably from 'ably';

/**
 * Enum defining all possible room event types that can be published/subscribed to
 * This provides a centralized list of event names to avoid string typos
 */
export enum RoomEvent {
  PLAYER_JOINED = 'player-joined',     // When a new player joins the room
  PLAYER_LEFT = 'player-left',         // When a player leaves the room
  PLAYER_READY_UPDATE = 'player-ready-update', // When a player changes their ready status
  GAME_STARTING = 'game-starting',     // When the game is about to start (countdown)
  GAME_PHASE_CHANGED = 'game-phase-changed', // When moving between game phases
  MEME_SELECTED = 'meme-selected-for-round', // When a meme is selected for the current round
  CAPTION_SUBMITTED = 'caption-submitted', // When a player submits a caption
  ROUND_RESULTS_READY = 'round-results-ready', // When round results are calculated
  FINAL_RESULTS = 'final-results',     // When the game ends with final results
  PLAYER_AVATAR_CHANGED = 'player-avatar-changed', // When a player changes their avatar
}

/**
 * Payload data structure for PLAYER_JOINED events
 */
export interface PlayerJoinedPayload {
  playerId: string;       // Unique identifier for the player (matches Supabase auth.uid())
  playerName: string;     // Display name for the player
  avatarSrc: string;     // URL to player's avatar image
}

/**
 * Payload data structure for PLAYER_LEFT events
 */
export interface PlayerLeftPayload {
  playerId: string;       // ID of the player who left
}

/**
 * Payload data structure for PLAYER_READY_UPDATE events
 */
export interface PlayerReadyUpdatePayload {
  playerId: string;       // ID of the player whose ready status changed
  isReady: boolean;       // New ready status (true = ready, false = not ready)
}

/**
 * Payload data structure for GAME_STARTING events
 */
export interface GameStartingPayload {
  countdownSeconds: number; // Duration of the countdown before game starts
}

/**
 * Payload data structure for GAME_PHASE_CHANGED events
 */
export interface GamePhaseChangedPayload {
  phase: string;          // The new game phase (e.g., "meme-selection", "caption-entry")
  data?: Record<string, any>; // Optional additional data related to the phase
}

/**
 * Payload data structure for MEME_SELECTED events
 */
export interface MemeSelectedPayload {
  memeId: string;         // Database ID of the selected meme
  memeUrl: string;        // URL to the meme image
  memeName?: string;      // Optional display name of the meme
}

/**
 * Payload data structure for CAPTION_SUBMITTED events
 */
export interface CaptionSubmittedPayload {
  playerId: string;       // ID of the player who submitted a caption
  submitted: boolean;     // Whether the player submitted (true) or withdrew (false)
  submittedCount?: number; // Optional count of total submissions so far
  totalPlayers?: number;  // Optional count of total players in the round
}

/**
 * Payload data structure for ROUND_RESULTS_READY events
 */
export interface RoundResultsPayload {
  winningCaptionId: string; // ID of the winning caption
  winningPlayerId: string; // ID of the player who wrote the winning caption
  winningCaption: string;  // Text content of the winning caption
  roundScores: Record<string, number>; // Scores for this round by player ID
  totalScores: Record<string, number>; // Updated cumulative scores by player ID
}

/**
 * Payload data structure for FINAL_RESULTS events
 */
export interface FinalResultsPayload {
  finalScores: Record<string, number>; // Final game scores by player ID
  winningPlayerId: string;  // ID of the overall game winner
  winningPlayerName: string; // Display name of the overall winner
}

/**
 * Payload data structure for PLAYER_AVATAR_CHANGED events
 */
export interface PlayerAvatarChangedPayload {
  playerId: string;
  avatarSrc: string;
}

/**
 * Data structure for presence information in a room
 * Used for real-time tracking of who's in the room and their status
 */
export interface RoomPresenceData {
  status: 'online' | 'away' | 'idle'; // Player's current connection status
  isReady?: boolean;      // Whether the player is ready to start the game
  lastActivity?: number;  // Timestamp of player's last activity
  avatarSrc?: string;     // URL to player's avatar
  playerId?: string;      // Player's unique identifier (for PLAYER_JOINED events)
  playerName?: string;    // Player's display name (for PLAYER_JOINED events)
}

/**
 * Union type of all possible event payloads
 * This helps with type safety when using generic publish/subscribe methods
 */
export type RoomEventPayload =
  | PlayerJoinedPayload
  | PlayerLeftPayload
  | PlayerReadyUpdatePayload
  | GameStartingPayload
  | GamePhaseChangedPayload
  | MemeSelectedPayload
  | CaptionSubmittedPayload
  | RoundResultsPayload
  | FinalResultsPayload
  | PlayerAvatarChangedPayload;

/**
 * Return type for the useRoomChannel hook
 * Provides the channel instance, state, and methods for interacting with it
 */
export interface UseRoomChannelResult {
  channel: Ably.RealtimeChannel | null; // The Ably channel instance
  channelState: string;    // Current state of the channel (e.g., "attached", "detached")
  isConnected: boolean;    // Whether the Ably connection is established
  presenceData: Ably.PresenceMessage[]; // List of users present in the channel
  
  // Method to publish an event to the channel
  publish: <T extends RoomEventPayload>(eventName: RoomEvent, data: T) => Promise<void>;
  
  // Method to subscribe to an event on the channel
  // Returns an unsubscribe function
  subscribe: <T extends RoomEventPayload>(
    eventName: RoomEvent,
    callback: (data: T) => void
  ) => () => void;
  
  // Method to update the current user's presence data
  updatePresence: (data: RoomPresenceData) => Promise<void>;
}

/**
 * Hook for managing a room-specific Ably channel
 * Provides real-time communication for a specific game room
 * 
 * @param roomCode The CODE of the room to connect to (e.g., from URL params)
 * @returns An object with channel state and methods for interacting with the channel
 */
export function useRoomChannel(roomCode: string): UseRoomChannelResult {
  // Get the Ably client from context
  const { ably, isConnected } = useAbly();
  
  // State for the channel instance and its current state
  const [channel, setChannel] = useState<Ably.RealtimeChannel | null>(null);
  const [channelState, setChannelState] = useState<string>('initialized');
  
  // State for the list of users present in the channel
  const [presenceData, setPresenceData] = useState<Ably.PresenceMessage[]>([]);

  // Effect to initialize and clean up the channel
  useEffect(() => {
    // Don't proceed if Ably client is not available or roomCode is missing
    if (!ably || !roomCode) return;

    // Create a standardized channel name using the room CODE
    // This follows the pattern "room:{roomCode}" for consistency
    const channelName = `room:${roomCode}`;
    
    // Get the channel instance from Ably
    const roomChannel = ably.channels.get(channelName);
    
    // Set up channel state listener to track channel state changes
    const onChannelStateChange = (stateChange: Ably.ChannelStateChange) => {
      setChannelState(stateChange.current);
    };
    
    // Log when channel is successfully attached
    roomChannel.on('attached', () => {
      console.log(`Channel ${channelName} attached`);
    });
    
    // Log when channel is detached
    roomChannel.on('detached', () => {
      console.log(`Channel ${channelName} detached`);
    });
    
    // Log when channel connection fails
    roomChannel.on('failed', (stateChange: Ably.ChannelStateChange) => {
      console.error(`Channel ${channelName} failed:`, stateChange.reason);
    });
    
    // Register the state change listener
    roomChannel.on(onChannelStateChange);
    
    // Set up presence listeners
    
    // When someone enters the channel
    roomChannel.presence.subscribe('enter', async (presenceMsg) => {
      console.log('Presence enter:', presenceMsg);
      updatePresenceData();
      
      // 🚀 NEW: Publish PLAYER_JOINED event when someone enters
      // Only publish if this isn't our own entry (to avoid self-notification)
      if (presenceMsg.clientId !== ably.auth.clientId) {
        try {
          // Extract player info from presence data
          const playerData = presenceMsg.data;
          
          // The presence data should include player info when they enter
          // This requires updating the initial presence.enter() call to include player data
          if (playerData?.playerId && playerData?.playerName) {
            await roomChannel.publish(RoomEvent.PLAYER_JOINED, {
              playerId: playerData.playerId,
              playerName: playerData.playerName,
              avatarSrc: playerData.avatarSrc || '/assets/avatars/eduardo.png'
            });
          } else {
            console.warn('Incomplete player data in presence enter event:', playerData);
          }
        } catch (error) {
          console.error('Error publishing PLAYER_JOINED event:', error);
        }
      }
    });
    
    // When someone leaves the channel
    roomChannel.presence.subscribe('leave', (presenceMsg) => {
      console.log('Presence leave:', presenceMsg);
      updatePresenceData();
    });
    
    // When someone updates their presence data
    roomChannel.presence.subscribe('update', (presenceMsg) => {
      console.log('Presence update:', presenceMsg);
      updatePresenceData();
    });
    
    // Helper function to fetch and update the current presence set
    const updatePresenceData = async () => {
      try {
        const presenceSet = await roomChannel.presence.get();
        setPresenceData(presenceSet);
      } catch (err) {
        console.error('Error getting presence data:', err);
      }
    };
    
    // Initial presence data fetch when the channel is initialized
    updatePresenceData();
    
    // Store the channel instance in state
    setChannel(roomChannel);
    
    // Clean up function to run when the component unmounts
    // or when roomCode/ably changes
    return () => {
      // Unsubscribe from presence events
      roomChannel.presence.unsubscribe();
      
      // Unsubscribe from channel events
      roomChannel.off();
      
      // Release the channel
      ably.channels.release(channelName);
      
      // Clear the channel from state
      setChannel(null);
    };
  }, [ably, roomCode]); // Re-run if ably client or roomCode changes
  

  
  // NOTE: We're no longer automatically entering presence when the channel is ready
  // Instead, this should be explicitly done by the component using this hook (e.g., lobby page)
  // This prevents duplicate presence entries and ensures we have complete player data first
  
  // Keep the cleanup logic to leave presence on unmount
  useEffect(() => {
    // Only proceed if we have a channel and it's properly attached
    if (channel && channelState === 'attached') {
      console.log(`Channel ${roomCode} is ready for presence updates`);
      
      // We don't auto-enter presence anymore - the lobby page will do this
      // after it has loaded player data
    }
    
    // Clean up function that will run when unmounting
    // or when channel/channelState changes
    return () => {
      if (channel) {
        // Only try to leave if we're in the presence set
        // For simplicity, we'll just attempt to leave without checking
        channel.presence.leave().catch((leaveErr: Error) => {
          console.error('Error leaving presence:', leaveErr);
        });
      }
    };
  }, [channel, channelState]); // Re-run if channel or channelState changes
  
  // Method to publish events to the channel
  // Uses useCallback to avoid recreating the function on every render
  const publish = useCallback(
    async <T extends RoomEventPayload>(eventName: RoomEvent, data: T): Promise<void> => {
      // Don't proceed if channel is not available
      if (!channel) {
        console.error('Channel not available');
        return;
      }
      
      try {
        // Publish the event with its data to the channel
        await channel.publish(eventName, data);
      } catch (err) {
        console.error(`Error publishing ${eventName}:`, err);
        // Re-throw to allow caller to handle the error
        throw err;
      }
    },
    [channel] // Re-create only if channel changes
  );
  
  // Method to subscribe to events on the channel
  // Returns a function to unsubscribe
  const subscribe = useCallback(
    <T extends RoomEventPayload>(
      eventName: RoomEvent,
      callback: (data: T) => void
    ): (() => void) => {
      // Don't proceed if channel is not available
      if (!channel) {
        console.error('Channel not available');
        // Return a no-op function
        return () => {};
      }
      
      // Create a handler that extracts data from the message
      const handler = (message: Ably.Message) => {
        callback(message.data as T);
      };
      
      // Subscribe to the specified event
      channel.subscribe(eventName, handler);
      
      // Return a function to unsubscribe
      return () => {
        channel.unsubscribe(eventName, handler);
      };
    },
    [channel] // Re-create only if channel changes
  );
  
  // Method to update the current user's presence data
  const updatePresence = useCallback(
    async (data: RoomPresenceData): Promise<void> => {
      // Don't proceed if channel is not available
      if (!channel) {
        console.error('Channel not available');
        return;
      }
      
      try {
        // Update the presence data on the channel
        await channel.presence.update(data);
      } catch (err) {
        console.error('Error updating presence:', err);
        // Re-throw to allow caller to handle the error
        throw err;
      }
    },
    [channel] // Re-create only if channel changes
  );
  
  // Return the hook's API
  return {
    channel,         // The Ably channel instance
    channelState,    // Current state of the channel
    isConnected,     // Whether Ably is connected
    presenceData,    // List of users present in the channel
    publish,         // Method to publish events
    subscribe,       // Method to subscribe to events
    updatePresence,  // Method to update presence data
  };
} 