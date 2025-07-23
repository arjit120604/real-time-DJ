
# Real-Time DJ Socket API

This document outlines the Socket.IO events used for real-time communication between the client and the server.

---

## Client to Server Events

These are events emitted by the client to the server.

### `joinRoom`

A user requests to join a specific room. This is the first event a client must send to participate in a room.

-   **Payload:**
    ```json
    {
      "roomId": "string",
      "userId": "string"
    }
    ```

### `addSong`

A user adds a new song to the room's playlist. The song is identified by its YouTube video ID.

-   **Payload:**
    ```json
    {
      "roomId": "string",
      "videoId": "string"
    }
    ```

### `voteSong`

A user casts a vote for a song currently in the playlist.

-   **Payload:**
    ```json
    {
      "roomId": "string",
      "songId": "string",
      "vote": 1
    }
    ```

### `playNextSong`

The "host" client signals that the current song has finished and the server should start the next song in the playlist.

-   **Payload:**
    ```json
    {
      "roomId": "string"
    }
    ```

### `disconnect`

A standard Socket.IO event fired when a client disconnects. The server handles cleaning up the user's state.

-   **Payload:** None.

---

## Server to Client Events

These are events emitted by the server to clients.

### `roomState`

Sent to a single client when they successfully join a room. It provides the complete current state of the room.

-   **Payload:**
    ```json
    {
      "playlist": [
        {
          "id": "string",
          "title": "string",
          "durationMs": "number",
          "thumbnailUrl": "string",
          "score": "number"
        }
      ],
      "users": ["string"],
      "currentSong": {
        "id": "string",
        "title": "string",
        "durationMs": "number",
        "thumbnailUrl": "string"
      },
      "playbackStartUtc": "number"
    }
    ```

### `playNewSong`

Broadcast to all clients in a room when a new song starts playing.

-   **Payload:**
    ```json
    {
      "song": {
        "id": "string",
        "title": "string",
        "durationMs": "number",
        "thumbnailUrl": "string"
      },
      "playbackStartUtc": "number"
    }
    ```

### `playlistUpdated`

Broadcast to all clients in a room whenever the playlist changes (a song is added or a vote is cast).

-   **Payload:** An array of song objects.
    ```json
    [
      {
        "id": "string",
        "title": "string",
        "durationMs": "number",
        "thumbnailUrl": "string",
        "score": "number"
      }
    ]
    ```

### `userJoined`

Broadcast to all clients in a room (except the one who joined) when a new user connects.

-   **Payload:**
    ```json
    {
      "userId": "string",
      "username": "string"
    }
    ```

### `userLeft`

Broadcast to all clients in a room when a user disconnects.

-   **Payload:**
    ```json
    {
      "userId": "string"
    }
    ```

### `usersUpdated`

Broadcast to all clients in a room when the list of users changes.

-   **Payload:** An array of user ID strings.
    ```json
    ["string"]
    ```

### `noSongAvailable`

Broadcast to all clients in a room when the playlist becomes empty and there is no song to play.

-   **Payload:** None.

### `error`

Sent to a single client when their action results in an error.

-   **Payload:**
    ```json
    {
      "message": "string"
    }
    ```
