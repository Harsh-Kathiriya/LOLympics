# LOLympics Database Design

## Overview

LOLympics uses a PostgreSQL database with Supabase for authentication and real-time functionality. The database is designed to support a multiplayer meme captioning game with the following features:

- Room-based gameplay with unique join codes
- Player management with avatars and scoring
- Round-based gameplay with meme selection, caption submission, and voting
- Persistent analytics for game improvement

## Schema Design

### Core Tables

#### `rooms`
- Central table for game sessions
- Tracks game state, round progression, and status
- Uses a unique room code for easy joining

```sql
CREATE TABLE public.rooms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    room_code text NOT NULL UNIQUE,
    status text DEFAULT 'lobby',
    game_state jsonb,
    current_round_number integer NOT NULL DEFAULT 0,
    total_rounds integer NOT NULL DEFAULT 5
);
```

#### `players`
- Links authenticated users to game rooms
- Stores player metadata (username, avatar, score)
- Enforces username validation

```sql
CREATE TABLE public.players (
    id uuid PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    room_id uuid REFERENCES public.rooms(id) ON DELETE CASCADE,
    username text NOT NULL,
    is_ready boolean DEFAULT false,
    avatar_src text,
    current_score integer NOT NULL DEFAULT 0
);
```

#### `memes`
- Repository of meme images available for gameplay
- Prevents duplicate meme URLs

```sql
CREATE TABLE public.memes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz DEFAULT now(),
    image_url text NOT NULL UNIQUE,
    name text
);
```

### Gameplay Tables

#### `rounds`
- Tracks individual game rounds
- Links to the room and selected meme
- Stores the winning caption

```sql
CREATE TABLE public.rounds (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    meme_id uuid REFERENCES public.memes(id) ON DELETE CASCADE,
    winning_caption_id uuid REFERENCES public.captions(id) ON DELETE SET NULL,
    round_number integer
);
```

#### `player_round_memes`
- Maps player-selected memes to specific rounds
- Enables per-player meme selection

```sql
CREATE TABLE public.player_round_memes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    round_id uuid NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
    player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    meme_id uuid NOT NULL REFERENCES public.memes(id) ON DELETE CASCADE,
    CONSTRAINT unique_player_per_round UNIQUE (round_id, player_id)
);
```

#### `captions`
- Stores player-submitted captions
- Includes positioning data for caption placement on memes
- Enforces one caption per player per round

```sql
CREATE TABLE public.captions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    round_id uuid NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
    player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    text_content text NOT NULL,
    position_x numeric NOT NULL DEFAULT 0,
    position_y numeric NOT NULL DEFAULT 0
);
```

#### `votes`
- Records player votes for captions
- Enforces one vote per player per round
- Used for determining round winners

```sql
CREATE TABLE public.votes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    round_id uuid NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
    caption_id uuid NOT NULL REFERENCES public.captions(id) ON DELETE CASCADE,
    voter_player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE
);
```

#### `persistent_meme_selections`
- Analytics table for tracking meme popularity
- Retains data even when rooms/rounds are deleted
- Used for future game improvements

```sql
CREATE TABLE public.persistent_meme_selections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    round_id uuid NOT NULL,
    player_id uuid NOT NULL,
    meme_id uuid NOT NULL REFERENCES public.memes(id) ON DELETE SET NULL,
    room_code text NOT NULL,
    username text NOT NULL,
    round_number integer NOT NULL,
    meme_url text NOT NULL
);
```

## Security Model

The database implements Row Level Security (RLS) to ensure players can only:
- See data relevant to their current room
- Modify only their own player data
- Submit captions/votes only for their current room's rounds

Key security functions:
- `is_player_in_room()`: Validates player membership in a room
- `get_current_room_id()`: Helper for RLS policies

## Key Database Functions

### Room Management
- `create_room()`: Creates a new game room with unique code
- `join_room()`: Allows players to join existing rooms
- `leave_room()`: Handles player departure and room cleanup
- `clean_old_rooms()`: Automated cleanup of inactive rooms

### Game Flow
- `start_game()`: Initializes the first round
- `advance_to_next_round()`: Progresses to the next round
- `reset_game()`: Resets a finished game for replay

### Gameplay Actions
- `select_player_meme()`: Records a player's meme selection
- `submit_caption()`: Stores a player's caption submission
- `submit_caption_vote()`: Records a player's vote
- `tally_caption_votes_and_finalize_round()`: Determines winners and awards points

### Analytics
- `get_meme_selection_analytics()`: Retrieves meme popularity data

## Maintenance

The database includes automated maintenance:
- Room cleanup: Removes rooms inactive for 2+ hours
- Meme cleanup: Limits total memes to prevent database bloat

## Indexing Strategy

Indexes are created on:
- Foreign key columns for performance
- Commonly queried fields
- Fields used in RLS policies

## Design Principles

1. **Data Integrity**: Constraints and validation ensure data consistency
2. **Security**: Row Level Security restricts access to authorized users
3. **Performance**: Indexing and efficient query design
4. **Analytics**: Persistent data collection for future improvements
5. **Maintainability**: Automated cleanup to prevent database bloat 