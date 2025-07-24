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

// A map to store room and user info for each socket.
// For a scalable application, you'd use Redis for this.
const socketContext = new Map<string, { roomId: string; userId: string }>();

export const registerRoomHandlers = (io: Server, socket: Socket) => {
  const handleError = (handlerName: string, error: unknown) => {
    console.error(`Error in ${handlerName}:`, error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred.';
    socket.emit('error', { message });
  };

  socket.on('joinRoom', async (payload: { roomId: string; userId: string; username?: string }) => {
    const { roomId, userId, username } = payload;
    if (!roomId || !userId) {
      return socket.emit('error', { message: 'Room ID and User ID are required.' });
    }

    try {
      console.log(`User ${userId} (${username}) joining room ${roomId}`);
      
      socket.join(roomId);
      socketContext.set(socket.id, { roomId, userId });

      // Ensure room exists in database (create if it doesn't exist)
      try {
        await prisma.room.upsert({
          where: { id: roomId },
          update: {},
          create: {
            id: roomId,
            name: `Room ${roomId}`,
            ownerId: userId, // First user becomes owner
          },
        });
      } catch (dbError) {
        console.log('Room might already exist or DB error:', dbError);
      }

      // Store user info with username in Redis
      const userInfo = { id: userId, username: username || `User-${userId.substring(0, 8)}` };
      await redis.hset(`room:${roomId}:users`, userId, JSON.stringify(userInfo));
      await addUserToRoom(roomId, userId);

      // Notify other users that someone joined
      socket.broadcast.to(roomId).emit('userJoined', { userId, username: userInfo.username });

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

      console.log(`Sending roomState to user ${userId}:`, {
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
        await deleteRoom(roomId);
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
            users.push({ id, username: `User-${id.substring(0, 8)}` });
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
      const { roomId, userId } = context;
      try {
        await removeUserFromRoom(roomId, userId);
        // Remove user data from room users hash
        await redis.hdel(`room:${roomId}:users`, userId);
        
        const remainingUsers = await getRoomUsers(roomId);

        if (remainingUsers.length === 0) {
          // If the room is empty, delete it from the database and clean up Redis
          await deleteRoom(roomId);
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
              users.push({ id, username: `User-${id.substring(0, 8)}` });
            }
          }
          io.to(roomId).emit('usersUpdated', users);
        }

        socketContext.delete(socket.id);
        console.log(`User ${userId} disconnected from room ${roomId}`);
      } catch (error) {
        console.error(`Error handling disconnect for user ${userId} in room ${roomId}:`, error);
      }
    }
  });
};