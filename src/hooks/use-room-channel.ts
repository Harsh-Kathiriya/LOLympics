'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAbly } from '@/components/AblyContext';
import Ably from 'ably';

// ======================================================================
// == Type Definitions and Enums
// ======================================================================
// These define the contract for our real-time communication, ensuring
// that all events and payloads are consistent across the application.

/**
 * A centralized enum for all possible real-time events that can be
 * published or subscribed to on a room channel. Using an enum prevents
 * typos and makes the code more maintainable.
 */
export enum RoomEvent {
  PLAYER_JOINED = 'player-joined',
  PLAYER_LEFT = 'player-left',
  PLAYER_READY_UPDATE = 'player-ready-update',
  PLAYER_AVATAR_UPDATE = 'player-avatar-update', // Legacy, prefer PLAYER_AVATAR_CHANGED
  PLAYER_NAME_UPDATE = 'player-name-update',
  GAME_STARTING = 'game-starting',
  GAME_PHASE_CHANGED = 'game-phase-changed',
  MEME_SELECTED = 'meme-selected-for-round',
  CAPTION_SUBMITTED = 'caption-submitted',
  ROUND_RESULTS_READY = 'round-results-ready',
  FINAL_RESULTS = 'final-results',
  PLAYER_AVATAR_CHANGED = 'player-avatar-changed',
  MEME_VOTE_CAST = 'meme-vote-cast', // This event will now signal WHO voted.
  
}

// --- Payload Interfaces for each event ---
export interface PlayerJoinedPayload { playerId: string; playerName: string; avatarSrc: string; }
export interface PlayerLeftPayload { playerId:string; }
export interface PlayerReadyUpdatePayload { playerId: string; isReady: boolean; }
export interface PlayerNameUpdatePayload { playerId: string; newName: string; }
export interface GamePhaseChangedPayload { phase: string; data?: Record<string, any>; }
export interface PlayerAvatarChangedPayload { playerId: string; avatarSrc: string; }
// CHANGED: The payload now clearly indicates who voted.
export interface MemeVoteCastPayload { voterPlayerId: string; votedForCandidateId: string; }

// --- Other Interfaces ---
/** Data stored in Ably's presence set for each player. */
export interface RoomPresenceData { status: 'online' | 'away' | 'idle'; isReady?: boolean; lastActivity?: number; avatarSrc?: string; playerId?: string; playerName?: string; }

/** A union type for all possible event payloads. */
export type RoomEventPayload = | PlayerJoinedPayload | PlayerLeftPayload | PlayerReadyUpdatePayload | GamePhaseChangedPayload | PlayerAvatarChangedPayload | MemeVoteCastPayload | PlayerNameUpdatePayload;

/** The return type of the `useRoomChannel` hook, defining what it provides to components. */
export interface UseRoomChannelResult { 
  channel: Ably.RealtimeChannel | null; 
  channelState: string;
  isConnected: boolean;
  presenceData: Ably.PresenceMessage[];
  /** A boolean flag that is true only when the channel is fully attached and ready for interaction. */
  isReady: boolean;
  /** A robust function to publish an event, ensuring the channel is attached first. */
  publish: <T extends RoomEventPayload>(eventName: RoomEvent, data: T) => Promise<void>; 
  /** A function to subscribe to an event, returning a cleanup function to unsubscribe. */
  subscribe: <T extends RoomEventPayload>( eventName: RoomEvent, callback: (data: T, message: Ably.Message) => void ) => () => void; 
  /** A function to update the current user's presence data. */
  updatePresence: (data: RoomPresenceData) => Promise<void>; 
}

// A helper function to check if the channel is in a state where it can be used.
const isChannelActive = (ch: Ably.RealtimeChannel | null | undefined) => !!ch && (ch.state === 'attached' || ch.state === 'attaching');


// ======================================================================
// == The Custom Hook: useRoomChannel
// ======================================================================

export function useRoomChannel(roomCode: string): UseRoomChannelResult {
  const { ably, isConnected, initializeAbly, hasInitialized } = useAbly();
  const [channel, setChannel] = useState<Ably.RealtimeChannel | null>(null);
  const [channelState, setChannelState] = useState<string>('initialized');
  const [presenceData, setPresenceData] = useState<Ably.PresenceMessage[]>([]);
  const isMounted = useRef(false); // Ref to track if the component is still mounted.

  // Ensure the global Ably client is initialized.
  useEffect(() => {
    if (!hasInitialized) initializeAbly();
  }, [hasInitialized, initializeAbly]);

  // This is the main effect for managing the channel lifecycle.
  useEffect(() => {
    isMounted.current = true;
    if (!ably || !roomCode) {
      isMounted.current = false;
      return;
    }

    const channelName = `room:${roomCode}`;
    // `ably.channels.get()` is idempotent. It gets the existing channel instance
    // or creates a new one if it doesn't exist. This is key to maintaining the
    // same channel connection across page navigations.
    const roomChannel = ably.channels.get(channelName);
    setChannel(roomChannel);

    // Immediately set the channel's current state. On navigation, this might
    // already be 'attached' from the previous page.
    setChannelState(roomChannel.state);

    // --- Listener Setup ---
    const onChannelStateChange = (stateChange: Ably.ChannelStateChange) => {
        if (isMounted.current) {
            setChannelState(stateChange.current);
        }
    };
    const updatePresenceData = async () => {
      if (!isChannelActive(roomChannel) || !isMounted.current) return;
      try {
        const presenceSet = await roomChannel.presence.get();
        if (isMounted.current) setPresenceData(presenceSet);
      } catch (err) { console.error('Error getting presence data:', err); }
    };
    
    roomChannel.on(onChannelStateChange);
    roomChannel.presence.subscribe(['enter', 'leave', 'update'], updatePresenceData);

    // *** THE DEFINITIVE FIX: RESILIENT ATTACHMENT LOGIC ***
    // This block ensures the channel is always in a ready state when the hook is used.
    // It handles the initial connection and, crucially, re-syncs the hook with the
    // channel's state after a page navigation.
    if (roomChannel.state !== 'attached' && roomChannel.state !== 'attaching') {
      // If the channel is detached, failed, suspended, or just initialized,
      // we must actively call `.attach()` to make it usable.
      roomChannel.attach(); // attach() expects 0 arguments
      
      // Listen for attachment success/failure
      roomChannel.once('attached', () => {
        updatePresenceData();
      });
      
      roomChannel.once('failed', () => {
        console.error(`Error attaching to channel ${channelName}`);
      });
    } else {
      // If the channel was already attached (e.g., from a previous page),
      // we just need to fetch the latest presence data for this component instance.
      updatePresenceData();
    }

    // --- Cleanup Function ---
    return () => {
      isMounted.current = false;
      if (roomChannel) {
        // We DO NOT call `roomChannel.detach()`. Detaching would kill the connection
        // for the next page. Instead, we only clean up the listeners that this
        // specific component instance created.
        roomChannel.off(onChannelStateChange);
        roomChannel.presence.unsubscribe();
      }
    };
  }, [ably, roomCode]); // This effect re-runs if the Ably client or roomCode changes.

  /**
   * A robust function to publish a message. It waits for the channel to be 'attached'
   * before attempting to publish, preventing "channel not ready" errors.
   */
  const publish = useCallback(async <T extends RoomEventPayload>(eventName: RoomEvent, data: T): Promise<void> => {
    if (!channel) {
      throw new Error('Cannot publish: Ably channel is not available.');
    }

    // This promise ensures we don't proceed until the channel is in a publishable state.
    await new Promise<void>((resolve, reject) => {
      if (channel.state === 'attached') {
        resolve(); // Already ready, proceed immediately.
        return;
      }
      // If in a bad state, actively try to re-attach.
      if (channel.state === 'detached' || channel.state === 'failed' || channel.state === 'suspended') {
        channel.attach(); // Remove callback parameter since it expects 0 args
        channel.once('attached', () => resolve());
        channel.once('failed', () => reject(new Error('Failed to attach channel')));
        return;
      }
      // If currently attaching, just wait for it to finish.
      channel.once('attached', () => resolve());
      channel.once('failed', (err) => reject(err.reason));
    });

    // Now that we are guaranteed to be attached, we can safely publish.
    await channel.publish(eventName, data);
  }, [channel]);

  /**
   * Subscribes a callback to a specific event on the channel.
   * Returns a cleanup function to unsubscribe, which is perfect for use in `useEffect`.
   */
  const subscribe = useCallback(<T extends RoomEventPayload>(eventName: RoomEvent, callback: (data: T, message: Ably.Message) => void): (() => void) => {
    if (!channel) return () => {};
    const handler = (message: Ably.Message) => callback(message.data as T, message);
    channel.subscribe(eventName, handler);
    // Return the cleanup function.
    return () => channel.unsubscribe(eventName, handler);
  }, [channel]);

  /**
   * A convenient wrapper to update the current user's presence data.
   */
  const updatePresence = useCallback(async (data: RoomPresenceData): Promise<void> => {
    if (!isChannelActive(channel)) return;
    await channel!.presence.update(data);
  }, [channel]);
  
  // Expose the channel and its state to the consuming component.
  // `isReady` is a simple derived boolean for convenience in components.
  return { 
    channel, 
    channelState, 
    isConnected, 
    presenceData, 
    isReady: channelState === 'attached', 
    publish, 
    subscribe, 
    updatePresence 
  };
}