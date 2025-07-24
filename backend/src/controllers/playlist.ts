import redis from "../lib/redis";
import { getYouTubeVideoDetails } from "../lib/youtube"


export interface Song {
    id: string;
    title: string;
    durationMs: number;
    thumbnailUrl: string;
    author: string;
    addedBy: string
}

export const PLAYLIST_KEY = (roomId: string) => `room:playlist:${roomId}`;


export const addSongToPlaylist = async (roomId: string, videoId: string, username: string): Promise<Song> => {
    // 1. Fetch details from YouTube to ensure data is valid
    const songDetails = await getYouTubeVideoDetails(videoId);
    if (!songDetails) {
        throw new Error('Invalid YouTube video ID or video not found.');
    }

    const song: Song = {
        id: songDetails.id,
        title: songDetails.title,
        durationMs: songDetails.durationMs,
        thumbnailUrl: songDetails.thumbnailUrl,
        author: songDetails.author,
        addedBy: username
    };

    // 2. Store song details in the songs hash
    await redis.hset('songs', song.id, JSON.stringify(song));

    // 3. Add the song to the Redis Sorted Set with an initial score of 0
    await redis.zadd(PLAYLIST_KEY(roomId), 0, song.id);
    console.log("done");
    return song;
};


export const voteForSong = async (roomId: string, songId: string, vote: 1 | -1): Promise<void> => {
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
    await redis.zincrby(PLAYLIST_KEY(roomId), vote, songId);
    // We will implement the correct version in the next step.
};

export interface SongWithScore extends Song {
    score: number;
}

export const getPlaylist = async (roomId: string): Promise<Song[]> => {
    // ZRANGE gets members, WITHSCORES gets their scores too.
    const playlistData = await redis.zrange(PLAYLIST_KEY(roomId), 0, -1, 'WITHSCORES');
    // Logic to parse this data and return an array of Song objects with scores.
    const songs: SongWithScore[] = [];

    console.log(playlistData);
    // 2. Parse the zrange result
    for (let i = 0; i < playlistData.length; i += 2) {
        const songId = playlistData[i];
        const score = Number(playlistData[i + 1]);
        // 3. Fetch song details from hash
        const songJson = await redis.hget('songs', songId);
        if (songJson) {
            const song: Song = JSON.parse(songJson);
            songs.push({ ...song, score });
        }
    }
    console.log(songs);
    return songs;
}
export const getNextSong = async (roomId: string) => {
    const popped = await redis.zpopmax(PLAYLIST_KEY(roomId));
    if (!popped || popped.length < 2) return null;

    const songId = popped[0];
    const score = Number(popped[1]);
    // 2. Fetch song details from hash
    const songJson = await redis.hget('songs', songId);
    if (!songJson) return null;

    const song = JSON.parse(songJson);
    return { ...song, score };
}