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
describe('playNextSong', () => {
    let mockIo;
    const roomId = 'test-room-123';
    const mockSong = { id: 'song1', title: 'Test Song', artist: 'Test Artist' };
    const mockPlaylist = [{ id: 'song2', title: 'Next Song' }];
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(Date, 'now').mockReturnValue(mockTimestamp);
        mockIo = {
            to: jest.fn().mockReturnThis(),
            emit: jest.fn(),
        };
        playlist_1.getPlaylist.mockResolvedValue(mockPlaylist);
    });
    afterEach(() => {
        jest.restoreAllMocks();
    });
    it('should play the next song if available', () => __awaiter(void 0, void 0, void 0, function* () {
        playlist_1.getNextSong.mockResolvedValue(mockSong);
        yield (0, playNextSong_1.playNextSong)(mockIo, roomId);
        expect(playlist_1.getNextSong).toHaveBeenCalledWith(roomId);
        expect(redis_1.default.hset).toHaveBeenCalledWith((0, playNextSong_1.ROOM_STATE_KEY)(roomId), {
            currentSong: JSON.stringify(mockSong),
            playbackStartUtc: mockTimestamp.toString(),
            isPlaying: 'true',
        });
        expect(redis_1.default.hdel).toHaveBeenCalledWith((0, playNextSong_1.ROOM_STATE_KEY)(roomId), ...playNextSong_1.DEPRECATED_FIELDS);
        expect(mockIo.to).toHaveBeenCalledWith(roomId);
        expect(mockIo.emit).toHaveBeenCalledWith('playNewSong', {
            song: mockSong,
            isPlaying: true,
            playbackStartUtc: mockTimestamp,
        });
        expect(playlist_1.getPlaylist).toHaveBeenCalledWith(roomId);
        expect(mockIo.emit).toHaveBeenCalledWith('playlistUpdated', mockPlaylist);
    }));
    it('should clear state and emit noSongAvailable if no song is available', () => __awaiter(void 0, void 0, void 0, function* () {
        playlist_1.getNextSong.mockResolvedValue(null);
        yield (0, playNextSong_1.playNextSong)(mockIo, roomId);
        expect(playlist_1.getNextSong).toHaveBeenCalledWith(roomId);
        expect(redis_1.default.hset).not.toHaveBeenCalled();
        expect(redis_1.default.hdel).toHaveBeenCalledWith((0, playNextSong_1.ROOM_STATE_KEY)(roomId), 'currentSong', 'playbackStartUtc', 'isPlaying', ...playNextSong_1.DEPRECATED_FIELDS);
        expect(mockIo.to).toHaveBeenCalledWith(roomId);
        expect(mockIo.emit).toHaveBeenCalledWith('noSongAvailable');
        expect(playlist_1.getPlaylist).not.toHaveBeenCalled(); // No playlist update if no song
    }));
    it('should handle Redis errors gracefully', () => __awaiter(void 0, void 0, void 0, function* () {
        playlist_1.getNextSong.mockResolvedValue(mockSong);
        redis_1.default.hset.mockRejectedValue(new Error('Redis connection failed'));
        yield expect((0, playNextSong_1.playNextSong)(mockIo, roomId)).rejects.toThrow('Redis connection failed');
        expect(mockIo.emit).not.toHaveBeenCalled(); // No events should be emitted on error
    }));
    it('should handle errors from getNextSong', () => __awaiter(void 0, void 0, void 0, function* () {
        playlist_1.getNextSong.mockRejectedValue(new Error('Failed to get next song'));
        yield expect((0, playNextSong_1.playNextSong)(mockIo, roomId)).rejects.toThrow('Failed to get next song');
        expect(redis_1.default.hset).not.toHaveBeenCalled();
        expect(mockIo.emit).not.toHaveBeenCalled();
    }));
    it('should handle errors from getPlaylist', () => __awaiter(void 0, void 0, void 0, function* () {
        playlist_1.getNextSong.mockResolvedValue(mockSong);
        // Ensure hset does not reject for this test
        redis_1.default.hset.mockResolvedValue(1);
        playlist_1.getPlaylist.mockRejectedValue(new Error('Failed to get playlist'));
        yield expect((0, playNextSong_1.playNextSong)(mockIo, roomId)).rejects.toThrow('Failed to get playlist');
        // Still expect playNewSong to be emitted as it happens before playlist update
        expect(mockIo.emit).toHaveBeenCalledWith('playNewSong', expect.any(Object));
    }));
});
