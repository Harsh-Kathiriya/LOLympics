# Caption Clash - Project Tasks & Improvements

This document outlines the necessary tasks to refine the frontend, integrate backend services (Supabase and Ably), and implement the full game logic for Caption Clash.

## II. Supabase Integration (Backend & Database)

-   **[X] Supabase Project Setup:**
    -   [X] Create a new Supabase project.
    -   [X] Configure environment variables in the Next.js app (`.env.local`) for Supabase URL and anon key.
    -   [X] Initialize the Supabase client in the Next.js application (e.g., in a `lib/supabase.ts` file).
-   **[~] Database Schema Design & Implementation:** (Detailed schema and RLS defined, SQL provided)
    -   [X] Define and create tables:
        -   [X] `rooms`: (id (PK), room_code, current_game_type, current_round_number, game_state (JSONB), status, created_at, updated_at) - *Defined*
        -   [X] `players`: (id (PK, matches auth.uid()), room_id (FK), username, is_ready, current_score, created_at, updated_at) - *Defined*
        -   [X] `memes`: (id (PK), image_url, alt_text, source, created_at) - *Defined*
        -   [X] `rounds`: (id (PK), room_id (FK), round_number, meme_id (FK), winning_caption_id (FK), started_at, ended_at) - *Defined*
        -   [X] `captions`: (id (PK), round_id (FK), player_id (FK), text_content, created_at) - *Defined*
        -   [X] `votes`: (caption votes) (id (PK), caption_id (FK), voter_player_id (FK), created_at) - *Renamed for clarity & Defined*
        -   [X] `meme_candidates`: (id (PK), round_id (FK), meme_id (FK), submitted_by_player_id (FK), created_at) - *NEW & Defined*
        -   [X] `meme_candidate_votes`: (id (PK), meme_candidate_id (FK), voter_player_id (FK), created_at) - *NEW & Defined*
    -   [X] Set up relationships (foreign keys) and constraints. - *Defined in SQL script*
    -   [X] Implement Row Level Security (RLS) policies for all tables to ensure data privacy and proper access control. - *Defined in SQL script, including helper functions. Linter warnings for helper functions addressed.*

-   **[ ] Room Management Logic:**
    -   [X] **Create Room:**
        -   [X] Implement a Supabase Function (`create_room`) that handles creating a new room. 
        -   [X] Enhanced to clear any existing player's room association upon new room creation.
    -   [X] **Join Room:**
        -   [X] Implement a Supabase Function (`join_room`) that allows players to join an existing room. 
        -   [X] Enhanced to clear any existing player's room association upon joining a new room.
    -   **[X] Player Management in Room:**
        -   [X] Fetch the list of players for a room from the `players` table.
        -   [X] Update player `is_ready` status in the `players` table.
        -   [X] **Avatar Selection:** 
            -   [X] Create an avatar selection component.
            -   [X] Add avatar field to the `players` table schema.
            -   [X] Allow players to change their avatar and name in the lobby.
            -   [X] Integrate with Supabase to save selected avatar.
-   **[ ] Meme Data Management:**
    -   [ ] Populate the `memes` table with initial memes (or pull directly from Tenor).
    -   [ ] Implement Supabase Function to create a `meme_candidate` row when a player submits a meme search result.
    -   [ ] Implement Supabase Function to record a vote in `meme_candidate_votes` and, when voting ends, resolve the winning meme and update the `rounds.meme_id`.
-   **[ ] Game Data Handling:**
    -   [ ] **Caption Submission:** Save submitted captions to the `captions` table, linked to the current `game_rounds` and `players`.
    -   [ ] **Vote Submission:** Save votes to the `votes` table, linked to `captions` and `players`.
    -   [ ] **Score Calculation:** Implement logic (likely in Supabase Functions or backend) to calculate scores based on votes and update player scores in the `players` table.
-   **[ ] Supabase Functions (for server-side, trusted logic):**
    -   [X] `create_room` (as mentioned above).
    -   [X] `join_room` (New: to validate room code and add player).
    -   [ ] `start_game` (to update room phase, potentially initialize the first round).
    -   [ ] `submit_caption` (validate and store caption).
    -   [ ] `submit_vote` (validate and store vote).
    -   [ ] `calculate_round_scores` (triggered after voting ends).
    -   [ ] `advance_game_phase` (to manage transitions between meme selection, captioning, voting, results, new round).
    -   [ ] Consider functions for timer expirations if server-authoritative timers are needed.

## III. Ably Integration (Real-time Communication)

-   **[X] Ably Project Setup:**
    -   [X] Create an Ably account and application.
    -   [X] Configure Ably API key in Next.js environment variables (`.env.local`).
    -   [X] Initialize Ably client in the Next.js application (consider a global helper or context if used extensively).
-   **[X] Channel Management:**
    -   [X] Design channel strategy: Likely one private channel per `roomId` (e.g., `room:[roomId]`).
    -   [X] Implement logic for clients to subscribe to their respective room's channel upon joining a lobby.
    -   [X] Handle Ably token authentication for client-side publishing/subscribing if using token-based auth (recommended for security).
-   **[ ] Real-time Event Broadcasting & Handling (Lobby):**
    -   [X] **Player Joined:** When a new player joins a room (after Supabase confirms), publish an event (e.g., `player-joined`) on the room channel with new player details.
        -   Clients subscribed to the channel update their local player list.
    -   [X] **Player Left:** When a player leaves or disconnects, publish an event (e.g., `player-left`).
        -   Clients update their player list.
        -   (Consider Ably presence features for more robust disconnect handling).
    -   [X] **Player Ready Status Change:** When a player toggles their ready status, publish an event (e.g., `player-ready-update`) with player ID and new ready status.
        -   Clients update the UI accordingly.
    -   [X] **Player Avatar/Name Change:** When a player changes their avatar or name, publish events (e.g., `player-avatar-update`, `player-name-update`) with player ID and new details.
        -   Clients update the UI accordingly.
    -   [X] **Game Starting Countdown:** When all players are ready, an event like `game-starting` could be published with countdown details. All clients show the countdown overlay.
-   **[ ] Real-time Game State Synchronization:**
    -   [ ] **Game Phase Transitions:** When the game moves from one phase to another (e.g., lobby -> meme-selection, meme-selection -> caption-entry), the server (Supabase Function) should trigger an Ably event (e.g., `game-phase-changed`) with the new phase name and any relevant data (e.g., selected meme for caption entry).
        -   Clients react to this event by rendering the UI for the new phase.
    -   [ ] **Selected Meme Broadcast:** Once a meme is selected for the round, publish an event (e.g., `meme-selected-for-round`) with the meme details.
        -   All players in the captioning phase see the correct meme.
-   **[ ] Real-time Gameplay Events:**
    -   [ ] **Caption Submitted (Optional Real-time Feedback):**
        -   Optionally, publish an event when a player submits a caption (e.g., `caption-submitted`, perhaps just with player ID or a count) to show progress like "X/Y players have submitted". Full captions are revealed later.
    -   [ ] **Voting Phase Updates:**
        -   When the voting phase starts, all submitted captions (anonymized) are sent via an Ably message or fetched by clients based on a game state event.
        -   (Optional) Real-time updates on vote counts *as they happen* could be broadcast, or revealed only at the end of voting.
    -   [ ] **Timer Synchronization:** If timers are critical for synchronized actions, ensure they are either server-authoritative and their end is broadcast, or that clients receive a common start time and duration to run local timers.
-   **[ ] Real-time Results:**
    -   [ ] **Round Results:** After voting, the server calculates results; publish an event (e.g., `round-results-ready`) with winning caption, player scores for the round, and updated total scores.
        -   Clients display the round results page.
    -   [ ] **Final Game Results:** Similarly, publish final game results.
-   **[ ] Error Handling & Connection Management:**
    -   [ ] Implement robust handling for Ably connection states (connecting, connected, disconnected, suspended, failed).
    -   [ ] Provide user feedback for connection issues.
    -   [ ] Implement reconnection logic.

## IV. Game Logic & Core Gameplay Loop Implementation

(This section focuses on implementing the turn-based game flow, player interactions, and scoring, utilizing Supabase for data persistence & server-side logic, and Ably for real-time communication.)

-   **[~] Centralized Game State Management:** (Partially implemented)
    -   [ ] Design and implement a robust system for managing the overall game state (e.g., current phase, current round, selected meme, timers) primarily within Supabase (e.g., in the `rooms` or a dedicated `game_state` table).
    -   [X] Ensure Supabase Functions are the authority for transitioning game states.
    -   [X] Use Ably to broadcast game state changes to all clients, ensuring UI updates accordingly.
-   **[ ] Implement Full Game Flow (Phase by Phase):**
    -   **[X] Lobby (`/room/[roomId]/page.tsx`):**
        -   [X] Integrate Supabase to fetch and display real players.
        -   [X] Integrate Ably for real-time player join/leave/ready status updates.
        -   [X] Allow players to customize their avatar and name.
        -   [X] Game starts automatically when all players are ready -> Triggers Supabase Function -> Ably broadcasts `game-starting` & then `game-phase-changed` to 'meme-selection'.
    -   **[X] Meme Proposal (`/room/[roomId]/meme-selection/page.tsx`):**
        -   [X] Fetch memes from Tenor API on the client-side.
        -   [X] Implement logic for each player to propose one meme.
        -   [X] Selected meme is submitted to Supabase (`meme_candidates` table) via `propose_meme` RPC.
        -   [X] Handle timer for this phase; auto-submits a random meme if player doesn't choose.
        -   [X] Navigate to voting page upon timer completion.
    -   **[X] Meme Voting (`/room/[roomId]/meme-voting/page.tsx`):**
        -   [X] Wait for all players to submit proposals before starting the vote.
        -   [X] Fetch all proposed memes from Supabase using `get_meme_candidates_for_round` RPC.
        -   [X] Allow players to vote for one meme (not their own) via `vote_for_meme_candidate` RPC.
        -   [X] Broadcast vote counts in real-time using Ably.
        -   [X] On timer end or all votes in, trigger `tally_votes_and_create_round` RPC.
        -   [X] Synchronize all players to the next phase via Ably `GAME_PHASE_CHANGED` event.
    -   **[ ] Caption Entry (`/room/[roomId]/caption-entry/page.tsx` - *Create this page if not already robust*):
        -   [ ] Display the meme selected in the previous phase (data via Ably/Supabase).
        -   [ ] Allow players to type and submit captions.
        -   [ ] Submitted captions are saved to Supabase (`captions` table) via a Supabase Function.
        -   [ ] Ably can broadcast `caption-submitted` events (e.g., for progress display).
        -   [ ] Handle timer for caption submission. On timer end or all submissions, Supabase Function triggers Ably broadcast for `game-phase-changed` to 'caption-voting'.
    -   **[ ] Caption Voting (`/room/[roomId]/caption-voting/page.tsx` - *Create/Refine this page*):
        -   [ ] Fetch/display all submitted captions for the round (anonymously) from Supabase (triggered by Ably game state event).
        -   [ ] Allow players to vote for one caption (not their own).
        -   [ ] Votes are saved to Supabase (`votes` table) via a Supabase Function.
        -   [ ] (Optional) Ably can broadcast vote counts in real-time.
        -   [ ] Handle timer for voting. On timer end, Supabase Function calculates scores and triggers Ably broadcast for `game-phase-changed` to 'round-results'.
    -   **[ ] Round Results (`/room/[roomId]/round-results/page.tsx` - *Create/Refine this page*):
        -   [ ] Fetch and display winning caption, its author, and scores for the round from Supabase (triggered by Ably game state event).
        -   [ ] Update and display overall player scores.
        -   [ ] Logic to determine if more rounds are to be played or if it's the end of the game.
        -   [ ] If more rounds, Supabase Function triggers Ably broadcast for `game-phase-changed` back to 'meme-selection' (or a new round setup phase). If game ends, to 'final-results'.
    -   **[ ] Final Results (`/room/[roomId]/final-results/page.tsx` - *Create/Refine this page*):
        -   [ ] Fetch and display final scores, rankings, and the game winner from Supabase.
        -   [ ] Option to "Play Again" (could reset the room or create a new one) or "Leave Room".
-   **[ ] Scoring System:**
    -   [ ] Define and implement the scoring logic (e.g., points for winning caption, points for voting on the winning caption).
    -   [ ] Ensure scores are accurately calculated (Supabase Function) and updated in the `players` table.
-   **[ ] Timer Management:**
    -   [ ] Implement reliable timers for different game phases.
    -   [ ] Prefer server-authoritative timers where possible: Supabase Function sets a timer, and upon expiry, triggers the next game state change via Ably.
    -   [ ] Alternatively, send start time and duration via Ably, and clients run local timers, but the server still dictates phase changes.
-   **[ ] Handling Player Disconnects/Reconnects During Game:**
    -   [ ] Define behavior for players disconnecting mid-game (e.g., are they removed, can they rejoin, are their submissions/votes voided?).
    -   [ ] Use Ably presence or Supabase session management to handle this.

## I. Frontend Refinements & Best Practices (skip for now)

-   **[ ] Code Cleanup & Consistency:**
    -   [ ] Review all existing components and pages for consistent coding style and formatting (Prettier/ESLint should handle much of this).
    -   [ ] Ensure consistent use of TypeScript types and interfaces across the frontend.
    -   [ ] Remove any unused variables, functions, or imports.
    -   [ ] Check for and remove any console.log statements meant for debugging.
-   **[ ] Component Structure & Reusability:**
    -   [ ] Review `src/components/ui/` and `src/components/game/` for opportunities to create more reusable or abstract components.
    -   [ ] Ensure components have clear props and responsibilities.
-   **[ ] State Management Review (Client-Side):**
    -   [ ] For existing client-side state (`useState`, `useReducer`), ensure it's managed efficiently and locally where appropriate. Complex shared client-side state might warrant a small context if Redux/Zustand are overkill.
    -   [ ] This will be largely superseded by Supabase/Ably for game state, but local UI state still matters.
-   **[ ] Routing and Navigation:**
    -   [ ] Verify all internal navigation links (`<Link>` component or `router.push`) are correctly implemented.
    -   [ ] Ensure dynamic route parameters (`roomId`) are handled robustly.
-   **[ ] Error Handling & Loading States:**
    -   [ ] Implement more comprehensive loading states for pages and components where data fetching (even mocked for now) occurs (e.g., initial lobby load, meme list load).
    -   [ ] Add user-friendly error messages or UI for potential issues (e.g., failed navigation, invalid room code *before* server-side check).
    -   [ ] Consider using Next.js `error.tsx` conventions for route segments where appropriate.
-   **[ ] Accessibility (A11y) Review:**
    -   [ ] Perform a basic accessibility check (e.g., keyboard navigation, sufficient color contrast, ARIA attributes where necessary for custom components like `PlayerAvatar`, `MemeCard`, `ReadyToggle`).
    -   [ ] Ensure all interactive elements are focusable and operable via keyboard.
    -   [ ] Add `alt` text to images or ensure decorative images have `role="presentation"` or empty `alt`.
-   **[ ] Responsive Design Checks:**
    -   [ ] Thoroughly test all pages and components on various screen sizes (mobile, tablet, desktop) to ensure layouts are responsive and usable.
    -   [ ] Address any layout breaks or usability issues on smaller screens.
-   **[ ] Remove/Refactor Hardcoded Data (Beyond Initial TODOs):**
    -   [ ] While major data points are marked with TODOs for Supabase/Ably, do a pass for any other minor hardcoded strings or configurations that should be dynamic or configurable.
-   **[ ] Environment Variables:**
    -   [ ] Ensure any sensitive keys or configuration details (even for planned integrations) are handled through environment variables (`.env.local`). (e.g. Supabase URL/anon key, Ably API key once added).

## V. UI/UX Enhancements (Stretch Goals / Nice-to-Haves)

-   **[ ] Advanced Animations & Transitions:**
    -   [ ] Add more engaging animations for phase transitions, score reveals, player actions (e.g., using Framer Motion).
-   **[ ] Sound Effects & Background Music:**
    -   [ ] Integrate subtle sound effects for actions like button clicks, timers, votes, and round reveals.
    -   [ ] Option for unobtrusive background music in the lobby/game.
-   **[X] Customizable Avatars or Player Profiles:**
    -   [X] Allow players to choose from a selection of avatars or even upload their own (if full auth is implemented).
-   **[ ] Theme Customization:**
    -   [ ] Option for players to choose between light/dark themes or other color schemes.
-   **[ ] Improved Empty States & Instructions:**
    -   [ ] Enhance UI for scenarios like an empty lobby, waiting for meme selection, etc., with clearer instructions or engaging visuals.
-   **[ ] Mobile-Specific UI Optimizations:**
    -   [ ] Beyond basic responsiveness, consider specific UI patterns or layouts that work best on mobile for caption entry or voting.
-   **[ ] Spectator Mode:**
    -   [ ] Allow users to join a room as spectators without participating.

## VI. Testing & Quality Assurance

-   **[ ] Unit Tests:**
    -   [ ] Write unit tests for critical utility functions, Supabase client interactions (mocked), and complex UI component logic (e.g., using Jest and React Testing Library).
-   **[ ] Integration Tests:**
    -   [ ] Test interactions between frontend components and mocked Supabase/Ably services.
    -   [ ] Test Supabase Functions locally or in a staging environment.
-   **[ ] End-to-End (E2E) Tests:**
    -   [ ] Implement E2E tests for core user flows (e.g., creating a room, joining, playing a full round) using tools like Cypress or Playwright.
-   **[ ] Manual Playtesting:**
    -   [ ] Conduct thorough manual playtesting with multiple users/browsers to identify bugs, usability issues, and synchronization problems.
    -   [ ] Test edge cases (e.g., player disconnects, slow network conditions, invalid inputs).
-   **[ ] Cross-Browser & Cross-Device Testing:**
    -   [ ] Verify the application works consistently across major browsers (Chrome, Firefox, Safari, Edge) and different devices (desktop, tablet, mobile).
-   **[ ] Performance Testing:**
    -   [ ] Basic performance profiling to ensure smooth UI and acceptable load times, especially with real-time updates.

### Task List

- [X] Fix `start_game` function in `db_restore.sql`.
- [X] Update lobby page to call `start_game` instead of `start_game_and_create_round`.
- [X] Update `README.md` to reflect the changes in the database and game flow.
- [ ] Implement the new meme selection, voting, and round creation flow.
  - [ ] Create `meme-selection` page component.
  - [ ] Create database function to handle meme submission (`propose_meme`).
  - [ ] Create database function to handle meme voting (`vote_for_meme`).
  - [ ] Create database function to tally votes and create a new round (`tally_meme_votes_and_create_round`).
  - [ ] Update frontend to navigate through the new flow.
- [X] Implement backend logic for meme selection and voting.
  - [X] Create database function to handle meme submission (`propose_meme`).
  - [X] Create database function to handle meme voting (`vote_for_meme_candidate`).
  - [X] Create database function to tally votes and create a new round (`tally_votes_and_create_round`).
- [X] Implement frontend for the new meme selection, voting, and round creation flow.
  - [X] Implement `meme-selection` page component logic.
  - [X] Connect `meme-selection` page to the new database functions.
  - [X] Ensure smooth, real-time transitions between proposing, voting, and captioning phases. 