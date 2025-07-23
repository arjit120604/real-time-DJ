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
exports.registerRoomHandlers = void 0;
const socketActions_1 = require("../controllers/socketActions");
const playlist_1 = require("../controllers/playlist");
const rooms_1 = require("../controllers/rooms");
const playNextSong_1 = require("../services/playNextSong");
const redis_1 = __importDefault(require("../lib/redis"));
// A map to store room and user info for each socket.
// For a scalable application, you'd use Redis for this.
const socketContext = new Map();
const registerRoomHandlers = (io, socket) => {
    const handleError = (handlerName, error) => {
        console.error(`Error in ${handlerName}:`, error);
        const message = error instanceof Error ? error.message : 'An unknown error occurred.';
        socket.emit('error', { message });
    };
    socket.on('joinRoom', (payload) => __awaiter(void 0, void 0, void 0, function* () {
        const { roomId, userId, username } = payload;
        if (!roomId || !userId) {
            return socket.emit('error', { message: 'Room ID and User ID are required.' });
        }
        try {
            socket.join(roomId);
            socketContext.set(socket.id, { roomId, userId });
            // Store user info with username in Redis
            const userInfo = { id: userId, username: username || `User-${userId.substring(0, 8)}` };
            yield redis_1.default.hset(`room:${roomId}:users`, userId, JSON.stringify(userInfo));
            yield (0, socketActions_1.addUserToRoom)(roomId, userId);
            socket.broadcast.to(roomId).emit('userJoined', { userId, username: userInfo.username });
            const [playlist, userIds, currentSongState] = yield Promise.all([
                (0, playlist_1.getPlaylist)(roomId),
                (0, socketActions_1.getRoomUsers)(roomId),
                redis_1.default.hgetall((0, playNextSong_1.ROOM_STATE_KEY)(roomId)),
            ]);
            // Get user details for all connected users
            const users = [];
            for (const id of userIds) {
                const userDataStr = yield redis_1.default.hget(`room:${roomId}:users`, id);
                if (userDataStr) {
                    users.push(JSON.parse(userDataStr));
                }
                else {
                    users.push({ id, username: `User-${id.substring(0, 8)}` });
                }
            }
            const roomState = { playlist, users };
            if (currentSongState && currentSongState.currentSong) {
                roomState.currentSong = JSON.parse(currentSongState.currentSong);
                roomState.playbackStartUtc = parseInt(currentSongState.playbackStartUtc, 10);
            }
            socket.emit('roomState', roomState);
        }
        catch (error) {
            handleError('joinRoom', error);
        }
    }));
    socket.on('addSong', (payload) => __awaiter(void 0, void 0, void 0, function* () {
        const { roomId, videoId } = payload;
        if (!roomId || !videoId) {
            return socket.emit('error', { message: 'Room ID and Video ID are required.' });
        }
        try {
            yield (0, playlist_1.addSongToPlaylist)(roomId, videoId);
            const playlist = yield (0, playlist_1.getPlaylist)(roomId);
            io.to(roomId).emit('playlistUpdated', playlist);
            // Check if there's currently no song playing and auto-start playback
            const currentlyPlaying = yield redis_1.default.hget((0, playNextSong_1.ROOM_STATE_KEY)(roomId), 'currentSong');
            console.log('Current song state after adding:', currentlyPlaying);
            if (!currentlyPlaying) {
                console.log('No song currently playing, starting auto-play');
                yield (0, playNextSong_1.playNextSong)(io, roomId);
            }
        }
        catch (error) {
            handleError('addSong', error);
        }
    }));
    socket.on('voteSong', (payload) => __awaiter(void 0, void 0, void 0, function* () {
        const { roomId, songId, vote } = payload;
        if (!roomId || !songId || !vote) {
            return socket.emit('error', { message: 'Room ID, Song ID, and vote are required.' });
        }
        try {
            yield (0, playlist_1.voteForSong)(roomId, songId, vote);
            const playlist = yield (0, playlist_1.getPlaylist)(roomId);
            io.to(roomId).emit('playlistUpdated', playlist);
        }
        catch (error) {
            handleError('voteSong', error);
        }
    }));
    socket.on('playNextSong', (payload) => __awaiter(void 0, void 0, void 0, function* () {
        const { roomId } = payload;
        if (!roomId) {
            return socket.emit('error', { message: 'Room ID is required.' });
        }
        try {
            // Potentially add a check here to ensure the user is the host
            yield (0, playNextSong_1.playNextSong)(io, roomId);
        }
        catch (error) {
            handleError('playNextSong', error);
        }
    }));
    socket.on('disconnect', () => __awaiter(void 0, void 0, void 0, function* () {
        const context = socketContext.get(socket.id);
        if (context) {
            const { roomId, userId } = context;
            try {
                yield (0, socketActions_1.removeUserFromRoom)(roomId, userId);
                // Remove user data from room users hash
                yield redis_1.default.hdel(`room:${roomId}:users`, userId);
                const remainingUsers = yield (0, socketActions_1.getRoomUsers)(roomId);
                if (remainingUsers.length === 0) {
                    // If the room is empty, delete it from the database and clean up Redis
                    yield (0, rooms_1.deleteRoom)(roomId);
                    yield redis_1.default.del((0, playlist_1.PLAYLIST_KEY)(roomId));
                    yield redis_1.default.del((0, playNextSong_1.ROOM_STATE_KEY)(roomId));
                    yield redis_1.default.del(`room:${roomId}:users`);
                    console.log(`Cleaned up room ${roomId} as it is now empty.`);
                }
                else {
                    // Otherwise, just notify others that the user has left
                    io.to(roomId).emit('userLeft', { userId });
                    // Get updated user details for remaining users
                    const users = [];
                    for (const id of remainingUsers) {
                        const userDataStr = yield redis_1.default.hget(`room:${roomId}:users`, id);
                        if (userDataStr) {
                            users.push(JSON.parse(userDataStr));
                        }
                        else {
                            users.push({ id, username: `User-${id.substring(0, 8)}` });
                        }
                    }
                    io.to(roomId).emit('usersUpdated', users);
                }
                socketContext.delete(socket.id);
                console.log(`User ${userId} disconnected from room ${roomId}`);
            }
            catch (error) {
                console.error(`Error handling disconnect for user ${userId} in room ${roomId}:`, error);
            }
        }
    }));
};
exports.registerRoomHandlers = registerRoomHandlers;
