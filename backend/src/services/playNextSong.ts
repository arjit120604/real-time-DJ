
import { Server } from 'socket.io';
import { getNextSong } from '../controllers/playlist';
import redis from '../lib/redis';

export const ROOM_STATE_KEY = (roomId: string) => `room:state:${roomId}`;

export const playNextSong = async (io: Server, roomId: string) => {
  // 1. Get the next song from the playlist
  const song = await getNextSong(roomId);

  if (song) {
    // 2. Capture the server's authoritative start time
    const playbackStartUtc = Date.now();

    // 3. Update the room's state in Redis
    await redis.hset(ROOM_STATE_KEY(roomId), {
      currentSong: JSON.stringify(song),
      playbackStartUtc: playbackStartUtc.toString(),
    });

    // 4. Broadcast the 'playNewSong' event to the room
    io.to(roomId).emit('playNewSong', {
      song,
      playbackStartUtc,
    });
  } else {
    // If no song is available, clear the current song state
    await redis.hdel(ROOM_STATE_KEY(roomId), 'currentSong', 'playbackStartUtc');
    io.to(roomId).emit('noSongAvailable');
  }
};
