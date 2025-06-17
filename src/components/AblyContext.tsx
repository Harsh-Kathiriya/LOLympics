'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
  useRef, // Import useRef
} from 'react';
import Ably from 'ably';

interface AblyContextType {
  ably: Ably.Realtime | null;
  isConnected: boolean;
  initializeAbly: () => void;
  hasInitialized: boolean;
}

const AblyContext = createContext<AblyContextType>({
  ably: null,
  isConnected: false,
  initializeAbly: () => {},
  hasInitialized: false,
});

interface AblyProviderProps {
  children: ReactNode;
}

export const AblyProvider = ({ children }: AblyProviderProps) => {
  // Use a ref to hold the Ably instance. This ensures it's created only once
  // and persists across re-renders without causing them.
  const ablyRef = useRef<Ably.Realtime | null>(null);
  
  const [isConnected, setIsConnected] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Initialize Ably only when explicitly called
  const initializeAbly = useCallback(() => {
    // Don't initialize again if already done
    if (hasInitialized || ablyRef.current) return;
    
    setHasInitialized(true);
    
    const ablyClient = new Ably.Realtime({
      authUrl: '/api/create-ably-token',
    });

    ablyClient.connection.on('connected', () => {
      setIsConnected(true);
      console.log('Ably connected!');
    });
    
    ablyClient.connection.on('disconnected', () => {
      setIsConnected(false);
      console.warn('Ably disconnected.');
    });
    
    ablyClient.connection.on('failed', (error) => {
      setIsConnected(false);
      console.error('Ably connection failed:', error);
    });

    // Store the client in the ref
    ablyRef.current = ablyClient;
  }, [hasInitialized]);

  // Clean up on unmount
  useEffect(() => {
    // The function returned from useEffect will run when the component unmounts
    return () => {
      if (ablyRef.current) {
        ablyRef.current.connection.off(); // Remove all listeners
        ablyRef.current.close();
        console.log('Ably connection closed on component unmount.');
      }
    };
  }, []); // Empty dependency array ensures this runs only on mount and unmount

  return (
    <AblyContext.Provider value={{ ably: ablyRef.current, isConnected, initializeAbly, hasInitialized }}>
      {children}
    </AblyContext.Provider>
  );
};

export const useAbly = () => useContext(AblyContext);