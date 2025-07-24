import redis from '../lib/redis';

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
