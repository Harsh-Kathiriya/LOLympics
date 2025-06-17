/**
 * Represents the structure of a player object,
 * aligning with the `players` table in the Supabase database.
 */
export type Player = {
  id: string;
  created_at: string;
  room_id: string | null;
  username: string;
  is_ready: boolean | null;
  avatar_src: string | null;
  current_score: number;
};
