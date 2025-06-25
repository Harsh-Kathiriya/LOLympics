# LOLympics

A real-time multiplayer meme competition where you compete with friends to create the funniest captions. Select your own meme, place your caption perfectly, and vote to crown the LOLympics champion!

## Core Technologies

*   **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS
*   **Real-time:** Ably
*   **Backend & Database:** Supabase
*   **UI Components:** shadcn/ui, Lucide Icons
*   **Meme API:** Tenor

## Key Features

*   **Anonymous Authentication:** Quick, seamless entry for players.
*   **Room Management:** Create private game rooms or join a friend's with a unique code.
*   **Real-time Lobby:** See players join in real-time, customize your avatar and name, and toggle your ready status.
*   **Individual Meme Selection:** Search the Tenor API or use trending memes to pick your own personal meme for the round.
*   **Positioned Captioning:** Write your caption and drag-and-drop it to the perfect spot on your meme.
*   **Contextual Voting:** Vote on other players' submissions, with each caption displayed on its corresponding meme.
*   **Dynamic Results & Leaderboards:** See round winners, score updates, and a final animated leaderboard with confetti and fireworks.
*   **Sound & Music:** Immersive audio experience with background music and sound effects, fully customizable in settings.

## How It Works (Application Flow)

LOLympics takes players through a series of hilarious and competitive stages:

1.  **Homepage (`/`)**
    *   **Action:** Players enter a nickname and can then choose to host a new game or join an existing one.
    *   **Functionality:**
        *   *Host Game:* Creates a new room, generates a unique 6-character room code, and navigates the host to the game lobby.
        *   *Join Game:* Validates an entered room code and navigates the player to the corresponding lobby.

2.  **Lobby (`/room/[roomCode]`)**
    *   **Action:** Players gather before the game begins. They can see other connected players, customize their profile, and toggle their "ready" status.
    *   **Functionality:**
        *   Displays the room code for easy sharing.
        *   Lists all players in the room using Ably for real-time presence.
        *   Players can change their display name and select from a variety of avatars.
        *   The game automatically begins with a countdown when all players are ready and the minimum player count is met.

3.  **Meme Selection (`/room/[roomCode]/meme-selection`)**
    *   **Action:** Each player individually selects their own meme for the round.
    *   **Functionality:**
        *   Players can search the Tenor API for memes or browse trending options.
        *   Each player selects one meme. This choice is saved to the database.
        *   A timer keeps the phase moving. If a player doesn't choose, a random meme is selected for them when time expires.
        *   Once all players have a meme, the game automatically advances to the caption entry phase.

4.  **Caption Entry (`/room/[roomCode]/caption-entry`)**
    *   **Action:** Players write a caption for the meme they just selected and position it.
    *   **Functionality:**
        *   Each player sees their own chosen meme.
        *   A text input allows for writing a caption. The caption text can then be dragged and dropped anywhere on the meme image.
        *   The caption text and its X/Y coordinates are submitted to the database.
        *   After submitting, players are moved to the voting phase.

5.  **Caption Voting (`/room/[roomCode]/caption-voting`)**
    *   **Action:** All players vote for their favorite caption. They cannot vote for their own.
    *   **Functionality:**
        *   A grid displays every player's chosen meme, each with its author's caption precisely positioned on it.
        *   Players click on a card to select it and then confirm their vote.
        *   Real-time UI updates show how many players have voted.
        *   The phase ends when the timer runs out or all players have voted.

6.  **Round Results (`/room/[roomCode]/round-results`)**
    *   **Action:** The winning caption(s) are revealed, points are awarded, and the leaderboard is updated.
    *   **Functionality:**
        *   The winning caption is displayed on its meme. Special UI handles ties by showing all winners.
        *   Points awarded for the win are shown.
        *   A leaderboard snippet shows the top players and the current player's rank.
        *   After a short duration, the game automatically proceeds.

7.  **Final Results (`/room/[roomCode]/final-results`)**
    *   **Action:** After the final round, the ultimate LOLympics champion is announced.
    *   **Functionality:**
        *   A grand celebration screen announces the winner with their total score.
        *   A full, scrollable leaderboard shows the final rankings for all players.
        *   Players have the option to "Play Again" (which resets the game and returns to the lobby) or go back to the homepage.

8.  **Game Loop**
    *   After **Round Results**, if there are more rounds to play, players are sent back to **Meme Selection**.
    *   If the final round was just completed, players are sent to the **Final Results** page.



## Database Architecture

The database is designed to manage game rooms, players, rounds, captions, and votes with a focus on security, performance, and analytics.

For a comprehensive overview of the database design including:
- Complete schema design with table relationships
- Security model with Row Level Security (RLS)
- Database functions and stored procedures
- Indexing strategy and performance optimizations
- Data persistence and analytics capabilities

See the detailed [Database Documentation](./sql/database.md).

### Key Tables:

1.  **`rooms`**: Stores information about game rooms, including the unique `room_code`, `status` (`lobby`, `meme-selection`, etc.), and round tracking.
2.  **`players`**: Contains details for each player, linked via `room_id`. Includes `username`, `is_ready`, `avatar_src`, and `current_score`.
3.  **`memes`**: A collection of memes used in the game, storing `image_url` and `name`.
4.  **`rounds`**: Tracks individual rounds within a game room.
5.  **`player_round_memes`**: Links each player to their selected meme for a specific round.
6.  **`captions`**: Stores all submitted captions, linked to a `round_id` and `player_id`. Includes `text_content`, `position_x`, and `position_y` coordinates.
7.  **`votes`**: Records votes cast by players on captions.
8.  **`persistent_meme_selections`**: Analytics table that retains meme selection data for future game improvements.

## Real-time Communication Architecture (Ably)

*   **Channel Strategy**: Each game room uses a unique channel named `room:[roomCode]`.
*   **Authentication**: Ably's token authentication is used. The server generates short-lived, capabilities-scoped tokens for clients via the `/api/create-ably-token` route.
*   **Hook-based Management**: A custom `useRoomChannel` hook encapsulates all Ably logic, including channel connection, publishing, subscribing, and presence, making components clean.
*   **Event Types**: Standardized event types from the `RoomEvent` enum are used for all real-time communication:
    *   `player-joined`
    *   `player-left`
    *   `player-ready-update`
    *   `player-avatar-changed`
    *   `player-name-update`
    *   `game-phase-changed`
    *   `caption-vote-cast`