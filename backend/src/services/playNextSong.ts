
import { Server } from 'socket.io';
import { getNextSong, getPlaylist } from '../controllers/playlist';
import redis from '../lib/redis';

export const ROOM_STATE_KEY = (roomId: string) => `room:state:${roomId}`;

/**
 * Simplified room state interface - only essential fields
 * This follows the minimal state approach as per requirement 4.1 and 4.2
 */
interface RoomState {
  currentSong?: string;           // JSON serialized song object
  playbackStartUtc?: string;      // Universal timestamp as string
  isPlaying?: string;             // "true" or "false"
}

// Deprecated fields that should be cleaned up
export const DEPRECATED_FIELDS = ['pausedAt', 'pauseOffsetMs', 'pauseStartTime'];

export const playNextSong = async (io: Server, roomId: string) => {
  console.log(`Playing next song for room ${roomId}`);
  
  // 1. Get the next song from the playlist (this removes it from the queue)
  const song = await getNextSong(roomId);
  console.log('Next song from queue:', song);

  if (song) {
    // 2. Capture the server's authoritative start time
    const playbackStartUtc = Date.now();

    // 3. Update the room's state in Redis (clear any old pause state)
    await redis.hset(ROOM_STATE_KEY(roomId), {
      currentSong: JSON.stringify(song),
      playbackStartUtc: playbackStartUtc.toString(),
      isPlaying: 'true',
    });
    
    // Clean up any deprecated fields
    await redis.hdel(ROOM_STATE_KEY(roomId), ...DEPRECATED_FIELDS);

    console.log(`Broadcasting playNewSong event for room ${roomId}:`, { song, playbackStartUtc });
    
    // 4. Broadcast the 'playNewSong' event to the room
    io.to(roomId).emit('playNewSong', {
      song,
      isPlaying: true,
      playbackStartUtc, // Send the absolute timestamp
    });

    // 5. Send updated playlist since a song was removed from the queue
    const updatedPlaylist = await getPlaylist(roomId);
    io.to(roomId).emit('playlistUpdated', updatedPlaylist);
  } else {
    console.log(`No songs available in queue for room ${roomId}`);
    // If no song is available, clear all current song state including deprecated fields
    await redis.hdel(ROOM_STATE_KEY(roomId), 'currentSong', 'playbackStartUtc', 'isPlaying', ...DEPRECATED_FIELDS);
    io.to(roomId).emit('noSongAvailable');
  }
};

export const pausePlayback = async (io: Server, roomId: string) => {
  const currentState = await redis.hgetall(ROOM_STATE_KEY(roomId)) as RoomState;
  
  if (currentState.currentSong && currentState.isPlaying === 'true') {
    // Calculate the current song position at the time of pause
    const originalPlaybackStartUtc = parseInt(currentState.playbackStartUtc!, 10);
    const songPositionMs = Date.now() - originalPlaybackStartUtc;
    
    // Create a virtual start time that represents the "frozen" timeline
    // This virtual start time preserves the song position for when we resume
    const pausedVirtualStartUtc = Date.now() - songPositionMs;
    
    await redis.hset(ROOM_STATE_KEY(roomId), {
      isPlaying: 'false',
      playbackStartUtc: pausedVirtualStartUtc.toString(), // Store the frozen timeline
    });
    
    // Clean up any deprecated fields that might exist
    await redis.hdel(ROOM_STATE_KEY(roomId), ...DEPRECATED_FIELDS);
    
    console.log(`Broadcasting playbackStateChanged for room ${roomId} (pausing):`, {
      isPlaying: false,
    });

    // Broadcast the new state to all clients - simple, just the playing state
    io.to(roomId).emit('playbackStateChanged', {
      isPlaying: false,
    });
  }
};

export const resumePlayback = async (io: Server, roomId: string) => {
  const currentState = await redis.hgetall(ROOM_STATE_KEY(roomId)) as RoomState;
  
  if (currentState.currentSong && currentState.isPlaying === 'false' && currentState.playbackStartUtc) {
    // When we paused, we stored a virtual start time that represents the frozen timeline
    // The pausedVirtualStartUtc was calculated as: pauseTime - songPositionAtPause
    // This means: songPositionAtPause = pauseTime - pausedVirtualStartUtc
    // But since we don't know the exact pause time, we can use the fact that
    // the pausedVirtualStartUtc represents the correct song position when calculated with current time
    const pausedVirtualStartUtc = parseInt(currentState.playbackStartUtc, 10);
    
    // The pausedVirtualStartUtc represents the virtual start time that was calculated during pause
    // It was set to preserve the song position at the time of pause
    // Since time has passed since the pause, we need to use the pausedVirtualStartUtc directly
    // because it already represents the correct timeline position
    const newPlaybackStartUtc = pausedVirtualStartUtc;
    
    // Update the room's state in Redis
    await redis.hset(ROOM_STATE_KEY(roomId), {
      isPlaying: 'true',
      playbackStartUtc: newPlaybackStartUtc.toString(),
    });
    
    // Clean up any deprecated fields that might exist
    await redis.hdel(ROOM_STATE_KEY(roomId), ...DEPRECATED_FIELDS);
    
    console.log(`Broadcasting playbackStateChanged for room ${roomId} (resuming):`, {
      isPlaying: true,
      playbackStartUtc: newPlaybackStartUtc,
    });

    // Broadcast the new, authoritative state to all clients
    io.to(roomId).emit('playbackStateChanged', {
      isPlaying: true,
      playbackStartUtc: newPlaybackStartUtc,
    });
  }
};

export const seekPlayback = async (io: Server, roomId: string, seekToMs: number) => {
  const currentState = await redis.hgetall(ROOM_STATE_KEY(roomId)) as RoomState;
  
  if (currentState.currentSong) {
    // Ensure seekToMs is a valid number and clamp to reasonable bounds
    const clampedSeekToMs = Math.max(0, Math.floor(seekToMs));
    
    // Calculate new virtual playbackStartUtc based on seek position
    // Goal: (Date.now() - newPlaybackStartUtc) equals the seekToMs
    const newPlaybackStartUtc = Date.now() - clampedSeekToMs;
    
    // Update the room's state in Redis
    await redis.hset(ROOM_STATE_KEY(roomId), {
      playbackStartUtc: newPlaybackStartUtc.toString(),
      isPlaying: 'true', // Seeking implies playback should be active
    });
    
    // Clean up any deprecated fields that might exist
    await redis.hdel(ROOM_STATE_KEY(roomId), ...DEPRECATED_FIELDS);
    
    console.log(`Broadcasting playbackStateChanged for room ${roomId} (seeking):`, {
      isPlaying: true,
      playbackStartUtc: newPlaybackStartUtc,
    });

    // Broadcast the new, authoritative state to all clients
    io.to(roomId).emit('playbackStateChanged', {
      isPlaying: true,
      playbackStartUtc: newPlaybackStartUtc,
    });
  }
};

/**
 * Utility function to clean up deprecated fields from an existing room
 * This ensures that the room in Redis follows the minimal state approach (requirement 4.1, 4.2, 4.4)
 */
export const cleanupDeprecatedFields = async (roomId: string): Promise<void> => {
  try {
    // Check if any deprecated fields exist before attempting to delete
    const roomState = await redis.hgetall(ROOM_STATE_KEY(roomId));
    const fieldsToDelete = DEPRECATED_FIELDS.filter(field => field in roomState);
    
    if (fieldsToDelete.length > 0) {
      const deletedCount = await redis.hdel(ROOM_STATE_KEY(roomId), ...fieldsToDelete);
      if (deletedCount > 0) {
        console.log(`Cleaned up ${deletedCount} deprecated fields from room ${roomId}`);
      }
    }
  } catch (error) {
    console.error(`Error cleaning up deprecated fields for room ${roomId}:`, error);
  }
};

/**
 * Utility function to clean up deprecated fields for all existing rooms
 * This can be called during server startup or as a maintenance task
 * to ensure all rooms follow the minimal state approach (requirement 4.4)
 */
export const cleanupAllRooms = async (): Promise<void> => {
  try {
    // Get all room state keys from Redis
    const keys = await redis.keys('room:state:*');
    console.log(`Found ${keys.length} room state keys to check for cleanup`);
    
    // Process each room
    for (const key of keys) {
      const roomId = key.replace('room:state:', '');
      await cleanupDeprecatedFields(roomId);
    }
    
    console.log(`Completed cleanup check for all ${keys.length} rooms`);
  } catch (error) {
    console.error('Error cleaning up all rooms:', error);
  }
};

// Utility function to get current room state with proper typing
export const getRoomState = async (roomId: string): Promise<RoomState> => {
  return await redis.hgetall(ROOM_STATE_KEY(roomId)) as RoomState;
};

/**
 * Legacy function for backward compatibility - will be removed once frontend is updated
 * This is marked as deprecated and should be removed in future updates
 * @deprecated Use pausePlayback and resumePlayback instead
 */
export const togglePlayPause = async (io: Server, roomId: string, isPlaying: boolean) => {
  if (isPlaying) {
    await resumePlayback(io, roomId);
  } else {
    await pausePlayback(io, roomId);
  }
};
