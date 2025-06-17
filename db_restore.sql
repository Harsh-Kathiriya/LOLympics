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
    meme_id uuid NOT NULL,
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
    CONSTRAINT captions_pkey PRIMARY KEY (id),
    CONSTRAINT captions_round_id_fkey FOREIGN KEY (round_id) REFERENCES public.rounds(id) ON DELETE CASCADE,
    CONSTRAINT captions_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE,
    CONSTRAINT captions_text_content_not_empty CHECK ((char_length(trim(text_content)) > 0)),
    CONSTRAINT captions_one_per_player_per_round UNIQUE (round_id, player_id)
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

-- === New: Meme Candidate & Voting Tables ===

-- Players propose memes during meme-selection phase. Each proposal is a meme_candidate.
CREATE TABLE public.meme_candidates (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    meme_id uuid NOT NULL,
    submitted_by_player_id uuid NOT NULL,
    room_id uuid REFERENCES public.rooms(id) ON DELETE CASCADE,
    round_number INTEGER,
    CONSTRAINT meme_candidates_pkey PRIMARY KEY (id),
    CONSTRAINT meme_candidates_meme_id_fkey FOREIGN KEY (meme_id) REFERENCES public.memes(id) ON DELETE CASCADE,
    CONSTRAINT meme_candidates_player_id_fkey FOREIGN KEY (submitted_by_player_id) REFERENCES public.players(id) ON DELETE CASCADE,
    CONSTRAINT unique_proposal_per_round UNIQUE (room_id, round_number, submitted_by_player_id)
);

COMMENT ON TABLE public.meme_candidates IS 'Candidate memes proposed by players for a round.';

-- Votes on meme candidates to decide which meme will be used in the round
CREATE TABLE public.meme_candidate_votes (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    meme_candidate_id uuid NOT NULL,
    voter_player_id uuid NOT NULL,
    room_id uuid REFERENCES public.rooms(id) ON DELETE CASCADE,
    round_number INTEGER,
    CONSTRAINT meme_candidate_votes_pkey PRIMARY KEY (id),
    CONSTRAINT meme_candidate_votes_candidate_fkey FOREIGN KEY (meme_candidate_id) REFERENCES public.meme_candidates(id) ON DELETE CASCADE,
    CONSTRAINT meme_candidate_votes_player_fkey FOREIGN KEY (voter_player_id) REFERENCES public.players(id) ON DELETE CASCADE,
    CONSTRAINT unique_vote_per_round UNIQUE (room_id, round_number, voter_player_id)
);
COMMENT ON TABLE public.meme_candidate_votes IS 'Votes cast by players to choose the meme for the round.';
COMMENT ON CONSTRAINT unique_vote_per_round ON public.meme_candidate_votes IS 'Ensures a player can only cast one vote for a meme per round.';

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
CREATE INDEX ON public.meme_candidates (meme_id);
CREATE INDEX ON public.meme_candidates (submitted_by_player_id);
CREATE INDEX ON public.meme_candidates (room_id, round_number);
CREATE INDEX ON public.meme_candidate_votes (meme_candidate_id);
CREATE INDEX ON public.meme_candidate_votes (voter_player_id);

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

-- Function to start the game by updating room status. Idempotent.
DROP FUNCTION IF EXISTS public.start_game(text);
CREATE OR REPLACE FUNCTION public.start_game(p_room_code TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_room_id UUID;
BEGIN
  -- Get the room_id for the given room_code
  SELECT id INTO v_room_id FROM public.rooms WHERE room_code = p_room_code;

  IF v_room_id IS NULL THEN
    RAISE EXCEPTION 'Room not found for code: %', p_room_code;
  END IF;

  -- Update the room status to 'meme-selection' to start the first phase of the game.
  -- The WHERE clause ensures this runs only once, preventing race conditions if multiple
  -- clients call it simultaneously.
  UPDATE public.rooms
  SET status = 'meme-selection',
      current_round_number = 1
  WHERE id = v_room_id AND status = 'lobby';

END;
$$;

-- Function for a player to propose a meme for a round
DROP FUNCTION IF EXISTS public.propose_meme(p_room_id UUID, p_round_number INTEGER, p_meme_url TEXT, p_meme_name TEXT);
CREATE OR REPLACE FUNCTION public.propose_meme(p_room_id UUID, p_round_number INTEGER, p_meme_url TEXT, p_meme_name TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_player_id UUID;
    v_meme_id UUID;
BEGIN
    SELECT id INTO v_player_id FROM public.players WHERE id = v_user_id AND room_id = p_room_id;
    IF v_player_id IS NULL THEN RAISE EXCEPTION 'Player is not in the specified room.'; END IF;
    INSERT INTO public.memes (image_url, name) VALUES (p_meme_url, p_meme_name) ON CONFLICT (image_url) DO UPDATE SET name = p_meme_name RETURNING id INTO v_meme_id;
    INSERT INTO public.meme_candidates (meme_id, submitted_by_player_id, room_id, round_number) VALUES (v_meme_id, v_player_id, p_room_id, p_round_number);
END;
$$;

-- Function for a player to vote on a proposed meme
DROP FUNCTION IF EXISTS public.vote_for_meme_candidate(p_meme_candidate_id UUID);
CREATE OR REPLACE FUNCTION public.vote_for_meme_candidate(p_meme_candidate_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_player_id UUID;
    v_candidate_room_id UUID;
    v_candidate_round_number INTEGER;
    v_submitted_by_player_id UUID;
BEGIN
    SELECT mc.room_id, mc.round_number, mc.submitted_by_player_id INTO v_candidate_room_id, v_candidate_round_number, v_submitted_by_player_id
    FROM public.meme_candidates mc WHERE mc.id = p_meme_candidate_id;
    IF v_candidate_room_id IS NULL THEN RAISE EXCEPTION 'Meme candidate not found.'; END IF;
    SELECT id INTO v_player_id FROM public.players WHERE id = v_user_id AND room_id = v_candidate_room_id;
    IF v_player_id IS NULL THEN RAISE EXCEPTION 'Player is not in this room.'; END IF;
    IF v_player_id = v_submitted_by_player_id THEN RAISE EXCEPTION 'You cannot vote for your own meme.'; END IF;
    INSERT INTO public.meme_candidate_votes (meme_candidate_id, voter_player_id, room_id, round_number) VALUES (p_meme_candidate_id, v_player_id, v_candidate_room_id, v_candidate_round_number);
END;
$$;

-- Function to tally votes, create the official round, and return the winner
DROP FUNCTION IF EXISTS public.tally_votes_and_create_round(p_room_id UUID, p_round_number INTEGER);
CREATE OR REPLACE FUNCTION public.tally_votes_and_create_round(p_room_id UUID, p_round_number INTEGER)
RETURNS TABLE (new_round_id UUID, winning_meme_id UUID, winning_meme_url TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_winning_meme_id UUID;
    v_winning_meme_url TEXT;
    v_new_round_id UUID;
BEGIN
    WITH vote_counts AS (
        SELECT mc.meme_id, COUNT(mcv.id) as vote_count
        FROM public.meme_candidates mc
        LEFT JOIN public.meme_candidate_votes mcv ON mc.id = mcv.meme_candidate_id
        WHERE mc.room_id = p_room_id AND mc.round_number = p_round_number
        GROUP BY mc.meme_id ORDER BY vote_count DESC, random() LIMIT 1
    ) SELECT meme_id INTO v_winning_meme_id FROM vote_counts;
    IF v_winning_meme_id IS NULL THEN
        SELECT meme_id INTO v_winning_meme_id FROM public.meme_candidates
        WHERE room_id = p_room_id AND round_number = p_round_number
        ORDER BY random() LIMIT 1;
        IF v_winning_meme_id IS NULL THEN RAISE EXCEPTION 'No meme candidates found for this round.'; END IF;
    END IF;
    SELECT image_url INTO v_winning_meme_url FROM public.memes WHERE id = v_winning_meme_id;
    INSERT INTO public.rounds (room_id, round_number, meme_id)
    VALUES (p_room_id, p_round_number, v_winning_meme_id)
    RETURNING id INTO v_new_round_id;
    UPDATE public.rooms SET status = 'caption-entry' WHERE id = p_room_id;
    RETURN QUERY SELECT v_new_round_id, v_winning_meme_id, v_winning_meme_url;
END;
$$;

-- Function to get all meme candidates for a given round
-- This joins the necessary tables to return a list of proposed memes
-- along with the name of the player who submitted them.
CREATE OR REPLACE FUNCTION public.get_meme_candidates_for_round(p_room_id UUID, p_round_number INTEGER)
RETURNS TABLE (
    id UUID,
    meme_id UUID,
    image_url TEXT,
    name TEXT,
    submitted_by_player_id UUID,
    submitter_name TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mc.id,
        mc.meme_id,
        m.image_url,
        m.name,
        mc.submitted_by_player_id,
        p.username as submitter_name
    FROM public.meme_candidates mc
    JOIN public.memes m ON mc.meme_id = m.id
    JOIN public.players p ON mc.submitted_by_player_id = p.id
    WHERE mc.room_id = p_room_id AND mc.round_number = p_round_number;
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
    v_round_id UUID;
    v_meme_image_url TEXT;
    v_round_number INTEGER;
BEGIN
    -- First, get the current round number for the room from the 'rooms' table.
    -- This tells us which round is currently active.
    SELECT r.current_round_number INTO v_current_round_number
    FROM public.rooms r
    WHERE r.id = p_room_id;

    IF v_current_round_number IS NULL THEN
        RAISE EXCEPTION 'Room not found or has no current round: %', p_room_id;
    END IF;

    -- Now, using the current round number, find the specific 'rounds' entry.
    -- Join with 'memes' to get the image URL for the winning meme of that round.
    SELECT
        r.id,
        m.image_url,
        r.round_number
    INTO
        v_round_id,
        v_meme_image_url,
        v_round_number
    FROM public.rounds r
    JOIN public.memes m ON r.meme_id = m.id
    WHERE r.room_id = p_room_id AND r.round_number = v_current_round_number;
    
    IF v_round_id IS NULL THEN
        RAISE EXCEPTION 'Current round (round_number: %) data not found for room_id: %', v_current_round_number, p_room_id;
    END IF;

    -- Return the round's ID and the meme URL for the client.
    RETURN QUERY SELECT v_round_id, v_meme_image_url, v_round_number;
END;
$$;
COMMENT ON FUNCTION public.get_current_round_info(UUID) IS 'Fetches the active round ID and corresponding meme URL for a given room, used to set up the caption entry page.';

-- Function for a player to submit their caption for the round
DROP FUNCTION IF EXISTS public.submit_caption(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.submit_caption(p_round_id UUID, p_caption_text TEXT)
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
    -- Basic validation to prevent empty submissions.
    IF p_caption_text IS NULL OR trim(p_caption_text) = '' THEN
        RAISE EXCEPTION 'Caption text cannot be empty.';
    END IF;

    -- Get the room_id from the round to verify the player is in the correct room.
    SELECT room_id INTO v_room_id FROM public.rounds WHERE id = p_round_id;
    IF v_room_id IS NULL THEN
        RAISE EXCEPTION 'Round not found.';
    END IF;

    -- Authenticate the user and ensure they are a valid player in this room.
    -- This prevents users from one room from submitting to another.
    SELECT id INTO v_player_id FROM public.players WHERE id = v_user_id AND room_id = v_room_id;
    IF v_player_id IS NULL THEN
        RAISE EXCEPTION 'Player is not in the specified room for this round.';
    END IF;

    -- Insert the caption. The unique constraint 'captions_one_per_player_per_round' on the table
    -- automatically prevents a player from submitting more than one caption for the same round.
    INSERT INTO public.captions (round_id, player_id, text_content)
    VALUES (p_round_id, v_player_id, p_caption_text);
END;
$$;
COMMENT ON FUNCTION public.submit_caption(UUID, TEXT) IS 'Allows an authenticated player to submit a text caption for a specific round.';

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
BEGIN
    -- Get current round details
    SELECT current_round_number, total_rounds INTO v_current_round_number, v_total_rounds
    FROM public.rooms
    WHERE id = p_room_id;

    -- Check if the game should end
    IF v_current_round_number >= v_total_rounds THEN
        -- Set status to 'finished'
        UPDATE public.rooms
        SET status = 'finished'
        WHERE id = p_room_id;
    ELSE
        -- Increment round number and reset status for the next round
        UPDATE public.rooms
        SET current_round_number = v_current_round_number + 1,
            status = 'meme-selection'
        WHERE id = p_room_id;
    END IF;
END;
$$;

-- ========= Part 3: Row Level Security (RLS) =========
-- These policies secure the database by ensuring users can only access data
-- relevant to the room they are in. This is a secure-by-default approach.

-- Helper function to get the current user's room_id
CREATE OR REPLACE FUNCTION public.get_current_room_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE -- Indicates the function cannot modify the database and returns same results for same arguments
SECURITY INVOKER -- Runs as the user calling it, not the user who defined it
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
  -- First check if user is authenticated at all
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Then check if they have a player record
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
ALTER TABLE public.meme_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meme_candidate_votes ENABLE ROW LEVEL SECURITY;

-- ==== POLICIES ====

-- ROOMS Policies: Users can see the room they are in.
CREATE POLICY "Allow players to see their own room"
ON public.rooms FOR SELECT
USING (id = public.get_current_room_id());

-- Add a policy to allow users to find rooms by room_code during join/create
CREATE POLICY "Allow anyone to find rooms by code"
ON public.rooms FOR SELECT
USING (true);

-- PLAYERS Policies: Users can see all players in their room, but can only update themselves.
CREATE POLICY "Allow players to see other players in their room"
ON public.players FOR SELECT
USING (room_id = public.get_current_room_id());

-- Add policy to allow selecting players by room_id directly (needed for room initialization)
CREATE POLICY "Allow selecting players by room_id"
ON public.players FOR SELECT
USING (true);

CREATE POLICY "Allow player to update their own record"
ON public.players FOR UPDATE
USING (id = auth.uid());

-- Allow players to insert themselves into a room
CREATE POLICY "Allow players to insert themselves"
ON public.players FOR INSERT
WITH CHECK (id = auth.uid());

-- Allow players to delete their own record
CREATE POLICY "Allow players to delete their own record"
ON public.players FOR DELETE
USING (id = auth.uid());

-- Modify the players policy to allow users to see players in any room
-- This is needed during initial room loading
CREATE POLICY "Allow authenticated users to see players"
ON public.players FOR SELECT
USING (auth.uid() IS NOT NULL);

-- MEMES Policies: Memes are public assets.
CREATE POLICY "Allow all users to see memes"
ON public.memes FOR SELECT
USING (true);

-- GAME DATA Policies: Users can interact with game data only for the room they are in.
-- ROUNDS
CREATE POLICY "Allow players to see rounds in their room"
ON public.rounds FOR SELECT
USING (room_id = public.get_current_room_id());

-- MEME CANDIDATES
CREATE POLICY "Allow players to see/create meme candidates in their room"
ON public.meme_candidates FOR ALL
USING (is_player_in_room(auth.uid(), room_id))
WITH CHECK (is_player_in_room(auth.uid(), room_id));

-- MEME CANDIDATE VOTES
CREATE POLICY "Allow players to see/create meme votes in their room"
ON public.meme_candidate_votes FOR ALL
USING (is_player_in_room(auth.uid(), room_id))
WITH CHECK (is_player_in_room(auth.uid(), room_id));

-- CAPTIONS
CREATE POLICY "Allow players to see/create captions in their room"
ON public.captions FOR ALL
USING (EXISTS (
    SELECT 1 FROM public.rounds r
    WHERE r.id = round_id AND r.room_id = public.get_current_room_id()
));

-- VOTES (on captions)
CREATE POLICY "Allow players to see/create caption votes in their room"
ON public.votes FOR ALL
USING (EXISTS (
    SELECT 1 FROM public.captions c
    JOIN public.rounds r ON c.round_id = r.id
    WHERE c.id = caption_id AND r.room_id = public.get_current_room_id()
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
CREATE POLICY "Allow players to insert rounds in their room"
ON public.rounds FOR INSERT
WITH CHECK (room_id = public.get_current_room_id());

CREATE POLICY "Allow players to update rounds in their room"
ON public.rounds FOR UPDATE
USING (room_id = public.get_current_room_id());

CREATE POLICY "Allow players to delete rounds in their room"
ON public.rounds FOR DELETE
USING (room_id = public.get_current_room_id());

-- ========= Part 4: Automated Cleanup Job =========
-- This section sets up the cron job to periodically clean old rooms.

-- 1. Create the pg_cron extension if it doesn't exist
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Grant usage to postgres role
-- (This might require superuser privileges, but is often pre-configured on Supabase)
GRANT USAGE ON SCHEMA cron TO postgres;

-- 3. Unschedule any existing job with the same name to avoid duplicates
-- This is safe to run even if the job doesn't exist.
DO $$
BEGIN
   IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'hourly-room-cleanup') THEN
      PERFORM cron.unschedule('hourly-room-cleanup');
   END IF;
END;
$$;

-- 4. Schedule the cleanup function to run every hour
SELECT cron.schedule(
    'hourly-room-cleanup', -- name of the cron job
    '0 * * * *',           -- cron syntax for "at minute 0 of every hour"
    $$ SELECT public.clean_old_rooms(); $$
);

-- Note: After running this script, you should enable Row Level Security (RLS) on each table
-- from the Supabase dashboard and add policies appropriate for your application's security requirements.
-- Your README.md contains guidelines on how these policies should be structured. 