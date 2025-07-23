import redis from '../lib/redis';
import { PLAYLIST_KEY } from './playlist';
import { Server } from 'socket.io';

const ROOM_USERS_KEY = (roomId: string) => `room:users:${roomId}`;

export const addUserToRoom = async (roomId: string, userId: string) => {
  // SADD is idempotent. If the user is already in the set, it does nothing.
  await redis.sadd(ROOM_USERS_KEY(roomId), userId);
  console.log(`User ${userId} added to Redis set for room ${roomId}`);
};

export const removeUserFromRoom = async (roomId: string, userId: string) => {
  await redis.srem(ROOM_USERS_KEY(roomId), userId);
  console.log(`User ${userId} removed from Redis set for room ${roomId}`);
};

export const getRoomUsers = async (roomId: string) => {
  // Returns an array of userIds in the room
  const userIds = await redis.smembers(ROOM_USERS_KEY(roomId));
  return userIds;
};
export const playNextSong = async (roomId: string, io: Server) => {
  // Pop the next song (lowest score) from the playlist
  const popped = await redis.zpopmin(PLAYLIST_KEY(roomId), 1);
  if (!popped || popped.length === 0) {
    // No song to play
    io.to(roomId).emit('playNewSong', null);
    return;
  }
  // popped is an array: [member, score]
  const [songJson] = popped;
  let song;
  try {
    song = JSON.parse(songJson);
  } catch (e) {
    song = null;
  }
  // Broadcast the new song to the room
  io.to(roomId).emit('playNewSong', song);
};