# Caption Clash

A real-time multiplayer meme captioning game where players compete to write the funniest captions for popular memes.

## Core Technologies

*   **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS
*   **Real-time:** Ably (for future integration)
*   **Backend & Database:** Supabase (for future integration)
*   **UI Components:** Shadcn/ui (inferred), Lucide Icons

## Key Features (Current & Planned)

*   Create and join game rooms.
*   Real-time lobby with player ready-up status.
*   Customizable player profiles with avatar selection.
*   (Planned) Meme selection phase.
*   (Planned) Caption submission phase.
*   (Planned) Caption voting phase.
*   (Planned) Round and final game results.
*   (Planned) Real-time updates for all game events.

## How It Works (Application Flow)

Caption Clash takes players through a series of fun and interactive stages:

1.  **Homepage (`/`)**
    *   **Action:** Players can choose to create a new game room or enter an existing room code.
    *   **Functionality:**
        *   *Create Room:* Player enters a nickname, then the system generates a unique room ID (handled by Supabase to ensure uniqueness and persistence), and navigates the player to the room lobby. Importantly, if the player was previously associated with another room, that association is cleared upon creating a new room.
        *   *Join Room:* Validates the entered room code (will check against Supabase) and navigates the player to the room lobby. Similar to room creation, if the player was previously associated with another room, that association is cleared upon joining a new room.

2.  **Lobby (`/room/[roomCode]`)**
    *   **Action:** Players gather before the game starts. They can see other connected players, customize their avatar and name, and toggle their "ready" status.
    *   **Functionality:**
        *   Displays the unique room code for sharing.
        *   Lists all players currently in the room (player data managed by Supabase, presence and ready status updates via Ably).
        *   Players can customize their profile by selecting from a variety of fun avatars and changing their display name.
        *   Players can mark themselves as "ready".
        *   The game automatically starts when all players are ready.
        *   A countdown initiates the game start, and all players are transitioned to the first game phase simultaneously (state transition managed by Supabase and communicated via Ably).

3.  **Meme Proposal (`/room/[roomCode]/meme-selection`)**
    *   **Action:** Each player finds and proposes one meme for the round.
    *   **Functionality:**
        *   Players can search the Tenor API for GIFs or use the trending memes provided.
        *   Each player selects one meme. This choice is recorded as a `meme_candidate` in the database via the `propose_meme` function.
        *   A timer keeps the phase moving. If a player doesn't choose, a random meme is submitted for them when time expires.
        *   Once the timer ends, all players are navigated to the voting page.

4.  **Meme Voting (`/room/[roomCode]/meme-voting`)**
    *   **Action:** Players vote on the collection of proposed memes.
    *   **Functionality:**
        *   The page waits until all players have submitted their proposals, then displays all candidate memes.
        *   Players cast one vote for their favorite meme (they cannot vote for their own). Votes are recorded via the `vote_for_meme_candidate` function.
        *   Vote counts are updated and displayed to all players in real-time using Ably.
        *   When the timer ends or all votes are cast, the `tally_votes_and_create_round` function is triggered. This function determines the winner, creates the official `round` in the database, and updates the room's status.
        *   A `GAME_PHASE_CHANGED` event is broadcast via Ably, navigating all players simultaneously to the caption entry page.
        *   Ties are broken randomly by the database function.

5.  **Caption Entry (`/room/[roomId]/caption-entry`)**
    *   **Action:** Players submit their witty captions for the selected meme.
    *   **Functionality:**
        *   The chosen meme for the round is displayed prominently.
        *   Players have a text input field to write and submit their caption within a time limit.
        *   Submitted captions are sent to Supabase and associated with the player and the current round. Ably might be used to show progress (e.g., "X players have submitted").

6.  **Caption Voting (`/room/[roomCode]/caption-voting`)**
    *   **Action:** Players vote for the caption they find the funniest (they cannot vote for their own).
    *   **Functionality:**
        *   All submitted captions for the round are displayed anonymously (or attributed after voting).
        *   Players click to cast their vote for one caption.
        *   Votes are recorded in Supabase. Real-time vote counts could be shown via Ably.
        *   A timer controls the voting period.

7.  **Round Results (`/room/[roomId]/round-results`)**
    *   **Action:** The winning caption for the round is revealed, and scores are updated.
    *   **Functionality:**
        *   The meme is displayed along with the winning caption and its author.
        *   Scores for the round are shown (e.g., points for the winning caption, points for votes on the winner).
        *   Overall scores or a leaderboard might be displayed (data from Supabase).

8.  **Final Results (`/room/[roomId]/final-results`)**
    *   **Action:** After a set number of rounds, the final game results and the ultimate Caption Clash champion are announced.
    *   **Functionality:**
        *   Displays final scores and rankings.
        *   Option to play again or return to the homepage.

9.  **Round Loop / Game End**
    *   After **Round Results** players are sent back to **Meme Proposal** to start the next round. This repeats until `rooms.current_round_number === rooms.total_rounds`.
    *   Players can increase `total_rounds` from the settings dialog at any time while in the lobby (or between rounds). The change is persisted to the `rooms` table and broadcast to all players.

## Project Status

*   Authentication with Supabase is fully implemented, allowing users to sign in and maintain their session.
*   Room creation and joining functionality is complete, with room code generation and validation working properly.
*   Lobby functionality is fully implemented, including:
    *   Real-time player list with presence tracking
    *   Ready state toggling
    *   Avatar customization and name changing
    *   Countdown to game start when all players are ready
*   **Meme Proposal and Voting Flow is Implemented:**
    *   Players can successfully search for and propose memes from the Tenor API.
    *   The game correctly waits for all proposals before starting the voting phase.
    *   Players can vote for their favorite meme.
    *   Vote counts are displayed and updated in real-time.
    *   The backend correctly determines a winning meme, creates a new round, and synchronizes all players to the next game phase.
*   Real-time communication with Ably is properly set up and working for all lobby and meme-voting features.
*   Core UI components for the game are created and styled.
*   Game phases beyond meme voting (captioning, caption voting, results) have placeholder UI but require full implementation with backend services.

## Database Schema (Supabase)

The backend database is powered by Supabase. The schema is designed to manage game rooms, players, memes, rounds, captions, and votes.

### Key Tables:

1.  **`rooms`**: Stores information about game rooms, including the unique `room_code`, `total_rounds` (default **5**), `current_round_number`, `game_state` JSON and `status` (`lobby`, `in_progress`, `finished`).
2.  **`players`**: Contains details for each player. The `players.id` is expected to match the `auth.uid()` derived from the JWT. Includes `room_id` (linking to the current room), `username`, `is_ready` status, `avatar_url` for player's chosen avatar, and `current_score`.
3.  **`memes`**: A collection of memes available for the game, primarily storing `image_url` and `name`.
4.  **`rounds`**: Tracks individual rounds within a game room, linking to the `room_id` and `meme_id` used for the round. Also stores the `winning_caption_id` once determined.
5.  **`captions`**: Stores all captions submitted by players, linked to the `round_id` and `player_id`. Includes `text_content` for the caption.
6.  **`meme_candidates`**: Holds the list of memes proposed for a round (`round_id`, `meme_id`, `submitted_by_player_id`).
7.  **`meme_candidate_votes`**: Stores votes on the proposed memes (`meme_candidate_id`, `voter_player_id`).
8.  **`votes`** *(caption votes)*: Records votes cast by players on captions, linking to the `caption_id` and `voter_player_id`.

### Database Functions (RPCs)

The game logic is orchestrated through several key PostgreSQL functions, which are called as RPCs from the client.

*   `start_game(p_room_code)`: Called by clients when the lobby countdown ends. It's idempotent, checking the room status to ensure it only runs once. It transitions the room state to `meme-selection`.
*   `propose_meme(p_room_id, p_round_number, p_meme_url, p_meme_name)`: Called by a player to submit a meme candidate for the current round.
*   `vote_for_meme_candidate(p_meme_candidate_id)`: Called by a player to cast their vote for one of the proposed memes. Includes logic to prevent voting for one's own meme and voting multiple times.
*   `tally_votes_and_create_round(p_room_id, p_round_number)`: Called by clients when the meme voting timer ends. It tallies the votes, selects a winning meme (randomly resolving ties), creates the official entry in the `rounds` table, and updates the room status to `caption-entry`.
*   `get_meme_candidates_for_round(p_room_id, p_round_number)`: A helper function to fetch all proposed memes for a given round, along with the submitters' names.

### Authentication & Authorization (RLS):

*   **Supabase JWT Authentication**: The application uses Supabase for user authentication, relying on JWTs. The unique user identifier from the JWT (accessible via `auth.uid()` in Supabase policies) is critical for authorization. The `players.id` column must correspond to this `auth.uid()`.
*   **Ably Token Authentication**: For real-time communication, the application uses Ably's token authentication. A secure Next.js API route (`/api/create-ably-token`) validates the user's Supabase session and issues a short-lived, capabilities-scoped token to the client. The user's Supabase `auth.uid()` is used as the Ably `clientId` to uniquely identify the connection.
*   **Row Level Security (RLS)**: RLS is **enabled** on all Supabase tables to ensure data privacy and integrity. Policies are defined to:
    *   Allow users to view and interact only with data relevant to their game session (e.g., their own player data, data for the room they are currently in).
    *   Restrict write operations (insert, update, delete) based on player status and game state (e.g., cannot vote after a round has ended).
*   **Helper Functions**: SQL helper functions (e.g., `is_player_in_room`) are used within RLS policies for cleaner and more maintainable logic. These functions run with `SECURITY DEFINER` privileges.
*   **Backend Logic for Sensitive Operations**: Operations like score calculation, round transitions, and critical data modifications are intended to be handled by secure backend logic (e.g., Supabase Edge Functions or a dedicated backend server) rather than direct client-side database operations where possible, to further enhance security and data integrity.

### Automated Room Cleanup

To ensure the database remains clean and to manage resources effectively, an automated cleanup process is in place:

*   **Mechanism**: A PostgreSQL cron job using the `pg_cron` extension runs on a schedule.
*   **Function**: The job executes the `public.clean_old_rooms()` SQL function.
*   **Logic**: This function deletes any rooms that are older than two hours and still have a `status` of `'lobby'`. It also removes all associated players from the `players` table for those rooms. This prevents the deletion of active games that might be running for longer than two hours.
*   **Schedule**: The cron job is configured to run once every hour.

Refer to the SQL migration files or Supabase Studio for the exact table definitions, constraints, and RLS policies.

## Real-time Communication Architecture

The application uses Ably for real-time communication between players in a game room. Here's how it's implemented:

* **Channel Strategy**: Each game room has its own private channel named `room:{roomId}`, where `roomId` is the unique identifier for the room.

* **Authentication**: Ably tokens are generated via a secure Next.js API route (`/api/create-ably-token`) that validates the user's Supabase session before creating a token.

* **Channel Management**: A custom React hook (`useRoomChannel`) manages room-specific channel subscriptions, publishing events, and presence tracking. The hook is defined in `src/hooks/use-room-channel.ts`.

* **Event Types**: Standardized event types are used for all game-related communications:
  * `player-joined` - When a new player joins a room
  * `player-left` - When a player leaves a room
  * `player-ready-update` - When a player changes their ready status
  * `player-avatar-update` - When a player changes their avatar
  * `player-name-update` - When a player changes their name
  * `game-starting` - When the game is about to start (countdown)
  * `game-phase-changed` - When the game moves from one phase to another
  * `meme-selected-for-round` - When a meme is selected for the round
  * `caption-submitted` - When a player submits a caption
  * `round-results-ready` - When round results are available
  * `final-results` - When final game results are available

* **Presence Features**: The application uses Ably's presence functionality to track which players are currently in a room, their ready status, and their last activity timestamp.

