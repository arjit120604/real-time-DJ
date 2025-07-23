import { Server, Socket } from 'socket.io';
import { addUserToRoom, removeUserFromRoom, getRoomUsers } from '../controllers/socketActions';
import { addSongToPlaylist, voteForSong, getPlaylist, PLAYLIST_KEY } from '../controllers/playlist';
import { deleteRoom } from '../controllers/rooms';
import { playNextSong, ROOM_STATE_KEY } from '../services/playNextSong';
import redis from '../lib/redis';

// A map to store room and user info for each socket.
// For a scalable application, you'd use Redis for this.
const socketContext = new Map<string, { roomId: string; userId: string }>();

export const registerRoomHandlers = (io: Server, socket: Socket) => {
  const handleError = (handlerName: string, error: unknown) => {
    console.error(`Error in ${handlerName}:`, error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred.';
    socket.emit('error', { message });
  };

  socket.on('joinRoom', async (payload: { roomId: string; userId: string }) => {
    const { roomId, userId } = payload;
    if (!roomId || !userId) {
      return socket.emit('error', { message: 'Room ID and User ID are required.' });
    }

    try {
      socket.join(roomId);
      socketContext.set(socket.id, { roomId, userId });

      await addUserToRoom(roomId, userId);

      socket.broadcast.to(roomId).emit('userJoined', { userId, username: 'temp' });

      const [playlist, users, currentSongState] = await Promise.all([
        getPlaylist(roomId),
        getRoomUsers(roomId),
        redis.hgetall(ROOM_STATE_KEY(roomId)),
      ]);

      const roomState: any = { playlist, users };
      if (currentSongState && currentSongState.currentSong) {
        roomState.currentSong = JSON.parse(currentSongState.currentSong);
        roomState.playbackStartUtc = parseInt(currentSongState.playbackStartUtc, 10);
      }

      socket.emit('roomState', roomState);
    } catch (error) {
      handleError('joinRoom', error);
    }
  });

  socket.on('addSong', async (payload: { roomId: string; videoId: string }) => {
    const { roomId, videoId } = payload;
    if (!roomId || !videoId) {
      return socket.emit('error', { message: 'Room ID and Video ID are required.' });
    }

    try {
      const song = await addSongToPlaylist(roomId, videoId);
      const playlist = await getPlaylist(roomId);
      io.to(roomId).emit('playlistUpdated', playlist);

      const currentlyPlaying = await redis.hget(ROOM_STATE_KEY(roomId), 'currentSong');
      if (!currentlyPlaying) {
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

  socket.on('disconnect', async () => {
    const context = socketContext.get(socket.id);
    if (context) {
      const { roomId, userId } = context;
      try {
        await removeUserFromRoom(roomId, userId);
        const remainingUsers = await getRoomUsers(roomId);

        if (remainingUsers.length === 0) {
          // If the room is empty, delete it from the database and clean up Redis
          await deleteRoom(roomId);
          await redis.del(PLAYLIST_KEY(roomId));
          await redis.del(ROOM_STATE_KEY(roomId));
          console.log(`Cleaned up room ${roomId} as it is now empty.`);
        } else {
          // Otherwise, just notify others that the user has left
          io.to(roomId).emit('userLeft', { userId });
          io.to(roomId).emit('usersUpdated', remainingUsers);
        }

        socketContext.delete(socket.id);
        console.log(`User ${userId} disconnected from room ${roomId}`);
      } catch (error) {
        console.error(`Error handling disconnect for user ${userId} in room ${roomId}:`, error);
      }
    }
  });
};