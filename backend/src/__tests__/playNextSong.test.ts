import { Server } from 'socket.io';
import { playNextSong, ROOM_STATE_KEY, DEPRECATED_FIELDS } from '../services/playNextSong';
import redis from '../lib/redis';
import { getNextSong, getPlaylist } from '../controllers/playlist';

// Mock the current time for consistent testing
const mockTimestamp = 1704110400000; // 2024-01-01T12:00:00.000Z

jest.mock('../controllers/playlist');

describe('playNextSong', () => {
  let mockIo: any;
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
    (getPlaylist as jest.Mock).mockResolvedValue(mockPlaylist);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should play the next song if available', async () => {
    (getNextSong as jest.Mock).mockResolvedValue(mockSong);

    await playNextSong(mockIo, roomId);

    expect(getNextSong).toHaveBeenCalledWith(roomId);
    expect(redis.hset).toHaveBeenCalledWith(
      ROOM_STATE_KEY(roomId),
      {
        currentSong: JSON.stringify(mockSong),
        playbackStartUtc: mockTimestamp.toString(),
        isPlaying: 'true',
      }
    );
    expect(redis.hdel).toHaveBeenCalledWith(ROOM_STATE_KEY(roomId), ...DEPRECATED_FIELDS);
    expect(mockIo.to).toHaveBeenCalledWith(roomId);
    expect(mockIo.emit).toHaveBeenCalledWith('playNewSong', {
      song: mockSong,
      isPlaying: true,
      playbackStartUtc: mockTimestamp,
    });
    expect(getPlaylist).toHaveBeenCalledWith(roomId);
    expect(mockIo.emit).toHaveBeenCalledWith('playlistUpdated', mockPlaylist);
  });

  it('should clear state and emit noSongAvailable if no song is available', async () => {
    (getNextSong as jest.Mock).mockResolvedValue(null);

    await playNextSong(mockIo, roomId);

    expect(getNextSong).toHaveBeenCalledWith(roomId);
    expect(redis.hset).not.toHaveBeenCalled();
    expect(redis.hdel).toHaveBeenCalledWith(
      ROOM_STATE_KEY(roomId),
      'currentSong',
      'playbackStartUtc',
      'isPlaying',
      ...DEPRECATED_FIELDS
    );
    expect(mockIo.to).toHaveBeenCalledWith(roomId);
    expect(mockIo.emit).toHaveBeenCalledWith('noSongAvailable');
    expect(getPlaylist).not.toHaveBeenCalled(); // No playlist update if no song
  });

  it('should handle Redis errors gracefully', async () => {
    (getNextSong as jest.Mock).mockResolvedValue(mockSong);
    (redis.hset as jest.Mock).mockRejectedValue(new Error('Redis connection failed'));

    await expect(playNextSong(mockIo, roomId)).rejects.toThrow('Redis connection failed');
    expect(mockIo.emit).not.toHaveBeenCalled(); // No events should be emitted on error
  });

  it('should handle errors from getNextSong', async () => {
    (getNextSong as jest.Mock).mockRejectedValue(new Error('Failed to get next song'));

    await expect(playNextSong(mockIo, roomId)).rejects.toThrow('Failed to get next song');
    expect(redis.hset).not.toHaveBeenCalled();
    expect(mockIo.emit).not.toHaveBeenCalled();
  });

  it('should handle errors from getPlaylist', async () => {
    (getNextSong as jest.Mock).mockResolvedValue(mockSong);
    // Ensure hset does not reject for this test
    (redis.hset as jest.Mock).mockResolvedValue(1); 
    (getPlaylist as jest.Mock).mockRejectedValue(new Error('Failed to get playlist'));

    await expect(playNextSong(mockIo, roomId)).rejects.toThrow('Failed to get playlist');
    // Still expect playNewSong to be emitted as it happens before playlist update
    expect(mockIo.emit).toHaveBeenCalledWith('playNewSong', expect.any(Object));
  });
});
