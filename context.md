
### Project Overview for LLM

#### **Project Name:**
Real-time Collaborative DJ Room

#### **Core Concept (The "Elevator Pitch"):**
A full-stack web application where users can create private rooms, invite friends, and listen to YouTube videos together in perfect, real-time synchronization. The group collaboratively manages a shared playlist by adding songs and upvoting their favorites, creating a social and interactive music listening experience.

#### **High-Level User Journey:**
1.  A user registers and logs in to their account.
2.  They create a new "room" which generates a unique, shareable link.
3.  Other users join the room via the link.
4.  All users in the room see a shared interface with a video player, a playlist (queue), and a user list.
5.  Any user can paste a YouTube link to add a song to the shared playlist.
6.  Users can upvote songs in the playlist to move them higher in the queue.
7.  The system automatically plays the highest-voted song from the playlist for **everyone in the room simultaneously**.
8.  Playback is synchronized: if one user seeks, pauses, or plays the video, it is reflected for all users. The server acts as the single source of truth for playback state.

---

### Technical Architecture & Key Components

This is a **monorepo project** with a strict separation between the backend and frontend.

#### **1. Backend (Node.js, Express.js, TypeScript)**

The backend is the "conductor" and the central brain of the application. It does not handle any media streaming itself; it only manages state and sends commands.

*   **Communication Protocols:**
    *   **REST API (Express.js):** Used for stateless, persistent operations like user authentication (login/register with JWTs) and room management (create/list rooms).
    *   **WebSockets (Socket.IO):** The primary channel for all real-time, in-room communication. It handles live events like joining a room, adding/voting on songs, and broadcasting playback commands.

*   **Database Strategy (Dual-Database Model):**
    *   **PostgreSQL (via Prisma ORM):** The primary, persistent database. It stores "slow-moving," relational data that must survive a server restart.
        *   **Models:** `User` (id, username, password), `Room` (id, name, ownerId).
    *   **Redis (via ioredis):** The high-speed, ephemeral state store. It holds all the "live" data for active rooms. This data can be lost on restart and re-created as users join rooms.
        *   **Redis Hash (`room:state:<roomId>`):** Stores the *current* playback state: `currentSongId`, `isPlaying`, `playbackStartUtc`. This is the single source of truth for what is happening *right now*.
        *   **Redis Sorted Set (`room:playlist:<roomId>`):** Manages the upcoming song queue. The `score` is the vote count, and the `value` is a JSON string of the song's metadata. This provides an efficient priority queue.
        *   **Redis Set (`room:users:<roomId>`):** Tracks the presence of users currently in a room.

*   **Core Logic: The Synchronization Model**
    *   The backend is **server-authoritative**. It is the sole source of truth.
    *   To start a song, the server pops the highest-voted song from the Redis playlist.
    *   It records the current server timestamp (`playbackStartUtc = Date.now()`).
    *   It broadcasts a `playNewSong` command over WebSockets to all clients in the room, containing the song details and the `playbackStartUtc`.
    *   This model ensures that even clients with high network latency can calculate the correct starting offset and stay in sync with everyone else.

*   **Third-Party Integrations:**
    *   **YouTube Data API:** Used server-side to fetch video metadata (title, duration) from a video ID to prevent client-side data tampering.

#### **2. Frontend (React, Vite, TypeScript)**

The frontend is a pure **Single Page Application (SPA)**. Its only job is to render the UI based on state received from the backend and to send user actions back to the server.

*   **UI Components:** A `RoomPage` that contains a `YouTubePlayer` component (using `react-youtube`), a `Playlist` component, and a `UserList` component.
*   **State Management (Zustand):** A lightweight client-side state store to manage the current room state (the playlist, who's online, what's playing). This state is updated exclusively by events received from the WebSocket server.
*   **Real-time Communication:** Uses the **Socket.IO Client** to connect to the backend, listen for broadcasted events (`playlistUpdated`, `userJoined`, `playNewSong`), and emit user actions (`addSong`, `voteSong`).
*   **Synchronization Logic (Client-side):** When it receives the `playNewSong` command from the server, it calculates the necessary seek time (`(Date.now() - playbackStartUtc) / 1000`) and instructs its local YouTube player instance to play from that exact moment.

#### **3. DevOps & Infrastructure**

*   **Containerization (Docker & Docker Compose):** The entire application stack (Node.js backend, PostgreSQL database, Redis instance) is containerized, ensuring a consistent and reproducible development environment. The frontend is run locally using Vite's dev server.
*   **Authentication:** Uses JSON Web Tokens (JWTs) stored in secure, httpOnly cookies for authenticating REST API requests and identifying users over the WebSocket connection.

Of course. This level of detail is excellent for planning and will serve as a strong architectural document. Here is a comprehensive breakdown of the key files, their responsibilities, and the main functions within them for the backend.

---

### **`/packages/server`**

#### **Root Files**

*   **`server.ts`**
    *   **Responsibility:** The main entry point of the application. Its only job is to assemble all the pieces and start the server.
    *   **Functions/Logic:**
        *   Imports `app` from `./app.ts`.
        *   Imports `http` and `Server` from `socket.io`.
        *   Creates an `http.Server` instance using the `app`.
        *   Creates a `Socket.IO Server` instance, attaching it to the `httpServer` and configuring CORS.
        *   Imports and calls `initSocketServer(io)` from `./sockets/index.ts`.
        *   Calls `httpServer.listen()` on the configured port and logs a confirmation message.

*   **`app.ts`**
    *   **Responsibility:** To create, configure, and export the Express application instance. It knows nothing about WebSockets or the HTTP server itself.
    *   **Functions/Logic:**
        *   Creates an `express()` instance.
        *   Applies global middleware:
            *   `express.json()`: To parse JSON request bodies.
            *   `cors()`: To handle Cross-Origin Resource Sharing for the REST API.
            *   (Optional) Morgan for logging HTTP requests.
        *   Imports the main API router from `./api/routes/index.ts`.
        *   Mounts the router: `app.use('/api', mainApiRouter)`.
        *   Sets up a global error handling middleware.
        *   Exports the configured `app`.

---

### **`src/config/`**

*   **`index.ts`**
    *   **Responsibility:** To load, validate, and export all environment variables in a single, type-safe object.
    *   **Functions/Logic:**
        *   Uses `dotenv.config()` to load variables from the `.env` file.
        *   Creates a `config` object that pulls values from `process.env`.
        *   Includes runtime checks to ensure critical variables (`DATABASE_URL`, `REDIS_URL`, `YOUTUBE_API_KEY`, `JWT_SECRET`) are not undefined, throwing an error on startup if they are missing.
        *   Exports the `config` object as the default export.

---

### **`src/lib/`**

*   **`prisma.ts`**
    *   **Responsibility:** To create and export a single, globally accessible instance of the Prisma Client.
    *   **Functions/Logic:**
        *   Imports `PrismaClient` from `@prisma/client`.
        *   Creates the instance: `const prisma = new PrismaClient();`.
        *   Exports `prisma` as the default export. This prevents creating new database connection pools all over the application.

*   **`redis.ts`**
    *   **Responsibility:** To create and export a single instance of the Redis client (`ioredis`).
    *   **Functions/Logic:**
        *   Imports `Redis` from `ioredis`.
        *   Imports `config` from `../config`.
        *   Creates the instance: `const redis = new Redis(config.REDIS_URL);`.
        *   (Optional) Adds listeners for `'connect'` and `'error'` events to log connection status.
        *   Exports `redis` as the default export.

*   **`youtube.ts`**
    *   **Responsibility:** To abstract all interactions with the YouTube Data API.
    *   **Functions:**
        *   `getYouTubeVideoDetails(videoId: string): Promise<YouTubeVideoDetails | null>`: Takes a video ID, calls the Google API, and returns a normalized object with the title, duration, etc., or `null` if not found.
        *   `extractVideoIdFromUrl(url: string): string | null`: A utility function that uses a regular expression to parse a video ID from various YouTube URL formats.
        *   `parseDurationToMs(duration: string): number`: An internal helper to convert YouTube's ISO 8601 duration format (e.g., "PT5M30S") into milliseconds.

---

### **`src/api/`**

#### **`src/api/middleware/`**

*   **`auth.middleware.ts`**
    *   **Responsibility:** To protect REST API routes by verifying a user's JWT.
    *   **Functions:**
        *   `protect(req, res, next)`: The middleware function. It reads the JWT from the `Authorization` header or cookies, verifies it using `jsonwebtoken` and the `JWT_SECRET`, finds the corresponding user in the database, attaches the user object to `req.user`, and calls `next()`. If verification fails, it sends a 401 Unauthorized response.

#### **`src/api/controllers/`**

*   **`auth.controller.ts`**
    *   **Responsibility:** To handle the logic for user registration and login HTTP requests.
    *   **Functions:**
        *   `register(req, res, next)`: Validates request body, calls `userService.createUser` to hash the password and save the user, generates a JWT, and sends the response.
        *   `login(req, res, next)`: Validates request body, calls `userService.validateUserPassword`, generates a JWT, sets it in an httpOnly cookie, and sends the response.

*   **`rooms.controller.ts`**
    *   **Responsibility:** To handle the logic for room-related HTTP requests.
    *   **Functions:**
        *   `createRoom(req, res, next)`: Takes the room name from the request body and the authenticated user from `req.user` (added by the auth middleware), calls `roomService.createRoom`, and sends the new room object as the response.
        *   `listRooms(req, res, next)`: Calls `roomService.getAllRooms` and sends the list of rooms as the response.

#### **`src/api/routes/`**

*   **`auth.routes.ts`**: Defines `router.post('/register', register)` and `router.post('/login', login)`.
*   **`rooms.routes.ts`**: Defines `router.get('/', listRooms)` and `router.post('/', protect, createRoom)`. Note the use of the `protect` middleware.
*   **`index.ts`**: Imports the routers from the other files and combines them into a single main router to be used in `app.ts`.

---

### **`src/services/` (The Core Logic)**

*   **`user.service.ts`**
    *   **Responsibility:** All business logic related to users. Knows nothing about HTTP.
    *   **Functions:**
        *   `createUser(userData)`: Hashes the password with `bcrypt` and uses Prisma to create a new user in the database.
        *   `findUserById(id)`: Retrieves a user by their ID.
        *   `validateUserPassword(username, password)`: Finds a user by username and uses `bcrypt.compare` to check if the provided password is correct.

*   **`room.service.ts`**
    *   **Responsibility:** All business logic for managing rooms and real-time state.
    *   **Functions:**
        *   `createRoom(name, ownerId)`: Uses Prisma to create a new room in PostgreSQL.
        *   `getAllRooms()`: Uses Prisma to get a list of all rooms.
        *   `addUserToRoom(roomId, userId)`: Uses `redis.sadd` to add a user to the presence Set for a room.
        *   `removeUserFromRoom(roomId, userId)`: Uses `redis.srem` to remove a user.
        *   `playNextSong(roomId, io: Server)`: The main "conductor" function. It gets the next song from the playlist service, updates the room's state in the Redis Hash, and (eventually) uses the `io` instance to broadcast the `playNewSong` command.

*   **`playlist.service.ts`**
    *   **Responsibility:** All logic for manipulating a room's playlist in Redis.
    *   **Functions:**
        *   `addSong(roomId, videoId)`: Calls `youtube.getYouTubeVideoDetails`, then uses `redis.zadd` to add the song (as a JSON string) to the room's playlist Sorted Set with a score of 0.
        *   `voteOnSong(roomId, songJson, vote)`: Uses `redis.zincrby` to change the score of a song in the Sorted Set.
        *   `getPlaylist(roomId)`: Uses `redis.zrange` to get the current list of songs and their scores, then parses them into a proper array of objects.
        *   `getNextSong(roomId)`: Uses `redis.zpopmax` to atomically get and remove the song with the highest score.

---

### **`src/sockets/`**

*   **`index.ts`**
    *   **Responsibility:** The main entry point for all Socket.IO logic.
    *   **Functions:**
        *   `initSocketServer(io: Server)`: The only export. It sets up the main `io.on('connection', ...)` listener. Inside the listener, it calls the handler registration functions from other files in the directory, passing them the `io` and `socket` instances.

*   **`roomHandler.ts`**
    *   **Responsibility:** To define and register all event listeners related to room activities.
    *   **Functions:**
        *   `registerRoomHandlers(io: Server, socket: Socket)`: This function is called once per connecting client. It sets up all the listeners for that specific socket:
            *   `socket.on('joinRoom', (payload) => { ... })`: Calls `roomService.addUserToRoom`, joins the Socket.IO room, and broadcasts `userJoined`.
            *   `socket.on('addSong', (payload) => { ... })`: Calls `playlistService.addSong`, then gets the new playlist and broadcasts `playlistUpdated`.
            *   `socket.on('voteSong', (payload) => { ... })`: Calls `playlistService.voteOnSong`, then broadcasts `playlistUpdated`.
            *   `socket.on('songEnded', (payload) => { ... })`: Verifies the sender is the "host," then calls `roomService.playNextSong`.