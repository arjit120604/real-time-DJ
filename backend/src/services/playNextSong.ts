
import { Server } from 'socket.io';
import { getNextSong, getPlaylist } from '../controllers/playlist';
import redis from '../lib/redis';

export const ROOM_STATE_KEY = (roomId: string) => `room:state:${roomId}`;

export const playNextSong = async (io: Server, roomId: string) => {
  console.log(`Playing next song for room ${roomId}`);
  
  // 1. Get the next song from the playlist (this removes it from the queue)
  const song = await getNextSong(roomId);
  console.log('Next song from queue:', song);

  if (song) {
    // 2. Capture the server's authoritative start time
    const playbackStartUtc = Date.now();

    // 3. Update the room's state in Redis
    await redis.hset(ROOM_STATE_KEY(roomId), {
      currentSong: JSON.stringify(song),
      playbackStartUtc: playbackStartUtc.toString(),
      isPlaying: 'true',
    });

    console.log(`Broadcasting playNewSong event for room ${roomId}:`, { song, playbackStartUtc });
    
    // 4. Broadcast the 'playNewSong' event to the room
    io.to(roomId).emit('playNewSong', {
      song,
      playbackStartUtc,
      isPlaying: true,
    });

    // 5. Send updated playlist since a song was removed from the queue
    const updatedPlaylist = await getPlaylist(roomId);
    io.to(roomId).emit('playlistUpdated', updatedPlaylist);
  } else {
    console.log(`No songs available in queue for room ${roomId}`);
    // If no song is available, clear the current song state
    await redis.hdel(ROOM_STATE_KEY(roomId), 'currentSong', 'playbackStartUtc', 'isPlaying');
    io.to(roomId).emit('noSongAvailable');
  }
};

export const togglePlayPause = async (io: Server, roomId: string, isPlaying: boolean) => {
  const currentState = await redis.hgetall(ROOM_STATE_KEY(roomId));
  
  if (currentState.currentSong) {
    let newPlaybackStartUtc = currentState.playbackStartUtc;
    let currentPlaybackTime = 0;
    
    if (isPlaying && currentState.isPlaying === 'false') {
      // Resuming - calculate new start time to maintain sync
      const pausedAt = parseInt(currentState.pausedAt || '0', 10);
      currentPlaybackTime = Math.floor(pausedAt / 1000); // Convert to seconds for YouTube player
      newPlaybackStartUtc = (Date.now() - pausedAt).toString();
    } else if (!isPlaying && currentState.isPlaying === 'true') {
      // Pausing - store the current elapsed time
      const elapsedMs = Date.now() - parseInt(currentState.playbackStartUtc, 10);
      currentPlaybackTime = Math.floor(elapsedMs / 1000); // Convert to seconds
      await redis.hset(ROOM_STATE_KEY(roomId), 'pausedAt', elapsedMs.toString());
    } else if (isPlaying && currentState.isPlaying === 'true') {
      // Already playing - calculate current position for sync
      const elapsedMs = Date.now() - parseInt(currentState.playbackStartUtc, 10);
      currentPlaybackTime = Math.floor(elapsedMs / 1000);
    } else if (!isPlaying && currentState.isPlaying === 'false') {
      // Already paused - use stored position
      const pausedAt = parseInt(currentState.pausedAt || '0', 10);
      currentPlaybackTime = Math.floor(pausedAt / 1000);
    }
    
    await redis.hset(ROOM_STATE_KEY(roomId), {
      isPlaying: isPlaying.toString(),
      playbackStartUtc: newPlaybackStartUtc,
    });

    console.log(`Broadcasting playbackStateChanged for room ${roomId}:`, {
      isPlaying,
      playbackStartUtc: parseInt(newPlaybackStartUtc, 10),
      currentPlaybackTime,
    });

    io.to(roomId).emit('playbackStateChanged', {
      isPlaying,
      playbackStartUtc: parseInt(newPlaybackStartUtc, 10),
      currentPlaybackTime, // Send exact playback position for sync
    });
  }
};
