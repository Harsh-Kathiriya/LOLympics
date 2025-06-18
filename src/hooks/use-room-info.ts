import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface RoomInfo {
  id: string;
  current_round_number: number;
}

interface UseRoomInfoResult {
  roomInfo: RoomInfo | null;
  isRoomInfoLoading: boolean;
}

/**
 * Custom hook to fetch room information from Supabase.
 * @param roomCode The room code to fetch information for
 */
export function useRoomInfo(roomCode: string): UseRoomInfoResult {
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);
  const [isRoomInfoLoading, setIsRoomInfoLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchRoomInfo = async () => {
      if (!roomCode) return;
      
      setIsRoomInfoLoading(true);
      
      try {
        const { data, error } = await supabase
          .from('rooms')
          .select('id, current_round_number')
          .eq('room_code', roomCode)
          .single();

        if (error) throw error;
        
        if (data) {
          setRoomInfo(data);
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error('Error fetching room info:', error);
        toast({
          title: 'Error Loading Room',
          description: 'Could not load room details. Please try refreshing.',
          variant: 'destructive'
        });
      } finally {
        setIsRoomInfoLoading(false);
      }
    };

    fetchRoomInfo();
  }, [roomCode, toast]);

  return { roomInfo, isRoomInfoLoading };
} 