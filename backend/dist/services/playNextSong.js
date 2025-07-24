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
exports.togglePlayPause = exports.getRoomState = exports.cleanupAllRooms = exports.cleanupDeprecatedFields = exports.seekPlayback = exports.resumePlayback = exports.pausePlayback = exports.playNextSong = exports.DEPRECATED_FIELDS = exports.ROOM_STATE_KEY = void 0;
const playlist_1 = require("../controllers/playlist");
const redis_1 = __importDefault(require("../lib/redis"));
const ROOM_STATE_KEY = (roomId) => `room:state:${roomId}`;
exports.ROOM_STATE_KEY = ROOM_STATE_KEY;
// Deprecated fields that should be cleaned up
exports.DEPRECATED_FIELDS = ['pausedAt', 'pauseOffsetMs', 'pauseStartTime'];
const playNextSong = (io, roomId) => __awaiter(void 0, void 0, void 0, function* () {
    console.log(`Playing next song for room ${roomId}`);
    // 1. Get the next song from the playlist (this removes it from the queue)
    const song = yield (0, playlist_1.getNextSong)(roomId);
    console.log('Next song from queue:', song);
    if (song) {
        // 2. Capture the server's authoritative start time
        const playbackStartUtc = Date.now();
        // 3. Update the room's state in Redis (clear any old pause state)
        yield redis_1.default.hset((0, exports.ROOM_STATE_KEY)(roomId), {
            currentSong: JSON.stringify(song),
            playbackStartUtc: playbackStartUtc.toString(),
            isPlaying: 'true',
        });
        // Clean up any deprecated fields
        yield redis_1.default.hdel((0, exports.ROOM_STATE_KEY)(roomId), ...exports.DEPRECATED_FIELDS);
        console.log(`Broadcasting playNewSong event for room ${roomId}:`, { song, playbackStartUtc });
        // 4. Broadcast the 'playNewSong' event to the room
        io.to(roomId).emit('playNewSong', {
            song,
            isPlaying: true,
            playbackStartUtc, // Send the absolute timestamp
        });
        // 5. Send updated playlist since a song was removed from the queue
        const updatedPlaylist = yield (0, playlist_1.getPlaylist)(roomId);
        io.to(roomId).emit('playlistUpdated', updatedPlaylist);
    }
    else {
        console.log(`No songs available in queue for room ${roomId}`);
        // If no song is available, clear all current song state including deprecated fields
        yield redis_1.default.hdel((0, exports.ROOM_STATE_KEY)(roomId), 'currentSong', 'playbackStartUtc', 'isPlaying', ...exports.DEPRECATED_FIELDS);
        io.to(roomId).emit('noSongAvailable');
    }
});
exports.playNextSong = playNextSong;
const pausePlayback = (io, roomId) => __awaiter(void 0, void 0, void 0, function* () {
    const currentState = yield redis_1.default.hgetall((0, exports.ROOM_STATE_KEY)(roomId));
    if (currentState.currentSong && currentState.isPlaying === 'true') {
        // Calculate the current song position at the time of pause
        const originalPlaybackStartUtc = parseInt(currentState.playbackStartUtc, 10);
        const songPositionMs = Date.now() - originalPlaybackStartUtc;
        // Create a virtual start time that represents the "frozen" timeline
        // This virtual start time preserves the song position for when we resume
        const pausedVirtualStartUtc = Date.now() - songPositionMs;
        yield redis_1.default.hset((0, exports.ROOM_STATE_KEY)(roomId), {
            isPlaying: 'false',
            playbackStartUtc: pausedVirtualStartUtc.toString(), // Store the frozen timeline
        });
        // Clean up any deprecated fields that might exist
        yield redis_1.default.hdel((0, exports.ROOM_STATE_KEY)(roomId), ...exports.DEPRECATED_FIELDS);
        console.log(`Broadcasting playbackStateChanged for room ${roomId} (pausing):`, {
            isPlaying: false,
        });
        // Broadcast the new state to all clients - simple, just the playing state
        io.to(roomId).emit('playbackStateChanged', {
            isPlaying: false,
        });
    }
});
exports.pausePlayback = pausePlayback;
const resumePlayback = (io, roomId) => __awaiter(void 0, void 0, void 0, function* () {
    const currentState = yield redis_1.default.hgetall((0, exports.ROOM_STATE_KEY)(roomId));
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
        yield redis_1.default.hset((0, exports.ROOM_STATE_KEY)(roomId), {
            isPlaying: 'true',
            playbackStartUtc: newPlaybackStartUtc.toString(),
        });
        // Clean up any deprecated fields that might exist
        yield redis_1.default.hdel((0, exports.ROOM_STATE_KEY)(roomId), ...exports.DEPRECATED_FIELDS);
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
});
exports.resumePlayback = resumePlayback;
const seekPlayback = (io, roomId, seekToMs) => __awaiter(void 0, void 0, void 0, function* () {
    const currentState = yield redis_1.default.hgetall((0, exports.ROOM_STATE_KEY)(roomId));
    if (currentState.currentSong) {
        // Ensure seekToMs is a valid number and clamp to reasonable bounds
        const clampedSeekToMs = Math.max(0, Math.floor(seekToMs));
        // Calculate new virtual playbackStartUtc based on seek position
        // Goal: (Date.now() - newPlaybackStartUtc) equals the seekToMs
        const newPlaybackStartUtc = Date.now() - clampedSeekToMs;
        // Update the room's state in Redis
        yield redis_1.default.hset((0, exports.ROOM_STATE_KEY)(roomId), {
            playbackStartUtc: newPlaybackStartUtc.toString(),
            isPlaying: 'true', // Seeking implies playback should be active
        });
        // Clean up any deprecated fields that might exist
        yield redis_1.default.hdel((0, exports.ROOM_STATE_KEY)(roomId), ...exports.DEPRECATED_FIELDS);
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
});
exports.seekPlayback = seekPlayback;
/**
 * Utility function to clean up deprecated fields from an existing room
 * This ensures that the room in Redis follows the minimal state approach (requirement 4.1, 4.2, 4.4)
 */
const cleanupDeprecatedFields = (roomId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Check if any deprecated fields exist before attempting to delete
        const roomState = yield redis_1.default.hgetall((0, exports.ROOM_STATE_KEY)(roomId));
        const fieldsToDelete = exports.DEPRECATED_FIELDS.filter(field => field in roomState);
        if (fieldsToDelete.length > 0) {
            const deletedCount = yield redis_1.default.hdel((0, exports.ROOM_STATE_KEY)(roomId), ...fieldsToDelete);
            if (deletedCount > 0) {
                console.log(`Cleaned up ${deletedCount} deprecated fields from room ${roomId}`);
            }
        }
    }
    catch (error) {
        console.error(`Error cleaning up deprecated fields for room ${roomId}:`, error);
    }
});
exports.cleanupDeprecatedFields = cleanupDeprecatedFields;
/**
 * Utility function to clean up deprecated fields for all existing rooms
 * This can be called during server startup or as a maintenance task
 * to ensure all rooms follow the minimal state approach (requirement 4.4)
 */
const cleanupAllRooms = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Get all room state keys from Redis
        const keys = yield redis_1.default.keys('room:state:*');
        console.log(`Found ${keys.length} room state keys to check for cleanup`);
        // Process each room
        for (const key of keys) {
            const roomId = key.replace('room:state:', '');
            yield (0, exports.cleanupDeprecatedFields)(roomId);
        }
        console.log(`Completed cleanup check for all ${keys.length} rooms`);
    }
    catch (error) {
        console.error('Error cleaning up all rooms:', error);
    }
});
exports.cleanupAllRooms = cleanupAllRooms;
// Utility function to get current room state with proper typing
const getRoomState = (roomId) => __awaiter(void 0, void 0, void 0, function* () {
    return yield redis_1.default.hgetall((0, exports.ROOM_STATE_KEY)(roomId));
});
exports.getRoomState = getRoomState;
/**
 * Legacy function for backward compatibility - will be removed once frontend is updated
 * This is marked as deprecated and should be removed in future updates
 * @deprecated Use pausePlayback and resumePlayback instead
 */
const togglePlayPause = (io, roomId, isPlaying) => __awaiter(void 0, void 0, void 0, function* () {
    if (isPlaying) {
        yield (0, exports.resumePlayback)(io, roomId);
    }
    else {
        yield (0, exports.pausePlayback)(io, roomId);
    }
});
exports.togglePlayPause = togglePlayPause;
