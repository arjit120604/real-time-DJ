import { Server } from 'socket.io';
import { 
  seekPlayback, 
  ROOM_STATE_KEY, 
  cleanupDeprecatedFields, 
  getRoomState,
  DEPRECATED_FIELDS 
} from '../services/playNextSong';
import redis from '../lib/redis';

// Mock the current time for consistent testing
const mockTimestamp = 1704110400000; // 2024-01-01T12:00:00.000Z

describe('seekPlayback', () => {
  let mockIo: any;
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
    it('should calculate correct playbackStartUtc for seek position', async () => {
      // Arrange
      const seekToMs = 30000; // 30 seconds
      const expectedPlaybackStartUtc = mockTimestamp - seekToMs;
      
      (redis.hgetall as jest.Mock).mockResolvedValue({
        currentSong: JSON.stringify({ id: 'song1', title: 'Test Song' }),
        isPlaying: 'true',
        playbackStartUtc: '1000000000000'
      });

      // Act
      await seekPlayback(mockIo, roomId, seekToMs);

      // Assert
      expect(redis.hset).toHaveBeenCalledWith(
        ROOM_STATE_KEY(roomId),
        {
          playbackStartUtc: expectedPlaybackStartUtc.toString(),
          isPlaying: 'true',
        }
      );
    });

    it('should broadcast playbackStateChanged event with correct data', async () => {
      // Arrange
      const seekToMs = 45000; // 45 seconds
      const expectedPlaybackStartUtc = mockTimestamp - seekToMs;
      
      (redis.hgetall as jest.Mock).mockResolvedValue({
        currentSong: JSON.stringify({ id: 'song1', title: 'Test Song' }),
      });

      // Act
      await seekPlayback(mockIo, roomId, seekToMs);

      // Assert
      expect(mockIo.to).toHaveBeenCalledWith(roomId);
      expect(mockIo.emit).toHaveBeenCalledWith('playbackStateChanged', {
        isPlaying: true,
        playbackStartUtc: expectedPlaybackStartUtc,
      });
    });

    it('should clear deprecated fields when seeking', async () => {
      // Arrange
      const seekToMs = 60000; // 1 minute
      
      (redis.hgetall as jest.Mock).mockResolvedValue({
        currentSong: JSON.stringify({ id: 'song1', title: 'Test Song' }),
        pauseOffsetMs: '15000', // Should be cleared
        pausedAt: '1000000000000', // Should be cleared
        pauseStartTime: '1000000000000', // Should be cleared
      });

      // Act
      await seekPlayback(mockIo, roomId, seekToMs);

      // Assert
      expect(redis.hdel).toHaveBeenCalledWith(
        ROOM_STATE_KEY(roomId),
        ...DEPRECATED_FIELDS
      );
    });

    it('should set isPlaying to true when seeking', async () => {
      // Arrange
      const seekToMs = 20000; // 20 seconds
      
      (redis.hgetall as jest.Mock).mockResolvedValue({
        currentSong: JSON.stringify({ id: 'song1', title: 'Test Song' }),
        isPlaying: 'false', // Currently paused
      });

      // Act
      await seekPlayback(mockIo, roomId, seekToMs);

      // Assert
      expect(redis.hset).toHaveBeenCalledWith(
        ROOM_STATE_KEY(roomId),
        expect.objectContaining({
          isPlaying: 'true',
        })
      );
    });
  });

  describe('edge cases', () => {
    it('should handle seek to beginning of song (0ms)', async () => {
      // Arrange
      const seekToMs = 0;
      const expectedPlaybackStartUtc = mockTimestamp; // No offset
      
      (redis.hgetall as jest.Mock).mockResolvedValue({
        currentSong: JSON.stringify({ id: 'song1', title: 'Test Song' }),
      });

      // Act
      await seekPlayback(mockIo, roomId, seekToMs);

      // Assert
      expect(redis.hset).toHaveBeenCalledWith(
        ROOM_STATE_KEY(roomId),
        expect.objectContaining({
          playbackStartUtc: expectedPlaybackStartUtc.toString(),
        })
      );
    });

    it('should handle large seek positions', async () => {
      // Arrange
      const seekToMs = 300000; // 5 minutes
      const expectedPlaybackStartUtc = mockTimestamp - seekToMs;
      
      (redis.hgetall as jest.Mock).mockResolvedValue({
        currentSong: JSON.stringify({ id: 'song1', title: 'Test Song' }),
      });

      // Act
      await seekPlayback(mockIo, roomId, seekToMs);

      // Assert
      expect(redis.hset).toHaveBeenCalledWith(
        ROOM_STATE_KEY(roomId),
        expect.objectContaining({
          playbackStartUtc: expectedPlaybackStartUtc.toString(),
        })
      );
    });

    it('should not perform any operations when no current song exists', async () => {
      // Arrange
      const seekToMs = 30000;
      
      (redis.hgetall as jest.Mock).mockResolvedValue({
        // No currentSong field
        isPlaying: 'false',
      });

      // Act
      await seekPlayback(mockIo, roomId, seekToMs);

      // Assert
      expect(redis.hset).not.toHaveBeenCalled();
      expect(redis.hdel).not.toHaveBeenCalled();
      expect(mockIo.emit).not.toHaveBeenCalled();
    });

    it('should handle empty room state', async () => {
      // Arrange
      const seekToMs = 30000;
      
      (redis.hgetall as jest.Mock).mockResolvedValue({});

      // Act
      await seekPlayback(mockIo, roomId, seekToMs);

      // Assert
      expect(redis.hset).not.toHaveBeenCalled();
      expect(redis.hdel).not.toHaveBeenCalled();
      expect(mockIo.emit).not.toHaveBeenCalled();
    });

    it('should clamp negative seek positions to 0', async () => {
      // Arrange
      const seekToMs = -5000; // Negative 5 seconds (should be clamped to 0)
      const expectedPlaybackStartUtc = mockTimestamp; // Should be clamped to 0, so no offset
      
      (redis.hgetall as jest.Mock).mockResolvedValue({
        currentSong: JSON.stringify({ id: 'song1', title: 'Test Song' }),
      });

      // Act
      await seekPlayback(mockIo, roomId, seekToMs);

      // Assert
      expect(redis.hset).toHaveBeenCalledWith(
        ROOM_STATE_KEY(roomId),
        expect.objectContaining({
          playbackStartUtc: expectedPlaybackStartUtc.toString(),
        })
      );
    });

    it('should handle decimal seek positions by flooring them', async () => {
      // Arrange
      const seekToMs = 30500.7; // Should be floored to 30500
      const expectedPlaybackStartUtc = mockTimestamp - 30500;
      
      (redis.hgetall as jest.Mock).mockResolvedValue({
        currentSong: JSON.stringify({ id: 'song1', title: 'Test Song' }),
      });

      // Act
      await seekPlayback(mockIo, roomId, seekToMs);

      // Assert
      expect(redis.hset).toHaveBeenCalledWith(
        ROOM_STATE_KEY(roomId),
        expect.objectContaining({
          playbackStartUtc: expectedPlaybackStartUtc.toString(),
        })
      );
    });
  });

  describe('timeline calculation verification', () => {
    it('should ensure seek position calculation is mathematically correct', async () => {
      // Arrange
      const seekToMs = 75000; // 1 minute 15 seconds
      
      (redis.hgetall as jest.Mock).mockResolvedValue({
        currentSong: JSON.stringify({ id: 'song1', title: 'Test Song' }),
      });

      // Act
      await seekPlayback(mockIo, roomId, seekToMs);

      // Assert - Verify the math: (Date.now() - playbackStartUtc) should equal seekToMs
      const setCall = (redis.hset as jest.Mock).mock.calls[0];
      const playbackStartUtc = parseInt(setCall[1].playbackStartUtc);
      const calculatedPosition = mockTimestamp - playbackStartUtc;
      
      expect(calculatedPosition).toBe(seekToMs);
    });

    it('should maintain timeline consistency across multiple seeks', async () => {
      // Arrange
      const firstSeek = 30000;
      const secondSeek = 60000;
      
      (redis.hgetall as jest.Mock).mockResolvedValue({
        currentSong: JSON.stringify({ id: 'song1', title: 'Test Song' }),
      });

      // Act - First seek
      await seekPlayback(mockIo, roomId, firstSeek);
      const firstCall = (redis.hset as jest.Mock).mock.calls[0];
      const firstPlaybackStartUtc = parseInt(firstCall[1].playbackStartUtc);

      // Clear mocks and perform second seek
      jest.clearAllMocks();
      await seekPlayback(mockIo, roomId, secondSeek);
      const secondCall = (redis.hset as jest.Mock).mock.calls[0];
      const secondPlaybackStartUtc = parseInt(secondCall[1].playbackStartUtc);

      // Assert - Both calculations should be mathematically correct
      expect(mockTimestamp - firstPlaybackStartUtc).toBe(firstSeek);
      expect(mockTimestamp - secondPlaybackStartUtc).toBe(secondSeek);
      expect(secondPlaybackStartUtc).toBeLessThan(firstPlaybackStartUtc); // Later in song = earlier start time
    });
  });

  describe('error handling', () => {
    it('should handle Redis errors gracefully', async () => {
      // Arrange
      const seekToMs = 30000;
      (redis.hgetall as jest.Mock).mockRejectedValue(new Error('Redis connection failed'));

      // Act & Assert
      await expect(seekPlayback(mockIo, roomId, seekToMs)).rejects.toThrow('Redis connection failed');
    });

    it('should handle malformed currentSong data', async () => {
      // Arrange
      const seekToMs = 30000;
      
      (redis.hgetall as jest.Mock).mockResolvedValue({
        currentSong: 'invalid-json-data',
      });

      // Act - Should not throw, but also should not perform operations
      await seekPlayback(mockIo, roomId, seekToMs);

      // Assert - Operations should still proceed since we only check for existence of currentSong
      expect(redis.hset).toHaveBeenCalled();
    });
  });
});

describe('cleanupDeprecatedFields', () => {
  const roomId = 'test-room-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should remove deprecated fields from room state', async () => {
    // Arrange
    (redis.hgetall as jest.Mock).mockResolvedValue({
      currentSong: JSON.stringify({ id: 'song1', title: 'Test Song' }),
      isPlaying: 'true',
      playbackStartUtc: '1704110370000',
      pauseOffsetMs: '10000', // Deprecated field
      pausedAt: '1704110380000', // Deprecated field
      pauseStartTime: '1704110380000', // Deprecated field
    });
    (redis.hdel as jest.Mock).mockResolvedValue(3); // 3 fields deleted

    // Act
    await cleanupDeprecatedFields(roomId);

    // Assert
    expect(redis.hdel).toHaveBeenCalledWith(
      ROOM_STATE_KEY(roomId),
      ...DEPRECATED_FIELDS
    );
  });

  it('should handle case when no deprecated fields exist', async () => {
    // Arrange
    (redis.hgetall as jest.Mock).mockResolvedValue({
      currentSong: JSON.stringify({ id: 'song1', title: 'Test Song' }),
      isPlaying: 'true',
      playbackStartUtc: '1704110370000',
      // No deprecated fields
    });

    // Act
    await cleanupDeprecatedFields(roomId);

    // Assert
    expect(redis.hdel).not.toHaveBeenCalled();
  });

  it('should handle Redis errors gracefully', async () => {
    // Arrange
    (redis.hgetall as jest.Mock).mockResolvedValue({
      currentSong: JSON.stringify({ id: 'song1', title: 'Test Song' }),
      pauseOffsetMs: '10000', // Deprecated field
    });
    (redis.hdel as jest.Mock).mockRejectedValue(new Error('Redis connection failed'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    // Act
    await cleanupDeprecatedFields(roomId);

    // Assert
    expect(consoleSpy).toHaveBeenCalledWith(
      `Error cleaning up deprecated fields for room ${roomId}:`,
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });
});

describe('getRoomState', () => {
  const roomId = 'test-room-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return room state with proper typing', async () => {
    // Arrange
    const mockState = {
      currentSong: JSON.stringify({ id: 'song1', title: 'Test Song' }),
      playbackStartUtc: '1704110400000',
      isPlaying: 'true'
    };
    (redis.hgetall as jest.Mock).mockResolvedValue(mockState);

    // Act
    const result = await getRoomState(roomId);

    // Assert
    expect(redis.hgetall).toHaveBeenCalledWith(ROOM_STATE_KEY(roomId));
    expect(result).toEqual(mockState);
  });

  it('should return empty object when room has no state', async () => {
    // Arrange
    (redis.hgetall as jest.Mock).mockResolvedValue({});

    // Act
    const result = await getRoomState(roomId);

    // Assert
    expect(result).toEqual({});
  });

  it('should handle Redis errors', async () => {
    // Arrange
    (redis.hgetall as jest.Mock).mockRejectedValue(new Error('Redis connection failed'));

    // Act & Assert
    await expect(getRoomState(roomId)).rejects.toThrow('Redis connection failed');
  });
});