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
const playNextSong_1 = require("../services/playNextSong");
const redis_1 = __importDefault(require("../lib/redis"));
const playlist_1 = require("../controllers/playlist");
// Mock the current time for consistent testing
const mockTimestamp = 1704110400000; // 2024-01-01T12:00:00.000Z
jest.mock('../controllers/playlist');
describe('Playback Service Comprehensive Scenarios', () => {
    let mockIo;
    const roomId = 'test-room-comp-123';
    const mockSong1 = { id: 'song1', title: 'Test Song 1' };
    const mockSong2 = { id: 'song2', title: 'Test Song 2' };
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(Date, 'now').mockReturnValue(mockTimestamp);
        mockIo = {
            to: jest.fn().mockReturnThis(),
            emit: jest.fn(),
        };
        playlist_1.getPlaylist.mockResolvedValue([]); // Default empty playlist
        playlist_1.getNextSong.mockResolvedValue(mockSong1);
        redis_1.default.hgetall.mockResolvedValue({}); // Default empty room state
    });
    afterEach(() => {
        jest.restoreAllMocks();
    });
    it('should play a song, then pause, then resume, maintaining correct timeline', () => __awaiter(void 0, void 0, void 0, function* () {
        // 1. Play a song
        yield (0, playNextSong_1.playNextSong)(mockIo, roomId);
        expect(redis_1.default.hset).toHaveBeenCalledWith((0, playNextSong_1.ROOM_STATE_KEY)(roomId), expect.objectContaining({
            currentSong: JSON.stringify(mockSong1),
            isPlaying: 'true',
            playbackStartUtc: mockTimestamp.toString(),
        }));
        expect(mockIo.emit).toHaveBeenCalledWith('playNewSong', expect.objectContaining({
            song: mockSong1,
            isPlaying: true,
            playbackStartUtc: mockTimestamp,
        }));
        // Simulate time passing
        const pauseTime = mockTimestamp + 30000; // 30 seconds into song
        jest.spyOn(Date, 'now').mockReturnValue(pauseTime);
        // Mock state for pausePlayback
        redis_1.default.hgetall.mockResolvedValue({
            currentSong: JSON.stringify(mockSong1),
            isPlaying: 'true',
            playbackStartUtc: mockTimestamp.toString(),
        });
        // 2. Pause playback
        yield (0, playNextSong_1.pausePlayback)(mockIo, roomId);
        const expectedPausedVirtualStartUtc = pauseTime - 30000; // 30 seconds into song
        expect(redis_1.default.hset).toHaveBeenCalledWith((0, playNextSong_1.ROOM_STATE_KEY)(roomId), expect.objectContaining({
            isPlaying: 'false',
            playbackStartUtc: expectedPausedVirtualStartUtc.toString(),
        }));
        expect(mockIo.emit).toHaveBeenCalledWith('playbackStateChanged', { isPlaying: false });
        // Simulate more time passing during pause
        const resumeTime = pauseTime + 10000; // 10 seconds paused
        jest.spyOn(Date, 'now').mockReturnValue(resumeTime);
        // Mock state for resumePlayback
        redis_1.default.hgetall.mockResolvedValue({
            currentSong: JSON.stringify(mockSong1),
            isPlaying: 'false',
            playbackStartUtc: expectedPausedVirtualStartUtc.toString(),
        });
        // 3. Resume playback
        yield (0, playNextSong_1.resumePlayback)(mockIo, roomId);
        const expectedResumedPlaybackStartUtc = expectedPausedVirtualStartUtc; // Should be the same as paused virtual start
        expect(redis_1.default.hset).toHaveBeenCalledWith((0, playNextSong_1.ROOM_STATE_KEY)(roomId), expect.objectContaining({
            isPlaying: 'true',
            playbackStartUtc: expectedResumedPlaybackStartUtc.toString(),
        }));
        expect(mockIo.emit).toHaveBeenCalledWith('playbackStateChanged', expect.objectContaining({
            isPlaying: true,
            playbackStartUtc: expectedResumedPlaybackStartUtc,
        }));
        // Verify final position after resume
        const finalPosition = resumeTime - expectedResumedPlaybackStartUtc;
        expect(finalPosition).toBe(40000); // 30s played + 10s paused = 40s total elapsed time in song
    }));
    it('should play a song, then seek, then play next song', () => __awaiter(void 0, void 0, void 0, function* () {
        // 1. Play a song
        yield (0, playNextSong_1.playNextSong)(mockIo, roomId);
        expect(redis_1.default.hset).toHaveBeenCalledWith((0, playNextSong_1.ROOM_STATE_KEY)(roomId), expect.objectContaining({
            currentSong: JSON.stringify(mockSong1),
            isPlaying: 'true',
            playbackStartUtc: mockTimestamp.toString(),
        }));
        // Simulate time passing
        const seekTime = mockTimestamp + 20000; // 20 seconds into song
        jest.spyOn(Date, 'now').mockReturnValue(seekTime);
        // Mock state for seekPlayback
        redis_1.default.hgetall.mockResolvedValue({
            currentSong: JSON.stringify(mockSong1),
            isPlaying: 'true',
            playbackStartUtc: mockTimestamp.toString(),
        });
        // 2. Seek playback to 10 seconds
        const seekToMs = 10000;
        yield (0, playNextSong_1.seekPlayback)(mockIo, roomId, seekToMs);
        const expectedSeekPlaybackStartUtc = seekTime - seekToMs;
        expect(redis_1.default.hset).toHaveBeenCalledWith((0, playNextSong_1.ROOM_STATE_KEY)(roomId), expect.objectContaining({
            isPlaying: 'true',
            playbackStartUtc: expectedSeekPlaybackStartUtc.toString(),
        }));
        expect(mockIo.emit).toHaveBeenCalledWith('playbackStateChanged', expect.objectContaining({
            isPlaying: true,
            playbackStartUtc: expectedSeekPlaybackStartUtc,
        }));
        // 3. Play next song
        jest.clearAllMocks(); // Clear mocks to check new calls
        jest.spyOn(Date, 'now').mockReturnValue(seekTime + 5000); // Simulate a bit more time
        playlist_1.getNextSong.mockResolvedValue(mockSong2);
        redis_1.default.hgetall.mockResolvedValue({
            currentSong: JSON.stringify(mockSong1),
            isPlaying: 'true',
            playbackStartUtc: expectedSeekPlaybackStartUtc.toString(),
        });
        yield (0, playNextSong_1.playNextSong)(mockIo, roomId);
        const newSongPlaybackStartUtc = seekTime + 5000;
        expect(redis_1.default.hset).toHaveBeenCalledWith((0, playNextSong_1.ROOM_STATE_KEY)(roomId), expect.objectContaining({
            currentSong: JSON.stringify(mockSong2),
            isPlaying: 'true',
            playbackStartUtc: newSongPlaybackStartUtc.toString(),
        }));
        expect(mockIo.emit).toHaveBeenCalledWith('playNewSong', expect.objectContaining({
            song: mockSong2,
            isPlaying: true,
            playbackStartUtc: newSongPlaybackStartUtc,
        }));
    }));
    it('should handle pause, seek, then resume correctly', () => __awaiter(void 0, void 0, void 0, function* () {
        // Initial state: song playing from mockTimestamp
        redis_1.default.hgetall.mockResolvedValue({
            currentSong: JSON.stringify(mockSong1),
            isPlaying: 'true',
            playbackStartUtc: mockTimestamp.toString(),
        });
        // 1. Pause after 30 seconds
        const pauseTime = mockTimestamp + 30000;
        jest.spyOn(Date, 'now').mockReturnValue(pauseTime);
        yield (0, playNextSong_1.pausePlayback)(mockIo, roomId);
        const pausedVirtualStartUtc = pauseTime - 30000;
        expect(redis_1.default.hset).toHaveBeenCalledWith((0, playNextSong_1.ROOM_STATE_KEY)(roomId), expect.objectContaining({
            isPlaying: 'false',
            playbackStartUtc: pausedVirtualStartUtc.toString(),
        }));
        // 2. Seek while paused to 10 seconds into the song
        const seekTime = pauseTime + 5000; // 5 seconds later, still paused
        jest.spyOn(Date, 'now').mockReturnValue(seekTime);
        redis_1.default.hgetall.mockResolvedValue({
            currentSong: JSON.stringify(mockSong1),
            isPlaying: 'false',
            playbackStartUtc: pausedVirtualStartUtc.toString(),
        });
        const seekToMs = 10000;
        yield (0, playNextSong_1.seekPlayback)(mockIo, roomId, seekToMs);
        // When seeking while paused, it should set isPlaying to true and update playbackStartUtc
        const expectedSeekPlaybackStartUtc = seekTime - seekToMs;
        expect(redis_1.default.hset).toHaveBeenCalledWith((0, playNextSong_1.ROOM_STATE_KEY)(roomId), expect.objectContaining({
            isPlaying: 'true',
            playbackStartUtc: expectedSeekPlaybackStartUtc.toString(),
        }));
        // 3. Resume (which should now be playing from the seeked position)
        jest.clearAllMocks(); // Clear hset calls from seekPlayback
        const resumeTime = seekTime + 2000; // 2 seconds later, now playing
        jest.spyOn(Date, 'now').mockReturnValue(resumeTime);
        redis_1.default.hgetall.mockResolvedValue({
            currentSong: JSON.stringify(mockSong1),
            isPlaying: 'true', // It was set to true by seek
            playbackStartUtc: expectedSeekPlaybackStartUtc.toString(),
        });
        yield (0, playNextSong_1.resumePlayback)(mockIo, roomId);
        // Resume should not change playbackStartUtc if already playing
        expect(redis_1.default.hset).not.toHaveBeenCalled();
        // Verify the current position is correct after all operations
        const finalPosition = resumeTime - expectedSeekPlaybackStartUtc;
        expect(finalPosition).toBe(12000); // 10s (seek) + 2s (after seek) = 12s
    }));
});
