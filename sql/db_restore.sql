-- Supabase Restoration Script for CaptionClash
-- This script will recreate the necessary tables, functions, and cron jobs.

-- ========= Part 1: Table Creation =========
-- This section creates all the tables required for the application to function,
-- based on the schema described in the README.md and inferred from the client-side code.

-- Create the 'rooms' table to store game session information
CREATE TABLE public.rooms (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    room_code text NOT NULL,
    status text NULL DEFAULT 'lobby'::text,
    game_state jsonb NULL,
    current_round_number integer NOT NULL DEFAULT 0,
    total_rounds integer NOT NULL DEFAULT 5,
    CONSTRAINT rooms_pkey PRIMARY KEY (id),
    CONSTRAINT rooms_room_code_key UNIQUE (room_code),
    CONSTRAINT rooms_total_rounds_positive CHECK ((total_rounds > 0))
);
COMMENT ON TABLE public.rooms IS 'Stores information about game rooms, including status and game state.';
COMMENT ON CONSTRAINT rooms_total_rounds_positive ON public.rooms IS 'Ensures that the total number of rounds is always positive.';

-- Create the 'players' table to store user information within rooms
CREATE TABLE public.players (
    id uuid NOT NULL,
    created_at timestamp with time zone NULL DEFAULT now(),
    room_id uuid NULL,
    username text NOT NULL,
    is_ready boolean NULL DEFAULT false,
    avatar_src text NULL,
    current_score integer NOT NULL DEFAULT 0,
    CONSTRAINT players_pkey PRIMARY KEY (id),
    CONSTRAINT players_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT players_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE,
    CONSTRAINT players_username_not_empty CHECK ((char_length(trim(username)) > 0))
);
COMMENT ON TABLE public.players IS 'Contains details for each player, linked to a room and an authenticated user.';
COMMENT ON CONSTRAINT players_username_not_empty ON public.players IS 'Ensures player usernames are not empty or just whitespace.';

-- Create the 'memes' table to store available memes for the game
CREATE TABLE public.memes (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NULL DEFAULT now(),
    image_url text NOT NULL,
    name text NULL,
    CONSTRAINT memes_pkey PRIMARY KEY (id),
    CONSTRAINT memes_image_url_key UNIQUE (image_url)
);
COMMENT ON TABLE public.memes IS 'A collection of memes available for the game rounds.';
COMMENT ON CONSTRAINT memes_image_url_key ON public.memes IS 'Prevents duplicate meme URLs from being stored.';

-- Create the 'rounds' table to track individual game rounds
CREATE TABLE public.rounds (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    room_id uuid NOT NULL,
    meme_id uuid NULL,
    winning_caption_id uuid NULL,
    round_number integer NULL,
    CONSTRAINT rounds_pkey PRIMARY KEY (id),
    CONSTRAINT rounds_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE,
    CONSTRAINT rounds_meme_id_fkey FOREIGN KEY (meme_id) REFERENCES public.memes(id) ON DELETE CASCADE,
    CONSTRAINT rounds_room_id_round_number_key UNIQUE (room_id, round_number)
);
COMMENT ON TABLE public.rounds IS 'Tracks individual rounds within a game, linking the room, meme, and winning caption.';

-- Create the 'captions' table for submissions by players
CREATE TABLE public.captions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    round_id uuid NOT NULL,
    player_id uuid NOT NULL,
    text_content text NOT NULL,
    position_x NUMERIC NOT NULL DEFAULT 0,
    position_y NUMERIC NOT NULL DEFAULT 0,
    CONSTRAINT captions_pkey PRIMARY KEY (id),
    CONSTRAINT captions_round_id_fkey FOREIGN KEY (round_id) REFERENCES public.rounds(id) ON DELETE CASCADE,
    CONSTRAINT captions_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE,
    CONSTRAINT captions_text_content_not_empty CHECK ((char_length(trim(text_content)) > 0)),
    CONSTRAINT captions_one_per_player_per_round UNIQUE (round_id, player_id),
    CONSTRAINT captions_position_bounds CHECK (position_x BETWEEN 0 AND 100 AND position_y BETWEEN 0 AND 100)
);
COMMENT ON TABLE public.captions IS 'Stores all captions submitted by players for a specific round.';
COMMENT ON CONSTRAINT captions_text_content_not_empty ON public.captions IS 'Ensures that submitted captions are not empty or just whitespace.';
COMMENT ON CONSTRAINT captions_one_per_player_per_round ON public.captions IS 'Ensures a player can only submit one caption per round.';

-- Add a deferred foreign key from 'rounds' to 'captions' to resolve the circular dependency
ALTER TABLE public.rounds
ADD CONSTRAINT rounds_winning_caption_id_fkey FOREIGN KEY (winning_caption_id) REFERENCES public.captions(id) ON DELETE SET NULL;

-- Create the 'votes' table for player votes on captions
CREATE TABLE public.votes (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    round_id uuid NOT NULL,
    caption_id uuid NOT NULL,
    voter_player_id uuid NOT NULL,
    CONSTRAINT votes_pkey PRIMARY KEY (id),
    CONSTRAINT votes_round_id_fkey FOREIGN KEY (round_id) REFERENCES public.rounds(id) ON DELETE CASCADE,
    CONSTRAINT votes_caption_id_fkey FOREIGN KEY (caption_id) REFERENCES public.captions(id) ON DELETE CASCADE,
    CONSTRAINT votes_voter_player_id_fkey FOREIGN KEY (voter_player_id) REFERENCES public.players(id) ON DELETE CASCADE,
    CONSTRAINT votes_one_per_player_per_round UNIQUE (round_id, voter_player_id)
);
COMMENT ON TABLE public.votes IS 'Records votes cast by players for captions in a round.';
COMMENT ON CONSTRAINT votes_one_per_player_per_round ON public.votes IS 'Ensures a player can only cast one vote for a caption per round.';

-- ========= Part 1b: Indexing for Performance =========
-- Indexes are crucial for query performance, especially on foreign key columns.
-- PostgreSQL does not automatically create indexes on foreign keys.

CREATE INDEX ON public.players (room_id);
CREATE INDEX ON public.rounds (room_id);
CREATE INDEX ON public.rounds (meme_id);
CREATE INDEX ON public.rounds (winning_caption_id);
CREATE INDEX ON public.captions (round_id);
CREATE INDEX ON public.captions (player_id);
CREATE INDEX ON public.votes (round_id);
CREATE INDEX ON public.votes (caption_id);
CREATE INDEX ON public.votes (voter_player_id);

-- ========= Part 2: Database Functions =========
-- This section restores all the PostgreSQL functions from your project.

CREATE OR REPLACE FUNCTION public.generate_random_alphanumeric_string(length INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = ''
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

CREATE OR REPLACE FUNCTION public.is_player_in_room(p_player_id UUID, p_room_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.players
        WHERE id = p_player_id AND room_id = p_room_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_room(p_username TEXT)
RETURNS TABLE(new_room_id UUID, generated_room_code TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
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
    LOOP
        v_room_code := public.generate_random_alphanumeric_string(6);
        BEGIN
            INSERT INTO public.rooms (room_code, status, game_state)
            VALUES (v_room_code, 'lobby', '{}'::jsonb)
            RETURNING id INTO v_room_id;
            EXIT;
        EXCEPTION WHEN unique_violation THEN
            RETRY_COUNT := RETRY_COUNT + 1;
            IF RETRY_COUNT >= MAX_RETRIES THEN
                RAISE EXCEPTION 'Failed to generate a unique room code after % attempts', MAX_RETRIES;
            END IF;
        END;
    END LOOP;
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
    RETURN QUERY SELECT v_room_id, v_room_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_room(p_room_code TEXT, p_username TEXT)
RETURNS TABLE(joined_room_id UUID, error_message TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_room_id UUID;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated to join a room.';
    END IF;
    IF p_username IS NULL OR trim(p_username) = '' THEN
        RAISE EXCEPTION 'Username cannot be empty.';
    END IF;
    IF p_room_code IS NULL OR trim(p_room_code) = '' THEN
        RAISE EXCEPTION 'Room code cannot be empty.';
    END IF;
    SELECT id INTO v_room_id FROM public.rooms WHERE room_code = p_room_code AND status = 'lobby';
    IF v_room_id IS NULL THEN
        RETURN QUERY SELECT NULL::uuid, 'Room not found or is not in lobby state.'::text;
        RETURN;
    END IF;
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
    RETURN QUERY SELECT v_room_id, NULL::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_room(p_room_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_remaining_players INTEGER;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated to leave a room.';
    END IF;
    DELETE FROM public.players WHERE id = v_user_id AND room_id = p_room_id;
    SELECT COUNT(*) INTO v_remaining_players FROM public.players WHERE room_id = p_room_id;
    IF v_remaining_players = 0 THEN
        DELETE FROM public.rooms WHERE id = p_room_id;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.clean_old_rooms()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    room_ids_to_delete UUID[];
BEGIN
    SELECT array_agg(id) INTO room_ids_to_delete
    FROM public.rooms
    WHERE created_at < NOW() - INTERVAL '2 hours';

    IF array_length(room_ids_to_delete, 1) > 0 THEN
        DELETE FROM public.players
        WHERE room_id = ANY(room_ids_to_delete);

        DELETE FROM public.rooms
        WHERE id = ANY(room_ids_to_delete);
    END IF;
END;
$$;

-- Function to start the game by updating room status and creating the first round. Idempotent.
DROP FUNCTION IF EXISTS public.start_game(text);
CREATE OR REPLACE FUNCTION public.start_game(p_room_code TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_room_id UUID;
  v_round_id UUID;
BEGIN
  SELECT id INTO v_room_id FROM public.rooms WHERE room_code = p_room_code;
  IF v_room_id IS NULL THEN
    RAISE EXCEPTION 'Room not found for code: %', p_room_code;
  END IF;
  
  -- Only proceed if the room is in lobby state
  IF EXISTS (SELECT 1 FROM public.rooms WHERE id = v_room_id AND status = 'lobby') THEN
    -- Create the first round
    INSERT INTO public.rounds (room_id, round_number)
    VALUES (v_room_id, 1)
    RETURNING id INTO v_round_id;
    
    -- Update the room status
    UPDATE public.rooms
    SET status = 'meme-selection',
        current_round_number = 1
    WHERE id = v_room_id;
  END IF;
END;
$$;


-- Function to get the current round details for the captioning page
DROP FUNCTION IF EXISTS public.get_current_round_info(UUID);
CREATE OR REPLACE FUNCTION public.get_current_round_info(p_room_id UUID)
RETURNS TABLE (
    round_id UUID,
    meme_image_url TEXT,
    round_number INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_current_round_number INTEGER;
BEGIN
    -- Fetch the room's current round
    SELECT current_round_number
      INTO v_current_round_number
      FROM public.rooms
     WHERE id = p_room_id;

    IF v_current_round_number IS NULL THEN
        RAISE EXCEPTION 'Room not found or has no current round: %', p_room_id;
    END IF;

    -- Return the caller''s meme for the current round
    RETURN QUERY
    SELECT r.id,
           m.image_url,
           r.round_number
      FROM public.rounds r
      JOIN public.player_round_memes prm
        ON prm.round_id = r.id
       AND prm.player_id = auth.uid()
      JOIN public.memes m
        ON m.id = prm.meme_id
     WHERE r.room_id = p_room_id
       AND r.round_number = v_current_round_number;
END;
$$;
COMMENT ON FUNCTION public.get_current_round_info(UUID) IS 'Returns round id, the caller''s selected meme URL, and round number for caption entry.';

-- Function for a player to submit their caption for the round
DROP FUNCTION IF EXISTS public.submit_caption(UUID, TEXT);
DROP FUNCTION IF EXISTS public.submit_caption(UUID, TEXT, NUMERIC, NUMERIC);
CREATE OR REPLACE FUNCTION public.submit_caption(
    p_round_id UUID, 
    p_caption_text TEXT,
    p_position_x NUMERIC DEFAULT 50,
    p_position_y NUMERIC DEFAULT 50
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_player_id UUID;
    v_room_id UUID;
BEGIN
    IF p_caption_text IS NULL OR trim(p_caption_text) = '' THEN
        RAISE EXCEPTION 'Caption text cannot be empty.';
    END IF;
    
    -- Validate position values
    IF p_position_x < 0 OR p_position_x > 100 OR p_position_y < 0 OR p_position_y > 100 THEN
        RAISE EXCEPTION 'Position values must be between 0 and 100.';
    END IF;
    
    SELECT room_id INTO v_room_id FROM public.rounds WHERE id = p_round_id;
    IF v_room_id IS NULL THEN
        RAISE EXCEPTION 'Round not found.';
    END IF;
    
    SELECT id INTO v_player_id FROM public.players WHERE id = v_user_id AND room_id = v_room_id;
    IF v_player_id IS NULL THEN
        RAISE EXCEPTION 'Player is not in the specified room for this round.';
    END IF;
    
    INSERT INTO public.captions (round_id, player_id, text_content, position_x, position_y)
    VALUES (p_round_id, v_player_id, p_caption_text, p_position_x, p_position_y);
END;
$$;
COMMENT ON FUNCTION public.submit_caption(UUID, TEXT, NUMERIC, NUMERIC) IS 'Allows an authenticated player to submit a text caption with positioning for a specific round.';

-- Function for a player to vote on a submitted caption
DROP FUNCTION IF EXISTS public.submit_caption_vote(p_caption_id UUID);
CREATE OR REPLACE FUNCTION public.submit_caption_vote(p_caption_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_round_id UUID;
    v_caption_author_id UUID;
    v_room_id UUID;
BEGIN
    SELECT c.round_id, c.player_id INTO v_round_id, v_caption_author_id
    FROM public.captions c
    WHERE c.id = p_caption_id;
    IF v_round_id IS NULL THEN
        RAISE EXCEPTION 'Caption not found.';
    END IF;
    SELECT r.room_id INTO v_room_id
    FROM public.rounds r
    WHERE r.id = v_round_id;
    IF NOT public.is_player_in_room(v_user_id, v_room_id) THEN
        RAISE EXCEPTION 'Player is not in the correct room for this vote.';
    END IF;
    IF v_user_id = v_caption_author_id THEN
        RAISE EXCEPTION 'You cannot vote for your own caption.';
    END IF;
    INSERT INTO public.votes (round_id, caption_id, voter_player_id)
    VALUES (v_round_id, p_caption_id, v_user_id);
END;
$$;
COMMENT ON FUNCTION public.submit_caption_vote(UUID) IS 'Allows an authenticated player to cast a vote for a caption, with validation.';

-- Function to tally caption votes, award points, and finalize the round
DROP FUNCTION IF EXISTS public.tally_caption_votes_and_finalize_round(p_round_id UUID);
CREATE OR REPLACE FUNCTION public.tally_caption_votes_and_finalize_round(p_round_id UUID)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_room_id            UUID;
    v_is_finalized       BOOLEAN;
    v_max_votes          INT;
    v_points_per_winner  INT := 0;
    v_featured_caption   UUID;
BEGIN
    -- 1. Lock the round; only one tally runs
    SELECT room_id,
           winning_caption_id IS NOT NULL
      INTO v_room_id,
           v_is_finalized
      FROM public.rounds
     WHERE id = p_round_id
     FOR UPDATE;

    IF v_is_finalized THEN
        RETURN TRUE; -- already tallied
    END IF;

    -- 2. Highest vote count (may be zero)
    SELECT COALESCE(MAX(vote_cnt),0)
      INTO v_max_votes
      FROM (
            SELECT COUNT(*) AS vote_cnt
              FROM public.votes
             WHERE round_id = p_round_id
          GROUP BY caption_id
           ) vc;

    -- 3. Points per winner (split 100) if at least one vote
    IF v_max_votes > 0 THEN
        SELECT FLOOR(100.0 / (
            SELECT COUNT(*)
              FROM (
                    SELECT 1
                      FROM public.votes
                     WHERE round_id = p_round_id
                  GROUP BY caption_id
                    HAVING COUNT(*) = v_max_votes
                   ) winners))
          INTO v_points_per_winner;
    END IF;

    -- 4. Award points to each winning caption author (DISTINCT to avoid dup rows)
    IF v_points_per_winner > 0 THEN
        UPDATE public.players
           SET current_score = current_score + v_points_per_winner
         WHERE id IN (
            SELECT DISTINCT player_id
              FROM public.captions
             WHERE id IN (
                    SELECT caption_id
                      FROM public.votes
                     WHERE round_id = p_round_id
                 GROUP BY caption_id
                   HAVING COUNT(*) = v_max_votes
                   )
        );
    END IF;

    -- 5. Choose a featured caption (random tie-breaker / includes 0-vote case)
    SELECT c.id
      INTO v_featured_caption
      FROM public.captions c
 LEFT JOIN public.votes v ON v.caption_id = c.id
     WHERE c.round_id = p_round_id
  GROUP BY c.id
  ORDER BY COUNT(v.id) DESC, RANDOM()
     LIMIT 1;

    -- 6. Finalize round & update room status
    UPDATE public.rounds
       SET winning_caption_id = v_featured_caption
     WHERE id = p_round_id;

    UPDATE public.rooms
       SET status = 'round-results'
     WHERE id   = v_room_id;

    RETURN TRUE;
END;
$$;
COMMENT ON FUNCTION public.tally_caption_votes_and_finalize_round(UUID) IS 'Tallies votes, splits 100 points evenly among tied winners, always finalizes the round and moves room to round-results.';

-- Function to get all details for the round results page in one call
DROP FUNCTION IF EXISTS public.get_round_results_details(p_round_id UUID);
CREATE OR REPLACE FUNCTION public.get_round_results_details(p_round_id UUID)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_results jsonb;
    v_max_votes INT;
    v_points_per_winner INT := 0;
BEGIN
    -- Highest vote count for any caption in the round
    SELECT COALESCE(MAX(votes), 0) INTO v_max_votes
      FROM (
            SELECT COUNT(id) AS votes
              FROM public.votes
             WHERE round_id = p_round_id
          GROUP BY caption_id
           ) vc;

    -- Points awarded to each winning caption author (split 100 amongst them)
    IF v_max_votes > 0 THEN
        v_points_per_winner := floor(100 / (
            SELECT COUNT(*)
              FROM (
                    SELECT 1
                      FROM public.votes
                     WHERE round_id = p_round_id
                  GROUP BY caption_id
                    HAVING COUNT(id) = v_max_votes
                   ) winners
        ));
    END IF;

    -- Build JSON payload for the results screen
    SELECT jsonb_build_object(
        'currentRound', r.round_number,
        'totalRounds', rm.total_rounds,
        'pointsAwarded', v_points_per_winner,
        'winningCaptions', (
            SELECT jsonb_agg(
                       jsonb_build_object(
                           'id',        wc.id,
                           'text',      wc.text_content,
                           'authorId',  wc.player_id,
                           'authorName',p.username,
                           'avatarUrl', p.avatar_src,
                           'memeUrl',   m.image_url,
                           'positionX', wc.position_x,
                           'positionY', wc.position_y
                       )
                   )
              FROM public.captions wc
              JOIN public.players p
                ON p.id = wc.player_id
              JOIN public.player_round_memes prm
                ON prm.round_id = wc.round_id
               AND prm.player_id = wc.player_id
              JOIN public.memes m
                ON m.id = prm.meme_id
             WHERE wc.round_id = p_round_id
               AND wc.id IN (
                    SELECT caption_id
                      FROM (
                            SELECT caption_id, COUNT(id) AS vote_count
                              FROM public.votes
                             WHERE round_id = p_round_id
                          GROUP BY caption_id
                            HAVING COUNT(id) = v_max_votes
                           ) winning_ids
               )
        ),
        'players', (
            SELECT jsonb_agg(
                       jsonb_build_object(
                           'id',        pl.id,
                           'name',      pl.username,
                           'score',     pl.current_score,
                           'avatarUrl', pl.avatar_src
                       ) ORDER BY pl.current_score DESC
                   )
              FROM public.players pl
             WHERE pl.room_id = r.room_id
        )
    )
    INTO v_results
    FROM public.rounds r
    JOIN public.rooms rm ON rm.id = r.room_id
   WHERE r.id = p_round_id;

    RETURN v_results;
END;
$$;
COMMENT ON FUNCTION public.get_round_results_details(UUID) IS 'Aggregates round results, returning winning captions each with its associated meme URL and position coordinates.';

-- Function to advance the game to the next round
DROP FUNCTION IF EXISTS public.advance_to_next_round(p_room_id UUID);
CREATE OR REPLACE FUNCTION public.advance_to_next_round(p_room_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_current_round_number INTEGER;
  v_total_rounds INTEGER;
  v_next_round_number INTEGER;
  v_round_id UUID;
BEGIN
    SELECT current_round_number, total_rounds INTO v_current_round_number, v_total_rounds
    FROM public.rooms
    WHERE id = p_room_id;
    
    IF v_current_round_number >= v_total_rounds THEN
        -- End the game if we've reached the total rounds
        UPDATE public.rooms
        SET status = 'finished'
        WHERE id = p_room_id;
    ELSE
        -- Calculate the next round number
        v_next_round_number := v_current_round_number + 1;
        
        -- Create the next round
        INSERT INTO public.rounds (room_id, round_number)
        VALUES (p_room_id, v_next_round_number)
        RETURNING id INTO v_round_id;
        
        -- Update the room status
        UPDATE public.rooms
        SET current_round_number = v_next_round_number,
            status = 'meme-selection'
        WHERE id = p_room_id;
    END IF;
END;
$$;

-- New function to reset a game for "Play Again"
DROP FUNCTION IF EXISTS public.reset_game(p_room_id UUID);
CREATE OR REPLACE FUNCTION public.reset_game(p_room_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF NOT public.is_player_in_room(v_user_id, p_room_id) THEN
        RAISE EXCEPTION 'Only a player in the room can restart the game.';
    END IF;
    UPDATE public.players
    SET current_score = 0,
        is_ready = FALSE
    WHERE room_id = p_room_id;
    DELETE FROM public.rounds WHERE room_id = p_room_id;
    UPDATE public.rooms
    SET current_round_number = 1,
        status = 'lobby'
    WHERE id = p_room_id;
END;
$$;
COMMENT ON FUNCTION public.reset_game(UUID) IS 'Resets a finished game back to the lobby state with the same players.';

-- ========= Part 3: Row Level Security (RLS) =========
-- These policies secure the database by ensuring users can only access data
-- relevant to the room they are in. This is a secure-by-default approach.

-- Helper function to get the current user's room_id
CREATE OR REPLACE FUNCTION public.get_current_room_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    RETURN (
        SELECT room_id FROM public.players WHERE id = auth.uid()
    );
END;
$$;

-- Helper function to check if a user is authenticated and has a player record
CREATE OR REPLACE FUNCTION public.is_authenticated_player()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.players WHERE id = auth.uid()
  );
END;
$$;

-- Enable RLS on all tables
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.captions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

-- ==== POLICIES ====

-- ROOMS Policies: Users can see the room they are in.
DROP POLICY IF EXISTS "Allow players to see their own room" ON public.rooms;
CREATE POLICY "Allow players to see their own room"
ON public.rooms FOR SELECT
USING (id = public.get_current_room_id());

DROP POLICY IF EXISTS "Allow anyone to find rooms by code" ON public.rooms;
CREATE POLICY "Allow anyone to find rooms by code"
ON public.rooms FOR SELECT
USING (true);

-- PLAYERS Policies: Users can see all players in their room, but can only update themselves.
DROP POLICY IF EXISTS "Allow players to see other players in their room" ON public.players;
CREATE POLICY "Allow players to see other players in their room"
ON public.players FOR SELECT
USING (room_id = public.get_current_room_id());

DROP POLICY IF EXISTS "Allow selecting players by room_id" ON public.players;
CREATE POLICY "Allow selecting players by room_id"
ON public.players FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Allow player to update their own record" ON public.players;
CREATE POLICY "Allow player to update their own record"
ON public.players FOR UPDATE
USING (id = auth.uid());

DROP POLICY IF EXISTS "Allow players to insert themselves" ON public.players;
CREATE POLICY "Allow players to insert themselves"
ON public.players FOR INSERT
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Allow players to delete their own record" ON public.players;
CREATE POLICY "Allow players to delete their own record"
ON public.players FOR DELETE
USING (id = auth.uid());

DROP POLICY IF EXISTS "Allow authenticated users to see players" ON public.players;
CREATE POLICY "Allow authenticated users to see players"
ON public.players FOR SELECT
USING (auth.uid() IS NOT NULL);

-- MEMES Policies: Memes are public assets.
DROP POLICY IF EXISTS "Allow all users to see memes" ON public.memes;
CREATE POLICY "Allow all users to see memes"
ON public.memes FOR SELECT
USING (true);

-- GAME DATA Policies: Users can interact with game data only for the room they are in.
-- ROUNDS
DROP POLICY IF EXISTS "Allow players to see rounds in their room" ON public.rounds;
CREATE POLICY "Allow players to see rounds in their room"
ON public.rounds FOR SELECT
USING (room_id = public.get_current_room_id());

-- MEME CANDIDATES (obsolete) -- commented out
-- DROP POLICY IF EXISTS "Allow players to see/create meme candidates in their room" ON public.meme_candidates;
-- CREATE POLICY "Allow players to see/create meme candidates in their room"
-- ON public.meme_candidates FOR ALL
-- USING (is_player_in_room(auth.uid(), room_id))
-- WITH CHECK (is_player_in_room(auth.uid(), room_id));

-- MEME CANDIDATE VOTES (obsolete) -- commented out
-- DROP POLICY IF EXISTS "Allow players to see/create meme votes in their room" ON public.meme_candidate_votes;
-- CREATE POLICY "Allow players to see/create meme votes in their room"
-- ON public.meme_candidate_votes FOR ALL
-- USING (is_player_in_room(auth.uid(), room_id))
-- WITH CHECK (is_player_in_room(auth.uid(), room_id));

-- CAPTIONS
DROP POLICY IF EXISTS "Allow players to see/create captions in their room" ON public.captions;
CREATE POLICY "Allow players to see/create captions in their room"
ON public.captions FOR ALL
USING (EXISTS (
    SELECT 1 FROM public.rounds r
    WHERE r.id = round_id AND r.room_id = public.get_current_room_id()
));

-- VOTES (on captions)
DROP POLICY IF EXISTS "Allow players to see/create caption votes in their room" ON public.votes;
CREATE POLICY "Allow players to see/create caption votes in their room"
ON public.votes FOR ALL
USING (EXISTS (
    SELECT 1 FROM public.rounds r
    WHERE r.id = round_id AND r.room_id = public.get_current_room_id()
));

-- Add debugging function to help diagnose RLS issues
CREATE OR REPLACE FUNCTION public.debug_auth()
RETURNS TABLE(
  role TEXT,
  uid UUID,
  email TEXT,
  in_room UUID
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY SELECT 
    current_setting('request.jwt.claims', true)::json->>'role' as role,
    (current_setting('request.jwt.claims', true)::json->>'sub')::uuid as uid,
    current_setting('request.jwt.claims', true)::json->>'email' as email,
    (SELECT room_id FROM public.players WHERE id = auth.uid()) as in_room;
END;
$$;

-- Fix the ROUNDS policy to use proper room_id check
DROP POLICY IF EXISTS "Allow players to insert rounds in their room" ON public.rounds;
CREATE POLICY "Allow players to insert rounds in their room"
ON public.rounds FOR INSERT
WITH CHECK (room_id = public.get_current_room_id());

DROP POLICY IF EXISTS "Allow players to update rounds in their room" ON public.rounds;
CREATE POLICY "Allow players to update rounds in their room"
ON public.rounds FOR UPDATE
USING (room_id = public.get_current_room_id());

DROP POLICY IF EXISTS "Allow players to delete rounds in their room" ON public.rounds;
CREATE POLICY "Allow players to delete rounds in their room"
ON public.rounds FOR DELETE
USING (room_id = public.get_current_room_id());

-- ========= Part 4: Automated Cleanup Job =========
-- This section sets up the cron job to periodically clean old rooms.

CREATE EXTENSION IF NOT EXISTS pg_cron;
GRANT USAGE ON SCHEMA cron TO postgres;

DO $$
BEGIN
   IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'hourly-room-cleanup') THEN
      PERFORM cron.unschedule('hourly-room-cleanup');
   END IF;
END;
$$;

SELECT cron.schedule(
    'hourly-room-cleanup',
    '0 * * * *',
    $$ SELECT public.clean_old_rooms(); $$
);

-- ================================================
--  FLOW UPDATE (v2): Per-Player Meme Selection
--  Date: 2025-06-24
-- ================================================

-- 1. Deprecate and remove obsolete objects -----------------------------

-- Drop outdated functions related to shared meme voting
DROP FUNCTION IF EXISTS public.propose_meme(UUID, INTEGER, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.vote_for_meme_candidate(UUID);
DROP FUNCTION IF EXISTS public.tally_votes_and_create_round(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.get_meme_candidates_for_round(UUID, INTEGER);

-- Drop the old meme-candidate tables (cascades drop their policies & indexes)
DROP TABLE IF EXISTS public.meme_candidate_votes CASCADE;
DROP TABLE IF EXISTS public.meme_candidates CASCADE;

-- 2. Schema adjustments -------------------------------------------------

-- Make rounds.meme_id optional (single meme per round no longer required)
ALTER TABLE public.rounds ALTER COLUMN meme_id DROP NOT NULL;

-- Add absolute caption placement to the captions table
ALTER TABLE public.captions
  ADD COLUMN IF NOT EXISTS position_x NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS position_y NUMERIC NOT NULL DEFAULT 0;

-- Add position bounds constraint (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'captions_position_bounds' AND conrelid = 'public.captions'::regclass
  ) THEN
    ALTER TABLE public.captions
      ADD CONSTRAINT captions_position_bounds
      CHECK (position_x BETWEEN 0 AND 100 AND position_y BETWEEN 0 AND 100);
  END IF;
END $$;

-- New table: each player selects exactly one meme for each round --------
CREATE TABLE IF NOT EXISTS public.player_round_memes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    round_id UUID NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    meme_id UUID NOT NULL REFERENCES public.memes(id) ON DELETE CASCADE,
    CONSTRAINT unique_player_per_round UNIQUE (round_id, player_id)
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_player_round_memes_round ON public.player_round_memes(round_id);
CREATE INDEX IF NOT EXISTS idx_player_round_memes_player ON public.player_round_memes(player_id);

-- New persistent table: stores player meme selections without CASCADE DELETE constraints
-- This allows data to be retained even when rounds/players are deleted
CREATE TABLE IF NOT EXISTS public.persistent_meme_selections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    round_id UUID NOT NULL,
    player_id UUID NOT NULL,
    meme_id UUID NOT NULL REFERENCES public.memes(id) ON DELETE SET NULL,
    room_code TEXT NOT NULL,
    username TEXT NOT NULL,
    round_number INTEGER NOT NULL,
    meme_url TEXT NOT NULL
);

-- Indexes for the persistent table
CREATE INDEX IF NOT EXISTS idx_persistent_meme_selections_player ON public.persistent_meme_selections(player_id);
CREATE INDEX IF NOT EXISTS idx_persistent_meme_selections_meme ON public.persistent_meme_selections(meme_id);
CREATE INDEX IF NOT EXISTS idx_persistent_meme_selections_room ON public.persistent_meme_selections(room_code);

-- 3. Row-Level Security for new table ----------------------------------
ALTER TABLE public.player_round_memes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow players to interact with their memes" ON public.player_round_memes;
-- New granular row-level security policies for per-player meme selections

--  SELECT: any player in the same room can read selections
CREATE POLICY "Players can view meme selections in their room"
ON public.player_round_memes FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.rounds r
        WHERE r.id = round_id
          AND r.room_id = public.get_current_room_id()
    )
);

--  INSERT: only the authenticated player may create their own selection for a round in their current room
CREATE POLICY "Players can insert their own meme selection"
ON public.player_round_memes FOR INSERT
WITH CHECK (
    player_id = auth.uid()
    AND EXISTS (
        SELECT 1 FROM public.rounds r
        WHERE r.id = round_id
          AND r.room_id = public.get_current_room_id()
    )
);

--  UPDATE: a player may change **their own** selection (e.g., before the phase timeout)
CREATE POLICY "Players can update their own meme selection"
ON public.player_round_memes FOR UPDATE
USING (
    player_id = auth.uid()
    AND EXISTS (
        SELECT 1 FROM public.rounds r
        WHERE r.id = round_id
          AND r.room_id = public.get_current_room_id()
    )
)
WITH CHECK (player_id = auth.uid());

--  DELETE: allow a player to retract their own selection (rare; mainly for cleanup)
CREATE POLICY "Players can delete their own meme selection"
ON public.player_round_memes FOR DELETE
USING (
    player_id = auth.uid()
    AND EXISTS (
        SELECT 1 FROM public.rounds r
        WHERE r.id = round_id
          AND r.room_id = public.get_current_room_id()
    )
);

-- RLS for persistent meme selections table
ALTER TABLE public.persistent_meme_selections ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view persistent meme selections (for analytics)
CREATE POLICY "Anyone can view persistent meme selections"
ON public.persistent_meme_selections FOR SELECT
USING (true);

-- Only allow system functions to insert into persistent meme selections
CREATE POLICY "System functions can insert persistent meme selections"
ON public.persistent_meme_selections FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- 4. New RPC: select_player_meme ---------------------------------------
CREATE OR REPLACE FUNCTION public.select_player_meme(
    p_round_id UUID,
    p_meme_url TEXT,
    p_meme_name TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id  UUID := auth.uid();
    v_room_id  UUID;
    v_meme_id  UUID;
    v_room_code TEXT;
    v_username TEXT;
    v_round_number INTEGER;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated.';
    END IF;

    -- Validate round & room
    SELECT r.room_id, r.round_number, rooms.room_code 
    INTO v_room_id, v_round_number, v_room_code 
    FROM public.rounds r
    JOIN public.rooms ON rooms.id = r.room_id
    WHERE r.id = p_round_id;
    
    IF v_room_id IS NULL THEN
        RAISE EXCEPTION 'Round not found.';
    END IF;

    IF NOT public.is_player_in_room(v_user_id, v_room_id) THEN
        RAISE EXCEPTION 'Player is not in the specified room.';
    END IF;
    
    -- Get player username
    SELECT username INTO v_username FROM public.players WHERE id = v_user_id;

    -- Upsert meme (ensures deduplication by URL)
    INSERT INTO public.memes (image_url, name)
    VALUES (p_meme_url, p_meme_name)
    ON CONFLICT (image_url) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_meme_id;

    -- Upsert player-round meme selection
    INSERT INTO public.player_round_memes (round_id, player_id, meme_id)
    VALUES (p_round_id, v_user_id, v_meme_id)
    ON CONFLICT (round_id, player_id) DO UPDATE SET meme_id = EXCLUDED.meme_id;
    
    -- Also insert into persistent meme selections table
    INSERT INTO public.persistent_meme_selections (
        round_id, player_id, meme_id, room_code, username, round_number, meme_url
    ) VALUES (
        p_round_id, v_user_id, v_meme_id, v_room_code, v_username, v_round_number, p_meme_url
    );

    -- If everyone in the room has selected a meme, move to caption-entry
    IF (
        SELECT COUNT(*) FROM public.player_round_memes prm WHERE prm.round_id = p_round_id
    ) = (
        SELECT COUNT(*) FROM public.players p WHERE p.room_id = v_room_id
    ) THEN
        UPDATE public.rooms SET status = 'caption-entry' WHERE id = v_room_id;
    END IF;
END;
$$;

COMMENT ON FUNCTION public.select_player_meme(UUID, TEXT, TEXT) IS 'Allows a player to pick a meme for the current round; automatically advances the room to caption-entry once all players have chosen.';

-- 5. Meme auto-cleanup --------------------------------------------------
CREATE OR REPLACE FUNCTION public.clean_old_memes(max_keep INTEGER DEFAULT 1000)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_total        INTEGER;
    v_delete_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total FROM public.memes;
    IF v_total > max_keep THEN
        v_delete_count := v_total - max_keep;
        DELETE FROM public.memes
        WHERE id IN (
            SELECT id FROM public.memes ORDER BY created_at ASC LIMIT v_delete_count
        );
    END IF;
END;
$$;

-- Update meme cleanup schedule: run every 2 days at 00:00 UTC
DO $$
BEGIN
   -- Remove any prior meme-cleanup jobs
   IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'hourly-meme-cleanup') THEN
      PERFORM cron.unschedule('hourly-meme-cleanup');
   END IF;
   IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bi-daily-meme-cleanup') THEN
      PERFORM cron.unschedule('bi-daily-meme-cleanup');
   END IF;
END;
$$;

SELECT cron.schedule(
    'bi-daily-meme-cleanup',
    '0 0 */2 * *',
    $$ SELECT public.clean_old_memes(1000); $$
);

-- 6. Function to query persistent meme selections for analytics ---------
CREATE OR REPLACE FUNCTION public.get_meme_selection_analytics(
    p_days_back INTEGER DEFAULT 30,
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
    meme_url TEXT,
    selection_count BIGINT,
    distinct_players BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pms.meme_url,
        COUNT(*) as selection_count,
        COUNT(DISTINCT pms.player_id) as distinct_players
    FROM 
        public.persistent_meme_selections pms
    WHERE 
        pms.created_at > NOW() - (p_days_back || ' days')::INTERVAL
    GROUP BY 
        pms.meme_url
    ORDER BY 
        selection_count DESC
    LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION public.get_meme_selection_analytics(INTEGER, INTEGER) IS 'Returns analytics on meme selections over a specified time period.';

-- ================================================
--  END OF FLOW UPDATE (v2)
-- ================================================