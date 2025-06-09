-- Collection of Supabase functions for the studio application

-- Function: generate_random_alphanumeric_string
-- Generates a random alphanumeric string of specified length
CREATE OR REPLACE FUNCTION public.generate_random_alphanumeric_string(length INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT[] := '{0,1,2,3,4,5,6,7,8,9,A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z}';
  result TEXT := '';
  i INTEGER;
BEGIN
  IF length < 1 THEN
    RAISE EXCEPTION 'Length must be at least 1';
  END IF;
  FOR i IN 1..length LOOP
    result := result || chars[1 + floor(random() * array_length(chars, 1))];
  END LOOP;
  RETURN result;
END;
$$;

-- Function: is_player_in_room
-- Checks if a player is in a specific room
CREATE OR REPLACE FUNCTION public.is_player_in_room(player_id UUID, room_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.players
        WHERE id = player_id AND room_id = room_id
    );
END;
$$;

-- Function: create_room
-- Creates a new room and adds the authenticated user as a player
CREATE OR REPLACE FUNCTION public.create_room(p_username TEXT)
RETURNS TABLE(new_room_id UUID, generated_room_code TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_room_id UUID;
    v_room_code TEXT;
    RETRY_COUNT INTEGER := 0;
    MAX_RETRIES INTEGER := 10;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated to create a room.';
    END IF;

    IF p_username IS NULL OR trim(p_username) = '' THEN
        RAISE EXCEPTION 'Username cannot be empty.';
    END IF;

    -- NOTE: We no longer check if the player is in another room here.
    -- That is now handled by the real-time presence system and webhooks.

    -- Create the room
    LOOP
        v_room_code := public.generate_random_alphanumeric_string(6);
        BEGIN
            INSERT INTO public.rooms (room_code, status, game_state)
            VALUES (v_room_code, 'lobby', '{}'::jsonb)
            RETURNING id INTO v_room_id;
            
            EXIT; -- Exit loop if insert is successful
        EXCEPTION 
            WHEN unique_violation THEN
                RETRY_COUNT := RETRY_COUNT + 1;
                IF RETRY_COUNT >= MAX_RETRIES THEN
                    RAISE EXCEPTION 'Failed to generate a unique room code after % attempts', MAX_RETRIES;
                END IF;
        END;
    END LOOP;

    -- Add or update the player in the players table
    -- If a player record for this user already exists and is associated with a different room, delete it.
    DELETE FROM public.players 
    WHERE id = v_user_id 
      AND room_id IS NOT NULL 
      AND room_id != v_room_id;

    INSERT INTO public.players (id, room_id, username, is_ready, current_score)
    VALUES (v_user_id, v_room_id, p_username, FALSE, 0)
    ON CONFLICT (id) DO UPDATE 
    SET room_id = v_room_id, 
        username = p_username, 
        is_ready = FALSE, 
        current_score = 0;

    -- Return the new room's ID and code
    RETURN QUERY SELECT v_room_id, v_room_code;
END;
$$;

-- Function: join_room
-- Allows a player to join an existing room using a room code
CREATE OR REPLACE FUNCTION public.join_room(p_room_code TEXT, p_username TEXT)
RETURNS TABLE(joined_room_id UUID, error_message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_room_id UUID;
BEGIN
    -- 1. Authentication and validation
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated to join a room.';
    END IF;
    IF p_username IS NULL OR trim(p_username) = '' THEN
        RAISE EXCEPTION 'Username cannot be empty.';
    END IF;
    IF p_room_code IS NULL OR trim(p_room_code) = '' THEN
        RAISE EXCEPTION 'Room code cannot be empty.';
    END IF;

    -- 2. Find the target room
    SELECT id INTO v_room_id FROM public.rooms WHERE room_code = p_room_code AND status = 'lobby';
    IF v_room_id IS NULL THEN
        RETURN QUERY SELECT NULL::uuid, 'Room not found or is not in lobby state.'::text;
        RETURN;
    END IF;

    -- If a player record for this user already exists and is associated with a different room, delete it.
    DELETE FROM public.players 
    WHERE id = v_user_id 
      AND room_id IS NOT NULL 
      AND room_id != v_room_id;

    -- 3. Add or update the player record
    -- If the player exists (was a ghost), update their record.
    -- If they don't exist, insert a new record.
    INSERT INTO public.players (id, room_id, username, is_ready, current_score)
    VALUES (v_user_id, v_room_id, p_username, FALSE, 0)
    ON CONFLICT (id) DO UPDATE 
    SET room_id = v_room_id, 
        username = p_username, 
        is_ready = FALSE, 
        current_score = 0;

    -- 4. Return success
    RETURN QUERY SELECT v_room_id, NULL::text;
END;
$$;

-- Function: leave_room
-- Allows a player to leave a room, and deletes the room if not enough players remain
CREATE OR REPLACE FUNCTION public.leave_room(p_room_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_remaining_players INTEGER;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated to leave a room.';
    END IF;

    -- Remove the player from the room
    DELETE FROM public.players WHERE id = v_user_id AND room_id = p_room_id;

    -- Count the remaining players in the room
    SELECT COUNT(*) INTO v_remaining_players FROM public.players WHERE room_id = p_room_id;

    -- If the last player has left, delete the room
    IF v_remaining_players = 0 THEN
        DELETE FROM public.rooms WHERE id = p_room_id;
    END IF;
END;
$$; 

-- Function: clean_old_rooms
-- Deletes rooms older than 2 hours that are still in the 'lobby' and their associated players.
CREATE OR REPLACE FUNCTION public.clean_old_rooms()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    -- Stores IDs of rooms to be deleted
    room_ids_to_delete UUID[];
BEGIN
    -- Select all rooms that were created more than 2 hours ago, regardless of status.
    SELECT array_agg(id) INTO room_ids_to_delete
    FROM public.rooms
    WHERE created_at < NOW() - INTERVAL '2 hours';

    -- Proceed only if there are rooms to delete
    IF array_length(room_ids_to_delete, 1) > 0 THEN
        -- Delete all players associated with the rooms being deleted first
        -- to satisfy foreign key constraints.
        DELETE FROM public.players
        WHERE room_id = ANY(room_ids_to_delete);

        -- Delete the rooms themselves.
        DELETE FROM public.rooms
        WHERE id = ANY(room_ids_to_delete);
    END IF;
END;
$$;