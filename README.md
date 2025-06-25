# LOLympics

A crazy multiplayer meme competition where athletes compete to win gold medals with the funniest captions for popular memes.

## Core Technologies

*   **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS
*   **Real-time:** Ably
*   **Backend & Database:** Supabase
*   **UI Components:** Shadcn/ui, Lucide Icons

## Key Features (Current & Planned)

*   Create and join Olympic villages (game rooms).
*   Real-time Olympic village with athlete ready-up status.
*   Customizable athlete profiles with avatar selection.
*   Individual meme selection for each player.
*   Positioned caption submission with drag-and-drop placement.
*   Caption judging phase with visual context.
*   (Planned) Medal ceremonies and final Olympic rankings.
*   (Planned) Real-time updates for all Olympic events.

## How It Works (Application Flow)

LOLympics takes athletes through a series of hilarious and competitive stages:

1.  **Homepage (`/`)**
    *   **Action:** Athletes can choose to host their own Olympic games or enter an existing country code.
    *   **Functionality:**
        *   *Host Games:* Athlete enters a nickname, then the system generates a unique country code (handled by Supabase to ensure uniqueness and persistence), and navigates the athlete to the Olympic village. Importantly, if the athlete was previously associated with another village, that association is cleared upon creating a new one.
        *   *Join Games:* Validates the entered country code (will check against Supabase) and navigates the athlete to the Olympic village. Similar to hosting games, if the athlete was previously associated with another village, that association is cleared upon joining a new one.

2.  **Olympic Village (`/room/[roomCode]`)**
    *   **Action:** Athletes gather before the games begin. They can see other connected athletes, customize their avatar and name, and light their torch (toggle "ready" status).
    *   **Functionality:**
        *   Displays the unique country code for sharing.
        *   Lists all athletes currently in the village (athlete data managed by Supabase, presence and ready status updates via Ably).
        *   Athletes can customize their profile by selecting from a variety of fun avatars and changing their display name.
        *   Athletes can light their torch to mark themselves as "ready".
        *   The games automatically start when all athletes are ready.
        *   A countdown initiates the games start, and all athletes are transitioned to the first event simultaneously (state transition managed by Supabase and communicated via Ably).

3.  **Meme Selection (`/room/[roomCode]/meme-selection`)**
    *   **Action:** Each athlete selects a personal meme for the round.
    *   **Functionality:**
        *   Athletes can search the Tenor API for GIFs or use the trending memes provided.
        *   Each athlete selects one meme for themselves. This choice is recorded in the `player_round_memes` table via the `select_player_meme` function.
        *   A timer keeps the event moving. If an athlete doesn't choose, a random meme is submitted for them when time expires.
        *   Once all athletes have selected their memes (or the timer ends), the room automatically advances to the caption entry phase.

4.  **Caption Entry (`/room/[roomId]/caption-entry`)**
    *   **Action:** Athletes submit captions for their selected meme with precise positioning.
    *   **Functionality:**
        *   Each athlete's chosen meme is displayed prominently.
        *   Athletes have a text input field to write their caption and can drag it to position it perfectly on their meme.
        *   The caption's position (X/Y coordinates) is saved along with the text.
        *   Submitted captions are sent to Supabase and associated with the athlete and the current round. Ably is used to show progress (e.g., "X athletes have submitted").

5.  **Caption Voting (`/room/[roomCode]/caption-voting`)**
    *   **Action:** Athletes judge the captions and vote for the one they find the funniest (they cannot vote for their own).
    *   **Functionality:**
        *   Athletes see each player's selected meme with their caption positioned exactly as specified.
        *   Athletes click to cast their vote for one caption.
        *   Votes are recorded in Supabase. Real-time vote counts are shown via Ably.
        *   A timer controls the judging period.

6.  **Event Results (`/room/[roomId]/round-results`)**
    *   **Action:** The gold medal caption for the event is revealed, and scores are updated.
    *   **Functionality:**
        *   The winning captions are displayed on their respective memes with proper positioning.
        *   Scores for the event are shown (e.g., points for the gold medal caption).
        *   Overall scores and rankings are displayed (data from Supabase).

7.  **Closing Ceremony (`/room/[roomId]/final-results`)**
    *   **Action:** After a set number of events, the final Olympic results and the ultimate LOLympics champion are announced.
    *   **Functionality:**
        *   Displays final scores and rankings.
        *   Option to compete again or return to the homepage.

8.  **Event Loop / Games End**
    *   After **Event Results** athletes are sent back to **Meme Selection** to start the next event. This repeats until `rooms.current_round_number === rooms.total_rounds`.
    *   Athletes can increase `total_rounds` from the settings dialog at any time while in the village (or between events). The change is persisted to the `rooms` table and broadcast to all athletes.

## Project Status

*   Authentication with Supabase is fully implemented, allowing users to sign in and maintain their session.
*   Village creation and joining functionality is complete, with country code generation and validation working properly.
*   Village functionality is fully implemented, including:
    *   Real-time athlete list with presence tracking
    *   Ready state toggling
    *   Avatar customization and name changing
    *   Countdown to game start when all athletes are ready
*   **Individual Meme Selection Flow:**
    *   Athletes can successfully search for and select their personal meme from the Tenor API.
    *   The game automatically advances to caption entry once all athletes have chosen.
*   **Caption Positioning:**
    *   Caption entry UI includes drag-and-drop positioning.
    *   X/Y coordinates are stored in the database for accurate display.
    *   Captions are displayed at their exact positions on memes in all game phases.
*   **Caption Voting & Results:**
    *   Caption voting displays each player's selected meme with positioned captions.
    *   Round results show winning captions positioned on their respective memes.
*   Real-time communication with Ably is properly set up and working for all game features.
*   Core UI components for the game are created and styled.

## Database Schema (Supabase)

The backend database is powered by Supabase. The schema is designed to manage game rooms, athletes, memes, rounds, captions, and votes.

### Key Tables:

1.  **`rooms`**: Stores information about game rooms, including the unique `country_code`, `total_rounds` (default **5**), `current_round_number`, `game_state` JSON and `status` (`lobby`, `meme-selection`, `caption-entry`, `caption-voting`, `round-results`, `finished`).
2.  **`athletes`**: Contains details for each athlete. The `athletes.id` is expected to match the `auth.uid()` derived from the JWT. Includes `room_id` (linking to the current room), `username`, `is_ready` status, `avatar_url` for athlete's chosen avatar, and `current_score`.
3.  **`memes`**: A collection of memes available for the game, primarily storing `image_url` and `name`.
4.  **`rounds`**: Tracks individual rounds within a game room, linked to the `room_id`. Also stores the `winning_caption_id` once determined.
5.  **`player_round_memes`**: Links each player to their selected meme for a specific round (`round_id`, `player_id`, `meme_id`).
6.  **`captions`**: Stores all captions submitted by athletes, linked to the `round_id` and `athlete_id`. Includes `text_content` for the caption, plus `position_x` and `position_y` coordinates (0-100 range) for precise placement on the meme.
7.  **`votes`** *(caption votes)*: Records votes cast by athletes on captions, linking to the `caption_id` and `voter_athlete_id`.

### Database Functions (RPCs)

The game logic is orchestrated through several key PostgreSQL functions, which are called as RPCs from the client.

*   `start_game(p_country_code)`: Called by clients when the village countdown ends. It's idempotent, checking the room status to ensure it only runs once. It transitions the room state to `meme-selection`.
*   `select_player_meme(p_round_id, p_meme_url, p_meme_name)`: Called by an athlete to select their personal meme for the current round. When all players have selected, automatically advances the room to `caption-entry` status.
*   `submit_caption(p_round_id, p_caption_text, p_position_x, p_position_y)`: Called by an athlete to submit their caption with positioning information.
*   `submit_caption_vote(p_caption_id)`: Called by an athlete to cast their vote for one of the captions. Includes logic to prevent voting for one's own caption and voting multiple times.
*   `tally_caption_votes_and_finalize_round(p_round_id)`: Called by clients when the caption voting timer ends. It tallies the votes, selects winning caption(s), awards points, and updates the room status to `round-results`.
*   `get_round_results_details(p_round_id)`: A helper function to fetch all results data for a round, including winning captions and their associated memes.

### Authentication & Authorization (RLS):

*   **Supabase JWT Authentication**: The application uses Supabase for user authentication, relying on JWTs. The unique user identifier from the JWT (accessible via `auth.uid()` in Supabase policies) is critical for authorization. The `athletes.id` column must correspond to this `auth.uid()`.
*   **Ably Token Authentication**: For real-time communication, the application uses Ably's token authentication. A secure Next.js API route (`/api/create-ably-token`) validates the user's Supabase session and issues a short-lived, capabilities-scoped token to the client. The user's Supabase `auth.uid()` is used as the Ably `clientId` to uniquely identify the connection.
*   **Row Level Security (RLS)**: RLS is **enabled** on all Supabase tables to ensure data privacy and integrity. Policies are defined to:
    *   Allow users to view and interact only with data relevant to their game session (e.g., their own athlete data, data for the room they are currently in).
    *   Restrict write operations (insert, update, delete) based on athlete status and game state (e.g., cannot vote after a round has ended).
*   **Helper Functions**: SQL helper functions (e.g., `is_athlete_in_room`) are used within RLS policies for cleaner and more maintainable logic. These functions run with `SECURITY DEFINER` privileges.
*   **Backend Logic for Sensitive Operations**: Operations like score calculation, round transitions, and critical data modifications are intended to be handled by secure backend logic (e.g., Supabase Edge Functions or a dedicated backend server) rather than direct client-side database operations where possible, to further enhance security and data integrity.

### Automated Room Cleanup

To ensure the database remains clean and to manage resources effectively, an automated cleanup process is in place:

*   **Mechanism**: A PostgreSQL cron job using the `pg_cron` extension runs on a schedule.
*   **Function**: The job executes the `public.clean_old_rooms()` SQL function.
*   **Logic**: This function deletes any rooms that are older than two hours and still have a `status` of `'lobby'`. It also removes all associated athletes from the `athletes` table for those rooms. This prevents the deletion of active games that might be running for longer than two hours.
*   **Schedule**: The cron job is configured to run once every hour.

Refer to the SQL migration files or Supabase Studio for the exact table definitions, constraints, and RLS policies.

## Real-time Communication Architecture

The application uses Ably for real-time communication between athletes in a game room. Here's how it's implemented:

* **Channel Strategy**: Each game room has its own private channel named `room:{roomId}`, where `roomId` is the unique identifier for the room.

* **Authentication**: Ably tokens are generated via a secure Next.js API route (`/api/create-ably-token`) that validates the user's Supabase session before creating a token.

* **Channel Management**: A custom React hook (`useRoomChannel`) manages room-specific channel subscriptions, publishing events, and presence tracking. The hook is defined in `src/hooks/use-room-channel.ts`.

* **Event Types**: Standardized event types are used for all game-related communications:
  * `athlete-joined` - When a new athlete joins a room
  * `athlete-left` - When an athlete leaves a room
  * `athlete-ready-update` - When an athlete changes their ready status
  * `athlete-avatar-update` - When an athlete changes their avatar
  * `athlete-name-update` - When an athlete changes their name
  * `game-starting` - When the game is about to start (countdown)
  * `game-phase-changed` - When the game moves from one phase to another
  * `meme-selected` - When an athlete selects their meme
  * `caption-submitted` - When an athlete submits a caption
  * `round-results-ready` - When round results are available
  * `final-results` - When final game results are available

* **Presence Features**: The application uses Ably's presence functionality to track which athletes are currently in a room, their ready status, and their last activity timestamp.

