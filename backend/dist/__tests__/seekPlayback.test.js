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
// Mock the current time for consistent testing
const mockTimestamp = 1704110400000; // 2024-01-01T12:00:00.000Z
describe('seekPlayback', () => {
    let mockIo;
    const roomId = 'test-room-123';
    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        // Mock Date.now() to return consistent timestamp
        jest.spyOn(Date, 'now').mockReturnValue(mockTimestamp);
        // Create mock Socket.IO server
        mockIo = {
            to: jest.fn().mockReturnThis(),
            emit: jest.fn(),
        };
    });
    afterEach(() => {
        jest.restoreAllMocks();
    });
    describe('basic seeking functionality', () => {
        it('should calculate correct playbackStartUtc for seek position', () => __awaiter(void 0, void 0, void 0, function* () {
            // Arrange
            const seekToMs = 30000; // 30 seconds
            const expectedPlaybackStartUtc = mockTimestamp - seekToMs;
            redis_1.default.hgetall.mockResolvedValue({
                currentSong: JSON.stringify({ id: 'song1', title: 'Test Song' }),
                isPlaying: 'true',
                playbackStartUtc: '1000000000000'
            });
            // Act
            yield (0, playNextSong_1.seekPlayback)(mockIo, roomId, seekToMs);
            // Assert
            expect(redis_1.default.hset).toHaveBeenCalledWith((0, playNextSong_1.ROOM_STATE_KEY)(roomId), {
                playbackStartUtc: expectedPlaybackStartUtc.toString(),
                isPlaying: 'true',
            });
        }));
        it('should broadcast playbackStateChanged event with correct data', () => __awaiter(void 0, void 0, void 0, function* () {
            // Arrange
            const seekToMs = 45000; // 45 seconds
            const expectedPlaybackStartUtc = mockTimestamp - seekToMs;
            redis_1.default.hgetall.mockResolvedValue({
                currentSong: JSON.stringify({ id: 'song1', title: 'Test Song' }),
            });
            // Act
            yield (0, playNextSong_1.seekPlayback)(mockIo, roomId, seekToMs);
            // Assert
            expect(mockIo.to).toHaveBeenCalledWith(roomId);
            expect(mockIo.emit).toHaveBeenCalledWith('playbackStateChanged', {
                isPlaying: true,
                playbackStartUtc: expectedPlaybackStartUtc,
            });
        }));
        it('should clear deprecated fields when seeking', () => __awaiter(void 0, void 0, void 0, function* () {
            // Arrange
            const seekToMs = 60000; // 1 minute
            redis_1.default.hgetall.mockResolvedValue({
                currentSong: JSON.stringify({ id: 'song1', title: 'Test Song' }),
                pauseOffsetMs: '15000', // Should be cleared
                pausedAt: '1000000000000', // Should be cleared
                pauseStartTime: '1000000000000', // Should be cleared
            });
            // Act
            yield (0, playNextSong_1.seekPlayback)(mockIo, roomId, seekToMs);
            // Assert
            expect(redis_1.default.hdel).toHaveBeenCalledWith((0, playNextSong_1.ROOM_STATE_KEY)(roomId), ...playNextSong_1.DEPRECATED_FIELDS);
        }));
        it('should set isPlaying to true when seeking', () => __awaiter(void 0, void 0, void 0, function* () {
            // Arrange
            const seekToMs = 20000; // 20 seconds
            redis_1.default.hgetall.mockResolvedValue({
                currentSong: JSON.stringify({ id: 'song1', title: 'Test Song' }),
                isPlaying: 'false', // Currently paused
            });
            // Act
            yield (0, playNextSong_1.seekPlayback)(mockIo, roomId, seekToMs);
            // Assert
            expect(redis_1.default.hset).toHaveBeenCalledWith((0, playNextSong_1.ROOM_STATE_KEY)(roomId), expect.objectContaining({
                isPlaying: 'true',
            }));
        }));
    });
    describe('edge cases', () => {
        it('should handle seek to beginning of song (0ms)', () => __awaiter(void 0, void 0, void 0, function* () {
            // Arrange
            const seekToMs = 0;
            const expectedPlaybackStartUtc = mockTimestamp; // No offset
            redis_1.default.hgetall.mockResolvedValue({
                currentSong: JSON.stringify({ id: 'song1', title: 'Test Song' }),
            });
            // Act
            yield (0, playNextSong_1.seekPlayback)(mockIo, roomId, seekToMs);
            // Assert
            expect(redis_1.default.hset).toHaveBeenCalledWith((0, playNextSong_1.ROOM_STATE_KEY)(roomId), expect.objectContaining({
                playbackStartUtc: expectedPlaybackStartUtc.toString(),
            }));
        }));
        it('should handle large seek positions', () => __awaiter(void 0, void 0, void 0, function* () {
            // Arrange
            const seekToMs = 300000; // 5 minutes
            const expectedPlaybackStartUtc = mockTimestamp - seekToMs;
            redis_1.default.hgetall.mockResolvedValue({
                currentSong: JSON.stringify({ id: 'song1', title: 'Test Song' }),
            });
            // Act
            yield (0, playNextSong_1.seekPlayback)(mockIo, roomId, seekToMs);
            // Assert
            expect(redis_1.default.hset).toHaveBeenCalledWith((0, playNextSong_1.ROOM_STATE_KEY)(roomId), expect.objectContaining({
                playbackStartUtc: expectedPlaybackStartUtc.toString(),
            }));
        }));
        it('should not perform any operations when no current song exists', () => __awaiter(void 0, void 0, void 0, function* () {
            // Arrange
            const seekToMs = 30000;
            redis_1.default.hgetall.mockResolvedValue({
                // No currentSong field
                isPlaying: 'false',
            });
            // Act
            yield (0, playNextSong_1.seekPlayback)(mockIo, roomId, seekToMs);
            // Assert
            expect(redis_1.default.hset).not.toHaveBeenCalled();
            expect(redis_1.default.hdel).not.toHaveBeenCalled();
            expect(mockIo.emit).not.toHaveBeenCalled();
        }));
        it('should handle empty room state', () => __awaiter(void 0, void 0, void 0, function* () {
            // Arrange
            const seekToMs = 30000;
            redis_1.default.hgetall.mockResolvedValue({});
            // Act
            yield (0, playNextSong_1.seekPlayback)(mockIo, roomId, seekToMs);
            // Assert
            expect(redis_1.default.hset).not.toHaveBeenCalled();
            expect(redis_1.default.hdel).not.toHaveBeenCalled();
            expect(mockIo.emit).not.toHaveBeenCalled();
        }));
        it('should clamp negative seek positions to 0', () => __awaiter(void 0, void 0, void 0, function* () {
            // Arrange
            const seekToMs = -5000; // Negative 5 seconds (should be clamped to 0)
            const expectedPlaybackStartUtc = mockTimestamp; // Should be clamped to 0, so no offset
            redis_1.default.hgetall.mockResolvedValue({
                currentSong: JSON.stringify({ id: 'song1', title: 'Test Song' }),
            });
            // Act
            yield (0, playNextSong_1.seekPlayback)(mockIo, roomId, seekToMs);
            // Assert
            expect(redis_1.default.hset).toHaveBeenCalledWith((0, playNextSong_1.ROOM_STATE_KEY)(roomId), expect.objectContaining({
                playbackStartUtc: expectedPlaybackStartUtc.toString(),
            }));
        }));
        it('should handle decimal seek positions by flooring them', () => __awaiter(void 0, void 0, void 0, function* () {
            // Arrange
            const seekToMs = 30500.7; // Should be floored to 30500
            const expectedPlaybackStartUtc = mockTimestamp - 30500;
            redis_1.default.hgetall.mockResolvedValue({
                currentSong: JSON.stringify({ id: 'song1', title: 'Test Song' }),
            });
            // Act
            yield (0, playNextSong_1.seekPlayback)(mockIo, roomId, seekToMs);
            // Assert
            expect(redis_1.default.hset).toHaveBeenCalledWith((0, playNextSong_1.ROOM_STATE_KEY)(roomId), expect.objectContaining({
                playbackStartUtc: expectedPlaybackStartUtc.toString(),
            }));
        }));
    });
    describe('timeline calculation verification', () => {
        it('should ensure seek position calculation is mathematically correct', () => __awaiter(void 0, void 0, void 0, function* () {
            // Arrange
            const seekToMs = 75000; // 1 minute 15 seconds
            redis_1.default.hgetall.mockResolvedValue({
                currentSong: JSON.stringify({ id: 'song1', title: 'Test Song' }),
            });
            // Act
            yield (0, playNextSong_1.seekPlayback)(mockIo, roomId, seekToMs);
            // Assert - Verify the math: (Date.now() - playbackStartUtc) should equal seekToMs
            const setCall = redis_1.default.hset.mock.calls[0];
            const playbackStartUtc = parseInt(setCall[1].playbackStartUtc);
            const calculatedPosition = mockTimestamp - playbackStartUtc;
            expect(calculatedPosition).toBe(seekToMs);
        }));
        it('should maintain timeline consistency across multiple seeks', () => __awaiter(void 0, void 0, void 0, function* () {
            // Arrange
            const firstSeek = 30000;
            const secondSeek = 60000;
            redis_1.default.hgetall.mockResolvedValue({
                currentSong: JSON.stringify({ id: 'song1', title: 'Test Song' }),
            });
            // Act - First seek
            yield (0, playNextSong_1.seekPlayback)(mockIo, roomId, firstSeek);
            const firstCall = redis_1.default.hset.mock.calls[0];
            const firstPlaybackStartUtc = parseInt(firstCall[1].playbackStartUtc);
            // Clear mocks and perform second seek
            jest.clearAllMocks();
            yield (0, playNextSong_1.seekPlayback)(mockIo, roomId, secondSeek);
            const secondCall = redis_1.default.hset.mock.calls[0];
            const secondPlaybackStartUtc = parseInt(secondCall[1].playbackStartUtc);
            // Assert - Both calculations should be mathematically correct
            expect(mockTimestamp - firstPlaybackStartUtc).toBe(firstSeek);
            expect(mockTimestamp - secondPlaybackStartUtc).toBe(secondSeek);
            expect(secondPlaybackStartUtc).toBeLessThan(firstPlaybackStartUtc); // Later in song = earlier start time
        }));
    });
    describe('error handling', () => {
        it('should handle Redis errors gracefully', () => __awaiter(void 0, void 0, void 0, function* () {
            // Arrange
            const seekToMs = 30000;
            redis_1.default.hgetall.mockRejectedValue(new Error('Redis connection failed'));
            // Act & Assert
            yield expect((0, playNextSong_1.seekPlayback)(mockIo, roomId, seekToMs)).rejects.toThrow('Redis connection failed');
        }));
        it('should handle malformed currentSong data', () => __awaiter(void 0, void 0, void 0, function* () {
            // Arrange
            const seekToMs = 30000;
            redis_1.default.hgetall.mockResolvedValue({
                currentSong: 'invalid-json-data',
            });
            // Act - Should not throw, but also should not perform operations
            yield (0, playNextSong_1.seekPlayback)(mockIo, roomId, seekToMs);
            // Assert - Operations should still proceed since we only check for existence of currentSong
            expect(redis_1.default.hset).toHaveBeenCalled();
        }));
    });
});
describe('cleanupDeprecatedFields', () => {
    const roomId = 'test-room-123';
    beforeEach(() => {
        jest.clearAllMocks();
    });
    it('should remove deprecated fields from room state', () => __awaiter(void 0, void 0, void 0, function* () {
        // Arrange
        redis_1.default.hgetall.mockResolvedValue({
            currentSong: JSON.stringify({ id: 'song1', title: 'Test Song' }),
            isPlaying: 'true',
            playbackStartUtc: '1704110370000',
            pauseOffsetMs: '10000', // Deprecated field
            pausedAt: '1704110380000', // Deprecated field
            pauseStartTime: '1704110380000', // Deprecated field
        });
        redis_1.default.hdel.mockResolvedValue(3); // 3 fields deleted
        // Act
        yield (0, playNextSong_1.cleanupDeprecatedFields)(roomId);
        // Assert
        expect(redis_1.default.hdel).toHaveBeenCalledWith((0, playNextSong_1.ROOM_STATE_KEY)(roomId), ...playNextSong_1.DEPRECATED_FIELDS);
    }));
    it('should handle case when no deprecated fields exist', () => __awaiter(void 0, void 0, void 0, function* () {
        // Arrange
        redis_1.default.hgetall.mockResolvedValue({
            currentSong: JSON.stringify({ id: 'song1', title: 'Test Song' }),
            isPlaying: 'true',
            playbackStartUtc: '1704110370000',
            // No deprecated fields
        });
        // Act
        yield (0, playNextSong_1.cleanupDeprecatedFields)(roomId);
        // Assert
        expect(redis_1.default.hdel).not.toHaveBeenCalled();
    }));
    it('should handle Redis errors gracefully', () => __awaiter(void 0, void 0, void 0, function* () {
        // Arrange
        redis_1.default.hgetall.mockResolvedValue({
            currentSong: JSON.stringify({ id: 'song1', title: 'Test Song' }),
            pauseOffsetMs: '10000', // Deprecated field
        });
        redis_1.default.hdel.mockRejectedValue(new Error('Redis connection failed'));
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        // Act
        yield (0, playNextSong_1.cleanupDeprecatedFields)(roomId);
        // Assert
        expect(consoleSpy).toHaveBeenCalledWith(`Error cleaning up deprecated fields for room ${roomId}:`, expect.any(Error));
        consoleSpy.mockRestore();
    }));
});
describe('getRoomState', () => {
    const roomId = 'test-room-123';
    beforeEach(() => {
        jest.clearAllMocks();
    });
    it('should return room state with proper typing', () => __awaiter(void 0, void 0, void 0, function* () {
        // Arrange
        const mockState = {
            currentSong: JSON.stringify({ id: 'song1', title: 'Test Song' }),
            playbackStartUtc: '1704110400000',
            isPlaying: 'true'
        };
        redis_1.default.hgetall.mockResolvedValue(mockState);
        // Act
        const result = yield (0, playNextSong_1.getRoomState)(roomId);
        // Assert
        expect(redis_1.default.hgetall).toHaveBeenCalledWith((0, playNextSong_1.ROOM_STATE_KEY)(roomId));
        expect(result).toEqual(mockState);
    }));
    it('should return empty object when room has no state', () => __awaiter(void 0, void 0, void 0, function* () {
        // Arrange
        redis_1.default.hgetall.mockResolvedValue({});
        // Act
        const result = yield (0, playNextSong_1.getRoomState)(roomId);
        // Assert
        expect(result).toEqual({});
    }));
    it('should handle Redis errors', () => __awaiter(void 0, void 0, void 0, function* () {
        // Arrange
        redis_1.default.hgetall.mockRejectedValue(new Error('Redis connection failed'));
        // Act & Assert
        yield expect((0, playNextSong_1.getRoomState)(roomId)).rejects.toThrow('Redis connection failed');
    }));
});
