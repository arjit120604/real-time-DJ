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
exports.getNextSong = exports.getPlaylist = exports.voteForSong = exports.addSongToPlaylist = exports.PLAYLIST_KEY = void 0;
const redis_1 = __importDefault(require("../lib/redis"));
const youtube_1 = require("../lib/youtube");
const PLAYLIST_KEY = (roomId) => `room:playlist:${roomId}`;
exports.PLAYLIST_KEY = PLAYLIST_KEY;
const addSongToPlaylist = (roomId, videoId) => __awaiter(void 0, void 0, void 0, function* () {
    // 1. Fetch details from YouTube to ensure data is valid
    const songDetails = yield (0, youtube_1.getYouTubeVideoDetails)(videoId);
    if (!songDetails) {
        throw new Error('Invalid YouTube video ID or video not found.');
    }
    const song = {
        id: songDetails.id,
        title: songDetails.title,
        durationMs: songDetails.durationMs,
        thumbnailUrl: songDetails.thumbnailUrl
    };
    // 2. Store song details in the songs hash
    yield redis_1.default.hset('songs', song.id, JSON.stringify(song));
    // 3. Add the song to the Redis Sorted Set with an initial score of 0
    yield redis_1.default.zadd((0, exports.PLAYLIST_KEY)(roomId), 0, song.id);
    console.log("done");
    return song;
});
exports.addSongToPlaylist = addSongToPlaylist;
const voteForSong = (roomId, songId, vote) => __awaiter(void 0, void 0, void 0, function* () {
    // This is tricky. You can't just increment by songId, because the songId is inside the JSON.
    // A common pattern is to find the member, remove it, update score, and re-add it.
    // OR, a better way, is to make the member string predictable.
    // Let's change the value to be `songId:songJSON`
    // For now, let's keep it simple and assume a helper function exists.
    // Let's refine the ZADD value.
    // Instead of just JSON, let's use a unique identifier. The value will be the JSON string.
    // This is a bit complex. A simpler way: The 'member' of the sorted set IS the song's unique ID.
    // But then how do we store the title? We need a second hash.
    // Let's stick to the simplest pattern: the member is the JSON string. Finding it to update votes is slow.
    // REVISED, BETTER PATTERN:
    // The member of the sorted set is JUST the `songId`.
    // We also store song details in a separate Redis Hash.
    // `HSET songs <songId> <songJSON>`
    // This is much more efficient.
    // For now, let's just do the increment, assuming we can find the member.
    // This is a good example of where a simple approach has performance issues later.
    // We will refine this. For now, let's imagine this works:
    yield redis_1.default.zincrby((0, exports.PLAYLIST_KEY)(roomId), vote, songId);
    // We will implement the correct version in the next step.
});
exports.voteForSong = voteForSong;
const getPlaylist = (roomId) => __awaiter(void 0, void 0, void 0, function* () {
    // ZRANGE gets members, WITHSCORES gets their scores too.
    const playlistData = yield redis_1.default.zrange((0, exports.PLAYLIST_KEY)(roomId), 0, -1, 'WITHSCORES');
    // Logic to parse this data and return an array of Song objects with scores.
    const songs = [];
    console.log(playlistData);
    // 2. Parse the zrange result
    for (let i = 0; i < playlistData.length; i += 2) {
        const songId = playlistData[i];
        const score = Number(playlistData[i + 1]);
        // 3. Fetch song details from hash
        const songJson = yield redis_1.default.hget('songs', songId);
        if (songJson) {
            const song = JSON.parse(songJson);
            songs.push(Object.assign(Object.assign({}, song), { score }));
        }
    }
    console.log(songs);
    return songs;
});
exports.getPlaylist = getPlaylist;
const getNextSong = (roomId) => __awaiter(void 0, void 0, void 0, function* () {
    const popped = yield redis_1.default.zpopmax((0, exports.PLAYLIST_KEY)(roomId));
    if (!popped || popped.length < 2)
        return null;
    const songId = popped[0];
    const score = Number(popped[1]);
    // 2. Fetch song details from hash
    const songJson = yield redis_1.default.hget('songs', songId);
    if (!songJson)
        return null;
    const song = JSON.parse(songJson);
    return Object.assign(Object.assign({}, song), { score });
});
exports.getNextSong = getNextSong;
