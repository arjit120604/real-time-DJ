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
exports.playNextSong = exports.ROOM_STATE_KEY = void 0;
const playlist_1 = require("../controllers/playlist");
const redis_1 = __importDefault(require("../lib/redis"));
const ROOM_STATE_KEY = (roomId) => `room:state:${roomId}`;
exports.ROOM_STATE_KEY = ROOM_STATE_KEY;
const playNextSong = (io, roomId) => __awaiter(void 0, void 0, void 0, function* () {
    console.log(`Playing next song for room ${roomId}`);
    // 1. Get the next song from the playlist
    const song = yield (0, playlist_1.getNextSong)(roomId);
    console.log('Next song from queue:', song);
    if (song) {
        // 2. Capture the server's authoritative start time
        const playbackStartUtc = Date.now();
        // 3. Update the room's state in Redis
        yield redis_1.default.hset((0, exports.ROOM_STATE_KEY)(roomId), {
            currentSong: JSON.stringify(song),
            playbackStartUtc: playbackStartUtc.toString(),
        });
        console.log(`Broadcasting playNewSong event for room ${roomId}:`, { song, playbackStartUtc });
        // 4. Broadcast the 'playNewSong' event to the room
        io.to(roomId).emit('playNewSong', {
            song,
            playbackStartUtc,
        });
    }
    else {
        console.log(`No songs available in queue for room ${roomId}`);
        // If no song is available, clear the current song state
        yield redis_1.default.hdel((0, exports.ROOM_STATE_KEY)(roomId), 'currentSong', 'playbackStartUtc');
        io.to(roomId).emit('noSongAvailable');
    }
});
exports.playNextSong = playNextSong;
