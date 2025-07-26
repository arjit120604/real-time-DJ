import { Server, Socket } from 'socket.io';
import { addUserToRoom, removeUserFromRoom, getRoomUsers } from '../controllers/socketActions';
import { addSongToPlaylist, voteForSong, getPlaylist, PLAYLIST_KEY } from '../controllers/playlist';
import { deleteRoom } from '../controllers/rooms';
import { 
  playNextSong, 
  pausePlayback, 
  resumePlayback, 
  seekPlayback, 
  ROOM_STATE_KEY, 
  cleanupDeprecatedFields, 
  getRoomState,
  DEPRECATED_FIELDS,
  // togglePlayPause is deprecated and will be removed once frontend is updated
  togglePlayPause
} from '../services/playNextSong';
import redis from '../lib/redis';
import prisma from '../db';
import { v4 as uuidv4 } from 'uuid';

// A map to store room and user info for each socket.
// For a scalable application, you'd use Redis for this.
const socketContext = new Map<string, { roomId: string; userId: string; isGuest?: boolean }>();

// Helper function to validate if a room exists in the database
export const validateRoomExists = async (roomId: string): Promise<boolean> => {
  try {
    const room = await prisma.room.findUnique({
      where: { id: roomId }
    });
    return !!room;
  } catch (error) {
    console.error('Error validating room existence:', error);
    return false;
  }
};

export const registerRoomHandlers = (io: Server, socket: Socket) => {
  const handleError = (handlerName: string, error: unknown) => {
    console.error(`Error in ${handlerName}:`, error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred.';
    socket.emit('error', { message });
  };

  socket.on('joinRoom', async (payload: { roomId: string; userId?: string; username: string; isGuest?: boolean }) => {
    const { roomId, userId, username, isGuest = false } = payload;
    
    // Validate required fields
    if (!roomId || !username) {
      return socket.emit('error', { 
        message: 'Room ID and username are required.',
        code: 'VALIDATION_ERROR'
      });
    }

    // For registered users, userId is required
    if (!isGuest && !userId) {
      return socket.emit('error', { 
        message: 'User ID is required for registered users.',
        code: 'VALIDATION_ERROR'
      });
    }

    try {
      // For guest users, validate that the room exists (no auto-creation)
      if (isGuest) {
        const roomExists = await validateRoomExists(roomId);
        if (!roomExists) {
          return socket.emit('error', { 
            message: 'Room does not exist. Please check the room ID.',
            code: 'ROOM_NOT_FOUND',
            suggestedAction: 'TRY_DIFFERENT_ROOM'
          });
        }
      }

      // Generate a unique ID for guest users
      const effectiveUserId = isGuest ? `guest_${uuidv4()}` : userId!;
      
      console.log(`${isGuest ? 'Guest' : 'User'} ${effectiveUserId} (${username}) joining room ${roomId}`);
      
      socket.join(roomId);
      socketContext.set(socket.id, { roomId, userId: effectiveUserId, isGuest });

      // For registered users, ensure room exists in database (create if it doesn't exist)
      if (!isGuest) {
        try {
          await prisma.room.upsert({
            where: { id: roomId },
            update: {},
            create: {
              id: roomId,
              name: `Room ${roomId}`,
              ownerId: userId!, // First user becomes owner
            },
          });
        } catch (dbError) {
          console.log('Room might already exist or DB error:', dbError);
        }
      }

      // Store user info with username and guest status in Redis
      const userInfo = { 
        id: effectiveUserId, 
        username, 
        isGuest 
      };
      await redis.hset(`room:${roomId}:users`, effectiveUserId, JSON.stringify(userInfo));
      await addUserToRoom(roomId, effectiveUserId);

      // Notify other users that someone joined
      socket.broadcast.to(roomId).emit('userJoined', { 
        userId: effectiveUserId, 
        username: userInfo.username,
        isGuest 
      });

      // Clean up any deprecated fields from existing room state
      // This ensures we follow the minimal state approach (requirement 4.1, 4.2, 4.4)
      await cleanupDeprecatedFields(roomId);

      // Get current room state using the simplified interface
      const [playlist, userIds, currentSongState] = await Promise.all([
        getPlaylist(roomId),
        getRoomUsers(roomId),
        getRoomState(roomId),
      ]);

      console.log(`Room ${roomId} state:`, {
        playlistLength: playlist.length,
        userCount: userIds.length,
        hasCurrentSong: !!currentSongState.currentSong
      });

      // Get user details for all connected users
      const users = [];
      for (const id of userIds) {
        const userDataStr = await redis.hget(`room:${roomId}:users`, id);
        if (userDataStr) {
          users.push(JSON.parse(userDataStr));
        } else {
          users.push({ id, username: `User-${id.substring(0, 8)}` });
        }
      }

      const roomState: any = { playlist, users };
      if (currentSongState && currentSongState.currentSong) {
        roomState.currentSong = JSON.parse(currentSongState.currentSong);
        roomState.isPlaying = currentSongState.isPlaying === 'true';
        
        // Send the absolute timestamp for client sync
        if (currentSongState.playbackStartUtc) {
          roomState.playbackStartUtc = parseInt(currentSongState.playbackStartUtc, 10);
        }
      }

      console.log(`Sending roomState to user ${effectiveUserId}:`, {
        playlistLength: roomState.playlist.length,
        userCount: roomState.users.length,
        currentSong: roomState.currentSong?.title || 'none',
        isPlaying: roomState.isPlaying
      });

      socket.emit('roomState', roomState);
    } catch (error) {
      handleError('joinRoom', error);
    }
  });

  socket.on('addSong', async (payload: { roomId: string; videoId: string; username: string }) => {
    const { roomId, videoId, username } = payload;
    if (!roomId || !videoId) {
      return socket.emit('error', { message: 'Room ID and Video ID are required.' });
    }

    try {
      await addSongToPlaylist(roomId, videoId, username);
      const playlist = await getPlaylist(roomId);
      io.to(roomId).emit('playlistUpdated', playlist);

      // Check if there's currently no song playing and auto-start playback
      const currentlyPlaying = await redis.hget(ROOM_STATE_KEY(roomId), 'currentSong');
      console.log('Current song state after adding:', currentlyPlaying);
      
      if (!currentlyPlaying) {
        console.log('No song currently playing, starting auto-play');
        await playNextSong(io, roomId);
      }
    } catch (error) {
      handleError('addSong', error);
    }
  });

  socket.on('voteSong', async (payload: { roomId: string; songId: string; vote: 1 | -1 }) => {
    const { roomId, songId, vote } = payload;
    if (!roomId || !songId || !vote) {
      return socket.emit('error', { message: 'Room ID, Song ID, and vote are required.' });
    }

    try {
      await voteForSong(roomId, songId, vote);
      const playlist = await getPlaylist(roomId);
      io.to(roomId).emit('playlistUpdated', playlist);
    } catch (error) {
      handleError('voteSong', error);
    }
  });

  socket.on('playNextSong', async (payload: { roomId: string }) => {
    const { roomId } = payload;
    if (!roomId) {
      return socket.emit('error', { message: 'Room ID is required.' });
    }

    try {
      // Potentially add a check here to ensure the user is the host
      await playNextSong(io, roomId);
    } catch (error) {
      handleError('playNextSong', error);
    }
  });

  socket.on('pausePlayback', async (payload: { roomId: string }) => {
    const { roomId } = payload;
    if (!roomId) {
      return socket.emit('error', { message: 'Room ID is required.' });
    }

    try {
      await pausePlayback(io, roomId);
    } catch (error) {
      handleError('pausePlayback', error);
    }
  });

  socket.on('resumePlayback', async (payload: { roomId: string }) => {
    const { roomId } = payload;
    if (!roomId) {
      return socket.emit('error', { message: 'Room ID is required.' });
    }

    try {
      await resumePlayback(io, roomId);
    } catch (error) {
      handleError('resumePlayback', error);
    }
  });

  socket.on('seekPlayback', async (payload: { roomId: string; seekToMs: number }) => {
    const { roomId, seekToMs } = payload;
    if (!roomId || typeof seekToMs !== 'number' || isNaN(seekToMs)) {
      return socket.emit('error', { message: 'Room ID and valid seek position are required.' });
    }

    try {
      await seekPlayback(io, roomId, seekToMs);
    } catch (error) {
      handleError('seekPlayback', error);
    }
  });

  // Legacy handler for backward compatibility - will be removed once frontend is updated
  socket.on('togglePlayPause', async (payload: { roomId: string; isPlaying: boolean }) => {
    const { roomId, isPlaying } = payload;
    if (!roomId || typeof isPlaying !== 'boolean') {
      return socket.emit('error', { message: 'Room ID and isPlaying state are required.' });
    }

    try {
      await togglePlayPause(io, roomId, isPlaying);
    } catch (error) {
      handleError('togglePlayPause', error);
    }
  });

  socket.on('leaveRoom', async (payload: { roomId: string; userId: string }) => {
    const { roomId, userId } = payload;
    if (!roomId || !userId) {
      return;
    }

    try {
      socket.leave(roomId);
      await removeUserFromRoom(roomId, userId);
      await redis.hdel(`room:${roomId}:users`, userId);
      
      const remainingUsers = await getRoomUsers(roomId);
      
      if (remainingUsers.length === 0) {
        // Only delete the room from database if it was created by a registered user
        // Guest users cannot create rooms, so we check if the room has registered users
        const context = socketContext.get(socket.id);
        if (context && !context.isGuest) {
          await deleteRoom(roomId);
        }
        await redis.del(PLAYLIST_KEY(roomId));
        await redis.del(ROOM_STATE_KEY(roomId));
        await redis.del(`room:${roomId}:users`);
        console.log(`Cleaned up room ${roomId} as it is now empty.`);
      } else {
        socket.broadcast.to(roomId).emit('userLeft', { userId });
        
        const users = [];
        for (const id of remainingUsers) {
          const userDataStr = await redis.hget(`room:${roomId}:users`, id);
          if (userDataStr) {
            users.push(JSON.parse(userDataStr));
          } else {
            users.push({ id, username: `User-${id.substring(0, 8)}`, isGuest: false });
          }
        }
        io.to(roomId).emit('usersUpdated', users);
      }
      
      console.log(`User ${userId} left room ${roomId}`);
    } catch (error) {
      console.error(`Error handling leaveRoom for user ${userId} in room ${roomId}:`, error);
    }
  });

  socket.on('disconnect', async () => {
    const context = socketContext.get(socket.id);
    if (context) {
      const { roomId, userId, isGuest } = context;
      try {
        await removeUserFromRoom(roomId, userId);
        // Remove user data from room users hash
        await redis.hdel(`room:${roomId}:users`, userId);
        
        const remainingUsers = await getRoomUsers(roomId);

        if (remainingUsers.length === 0) {
          // Only delete the room from database if it was created by a registered user
          // Guest users cannot create rooms
          if (!isGuest) {
            await deleteRoom(roomId);
          }
          await redis.del(PLAYLIST_KEY(roomId));
          await redis.del(ROOM_STATE_KEY(roomId));
          await redis.del(`room:${roomId}:users`);
          console.log(`Cleaned up room ${roomId} as it is now empty.`);
        } else {
          // Otherwise, just notify others that the user has left
          io.to(roomId).emit('userLeft', { userId });
          
          // Get updated user details for remaining users
          const users = [];
          for (const id of remainingUsers) {
            const userDataStr = await redis.hget(`room:${roomId}:users`, id);
            if (userDataStr) {
              users.push(JSON.parse(userDataStr));
            } else {
              users.push({ id, username: `User-${id.substring(0, 8)}`, isGuest: false });
            }
          }
          io.to(roomId).emit('usersUpdated', users);
        }

        socketContext.delete(socket.id);
        console.log(`${isGuest ? 'Guest' : 'User'} ${userId} disconnected from room ${roomId}`);
      } catch (error) {
        console.error(`Error handling disconnect for user ${userId} in room ${roomId}:`, error);
      }
    }
  });
};