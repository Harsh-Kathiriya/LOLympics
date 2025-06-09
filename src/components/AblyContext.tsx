'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
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
  const [ably, setAbly] = useState<Ably.Realtime | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Clean up function to close Ably connection
  const cleanupAbly = useCallback(() => {
    if (ably) {
      ably.connection.off();
      ably.close();
      setAbly(null);
      setIsConnected(false);
    }
  }, [ably]);

  // Initialize Ably only when explicitly called
  const initializeAbly = useCallback(() => {
    // Don't initialize again if already done
    if (hasInitialized) return;
    
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

    setAbly(ablyClient);
  }, [hasInitialized]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cleanupAbly();
    };
  }, [cleanupAbly]);

  return (
    <AblyContext.Provider value={{ ably, isConnected, initializeAbly, hasInitialized }}>
      {children}
    </AblyContext.Provider>
  );
};

export const useAbly = () => useContext(AblyContext);