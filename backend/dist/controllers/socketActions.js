"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.playNextSong = exports.getRoomUsers = exports.removeUserFromRoom = exports.addUserToRoom = void 0;
const redis_1 = __importDefault(require("../lib/redis"));
const playlist_1 = require("./playlist");
const ROOM_USERS_KEY = (roomId) => `room:users:${roomId}`;
const addUserToRoom = (roomId, userId) => __awaiter(void 0, void 0, void 0, function* () {
    // SADD is idempotent. If the user is already in the set, it does nothing.
    yield redis_1.default.sadd(ROOM_USERS_KEY(roomId), userId);
    console.log(`User ${userId} added to Redis set for room ${roomId}`);
});
exports.addUserToRoom = addUserToRoom;
const removeUserFromRoom = (roomId, userId) => __awaiter(void 0, void 0, void 0, function* () {
    yield redis_1.default.srem(ROOM_USERS_KEY(roomId), userId);
    console.log(`User ${userId} removed from Redis set for room ${roomId}`);
});
exports.removeUserFromRoom = removeUserFromRoom;
const getRoomUsers = (roomId) => __awaiter(void 0, void 0, void 0, function* () {
    // Returns an array of userIds in the room
    const userIds = yield redis_1.default.smembers(ROOM_USERS_KEY(roomId));
    return userIds;
});
exports.getRoomUsers = getRoomUsers;
const playNextSong = (roomId, io) => __awaiter(void 0, void 0, void 0, function* () {
    // Pop the next song (lowest score) from the playlist
    const popped = yield redis_1.default.zpopmin((0, playlist_1.PLAYLIST_KEY)(roomId), 1);
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
    }
    catch (e) {
        song = null;
    }
    // Broadcast the new song to the room
    io.to(roomId).emit('playNewSong', song);
});
exports.playNextSong = playNextSong;
