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

3.  **Meme Selection (`/room/[roomId]/meme-selection`)**
    *   **Action:** A meme is chosen for the current round.
    *   **Functionality:**
        *   This phase involves either random meme selection or voting by all players to choose a meme from a pool (memes sourced from Supabase or an external API).
        *   Players are shown a selection of memes (if applicable) or the chosen meme for the round.
        *   A timer might be present for this phase.
        *   The selected meme is broadcast to all players (via Ably, with the selected meme ID stored in Supabase for the round).

4.  **Caption Entry (`/room/[roomId]/caption-entry`)**
    *   **Action:** Players submit their witty captions for the selected meme.
    *   **Functionality:**
        *   The chosen meme for the round is displayed prominently.
        *   Players have a text input field to write and submit their caption within a time limit.
        *   Submitted captions are sent to Supabase and associated with the player and the current round. Ably might be used to show progress (e.g., "X players have submitted").

5.  **Caption Voting (`/room/[roomId]/caption-voting`)**
    *   **Action:** Players vote for the caption they find the funniest (they cannot vote for their own).
    *   **Functionality:**
        *   All submitted captions for the round are displayed anonymously (or attributed after voting).
        *   Players click to cast their vote for one caption.
        *   Votes are recorded in Supabase. Real-time vote counts could be shown via Ably.
        *   A timer controls the voting period.

6.  **Round Results (`/room/[roomId]/round-results`)**
    *   **Action:** The winning caption for the round is revealed, and scores are updated.
    *   **Functionality:**
        *   The meme is displayed along with the winning caption and its author.
        *   Scores for the round are shown (e.g., points for the winning caption, points for votes on the winner).
        *   Overall scores or a leaderboard might be displayed (data from Supabase).

7.  **Final Results (`/room/[roomId]/final-results`)**
    *   **Action:** After a set number of rounds, the final game results and the ultimate Caption Clash champion are announced.
    *   **Functionality:**
        *   Displays final scores and rankings.
        *   Option to play again or return to the homepage.

## Project Status

*   Authentication with Supabase is fully implemented, allowing users to sign in and maintain their session.
*   Room creation and joining functionality is complete, with room code generation and validation working properly.
*   Lobby functionality is fully implemented, including:
    *   Real-time player list with presence tracking
    *   Ready state toggling
    *   Avatar customization and name changing
    *   Countdown to game start when all players are ready
*   Real-time communication with Ably is properly set up and working for all lobby features.
*   Core UI components for the game are created and styled.
*   Game phases beyond the lobby (meme selection, captioning, voting, results) have placeholder UI but require full implementation with backend services.

## Database Schema (Supabase)

The backend database is powered by Supabase. The schema is designed to manage game rooms, players, memes, rounds, captions, and votes.

### Key Tables:

1.  **`rooms`**: Stores information about game rooms, including the unique `room_code`, current `game_state` (JSONB for flexibility), `status` (lobby, in_progress, etc.), and `current_round_number`.
2.  **`players`**: Contains details for each player. The `players.id` is expected to match the `auth.uid()` derived from the JWT. Includes `room_id` (linking to the current room), `username`, `is_ready` status, `avatar_url` for player's chosen avatar, and `current_score`.
3.  **`memes`**: A collection of memes available for the game, primarily storing `image_url`.
4.  **`rounds`**: Tracks individual rounds within a game room, linking to the `room_id` and `meme_id` used for the round. Also stores the `winning_caption_id` once determined.
5.  **`captions`**: Stores all captions submitted by players, linked to the `round_id` and `player_id`. Includes `text_content` for the caption.
6.  **`votes`**: Records votes cast by players, linking to the `round_id`, the `caption_id` being voted for, and the `voter_player_id`.

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

