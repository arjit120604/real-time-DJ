# Design Document

## Overview

This design implements a robust "absolute timestamp" synchronization model for the collaborative music player. The core principle is that the server maintains a single, authoritative timestamp (`playbackStartUtc`) that represents when the current song began playing in universal time. All clients use this timestamp with their local system time to calculate their exact position in the song, creating a self-correcting synchronization system that handles network latency automatically.

The design replaces the current fragile state management with a simple, stateless approach where clients are responsible for calculating their own playback position using the universal timeline provided by the server.

## Architecture

### Core Synchronization Model

The system uses an "absolute timestamp" approach where:

1. **Server Authority**: The server maintains only one critical piece of state - `playbackStartUtc` - representing the universal timestamp when the current song started playing
2. **Client Calculation**: Clients calculate their current position using: `currentPosition = (Date.now() - playbackStartUtc) / 1000`
3. **Self-Correction**: Network latency is automatically compensated because both the command delivery and the client's `Date.now()` are delayed by the same amount

### State Management

**Server State (Redis)**:
```typescript
interface RoomState {
  currentSong: string;           // JSON serialized song object
  playbackStartUtc: string;      // Universal timestamp as string
  isPlaying: string;             // "true" or "false"
  // No pause offsets, seek times, or complex state
}
```

**Client State**:
```typescript
interface ClientState {
  currentSong: Song | null;
  isPlaying: boolean;
  playbackStartUtc: number | null;  // Single source of timeline truth
}
```

### Event Flow

1. **Play New Song**: Server sets `playbackStartUtc = Date.now()` and broadcasts
2. **Pause**: Server sets `isPlaying = false`, keeps `playbackStartUtc` unchanged
3. **Resume**: Server calculates new virtual `playbackStartUtc` to maintain continuity
4. **Seek**: Server calculates new virtual `playbackStartUtc` based on seek position

## Components and Interfaces

### Backend Services

#### PlaybackService (Enhanced)
```typescript
class PlaybackService {
  // Core synchronization methods
  async playNewSong(io: Server, roomId: string): Promise<void>
  async pausePlayback(io: Server, roomId: string): Promise<void>
  async resumePlayback(io: Server, roomId: string): Promise<void>
  
  // New server-authoritative seeking
  async seekPlayback(io: Server, roomId: string, seekToMs: number): Promise<void>
  
  // Utility methods
  private async getCurrentPlaybackState(roomId: string): Promise<RoomState>
  private async broadcastPlaybackState(io: Server, roomId: string, state: PlaybackState): Promise<void>
}
```

#### Socket Event Handlers (Enhanced)
```typescript
// Existing events (enhanced)
socket.on('pausePlayback', (payload: { roomId: string }) => {})
socket.on('resumePlayback', (payload: { roomId: string }) => {})

// New seeking event
socket.on('seekPlayback', (payload: { roomId: string; seekToMs: number }) => {})
```

### Frontend Components

#### YouTubePlayer (Simplified)
```typescript
interface YouTubePlayerProps {
  videoId: string;
  isPlaying: boolean;
  playbackStartUtc?: number;  // Single timeline source
  onEnd: () => void;
  onSeek?: (seekToMs: number) => void;  // New seeking callback
}
```

The component will have a single, robust synchronization effect:
```typescript
useEffect(() => {
  if (playerRef.current && playbackStartUtc && isPlaying) {
    const seekToSeconds = Math.max(0, (Date.now() - playbackStartUtc) / 1000);
    const currentTime = playerRef.current.getCurrentTime();
    const timeDiff = Math.abs(currentTime - seekToSeconds);
    
    // Only seek if significantly out of sync to avoid constant adjustments
    if (timeDiff > SYNC_THRESHOLD_SECONDS) {
      playerRef.current.seekTo(seekToSeconds, true);
    }
  }
}, [playbackStartUtc, isPlaying]);
```

#### Room Page (Enhanced)
The room page will handle the new seeking functionality and simplified state management.

### Data Models

#### PlaybackState
```typescript
interface PlaybackState {
  isPlaying: boolean;
  playbackStartUtc: number;
  currentSong?: Song;
}
```

#### Socket Events
```typescript
// Server to Client
interface PlaybackStateChanged {
  isPlaying: boolean;
  playbackStartUtc: number;
}

interface PlayNewSong {
  song: Song;
  isPlaying: boolean;
  playbackStartUtc: number;
}

// Client to Server
interface SeekPlayback {
  roomId: string;
  seekToMs: number;
}
```

## Error Handling

### Network Latency Compensation
- **Automatic**: The absolute timestamp model inherently compensates for network delays
- **No Manual Correction**: Clients don't need to account for latency manually
- **Self-Healing**: Late-arriving commands automatically result in correct positioning

### Connection Recovery
```typescript
// Client reconnection logic
socket.on('connect', () => {
  // Rejoin room to get current state
  socket.emit('joinRoom', { roomId, userId, username });
});

socket.on('roomState', (state) => {
  // Automatic resync on state reception
  if (state.playbackStartUtc) {
    setPlaybackStartUtc(state.playbackStartUtc);
  }
});
```

### Sync Drift Detection
```typescript
// Periodic sync check (optional enhancement)
useEffect(() => {
  const syncCheck = setInterval(() => {
    if (playerRef.current && playbackStartUtc && isPlaying) {
      const expectedPosition = (Date.now() - playbackStartUtc) / 1000;
      const actualPosition = playerRef.current.getCurrentTime();
      const drift = Math.abs(expectedPosition - actualPosition);
      
      if (drift > DRIFT_THRESHOLD_SECONDS) {
        playerRef.current.seekTo(expectedPosition, true);
      }
    }
  }, SYNC_CHECK_INTERVAL_MS);
  
  return () => clearInterval(syncCheck);
}, [playbackStartUtc, isPlaying]);
```

### Error States
- **Invalid Seek Position**: Clamp seek positions to valid range [0, songDuration]
- **Missing Timeline**: Gracefully handle missing `playbackStartUtc` by pausing playback
- **Player Errors**: Emit `playNextSong` event on player errors to skip problematic tracks

## Testing Strategy

### Unit Tests

#### Backend Service Tests
```typescript
describe('PlaybackService', () => {
  describe('seekPlayback', () => {
    it('should calculate correct playbackStartUtc for seek position');
    it('should handle seek to beginning of song');
    it('should handle seek to end of song');
    it('should clamp invalid seek positions');
  });
  
  describe('resumePlayback', () => {
    it('should maintain timeline continuity after pause');
    it('should handle multiple pause/resume cycles');
  });
});
```

#### Frontend Component Tests
```typescript
describe('YouTubePlayer', () => {
  describe('synchronization', () => {
    it('should seek to correct position on playbackStartUtc change');
    it('should not seek if already in sync');
    it('should handle playbackStartUtc updates during playback');
  });
  
  describe('seeking', () => {
    it('should emit seekPlayback event on user seek');
    it('should not emit seek events during programmatic seeks');
  });
});
```

### Integration Tests

#### End-to-End Synchronization
```typescript
describe('Multi-client synchronization', () => {
  it('should sync multiple clients to same position');
  it('should handle clients joining during playback');
  it('should maintain sync through pause/resume cycles');
  it('should sync all clients when one client seeks');
});
```

#### Network Condition Tests
```typescript
describe('Network resilience', () => {
  it('should handle delayed sync commands');
  it('should recover from temporary disconnections');
  it('should maintain sync with varying latencies');
});
```

### Performance Tests

#### Sync Accuracy Measurement
- Measure synchronization accuracy across multiple clients
- Test with simulated network latencies (50ms, 200ms, 500ms)
- Verify sync accuracy remains within 100ms tolerance

#### Resource Usage
- Monitor CPU usage of sync checking intervals
- Measure memory usage of simplified state management
- Test with high numbers of concurrent users per room

## Implementation Notes

### Migration Strategy
1. **Phase 1**: Implement new seeking functionality while maintaining backward compatibility
2. **Phase 2**: Simplify client-side synchronization logic
3. **Phase 3**: Remove legacy pause offset and complex state management
4. **Phase 4**: Add periodic sync checking and drift correction

### Configuration Constants
```typescript
const SYNC_THRESHOLD_SECONDS = 2;      // Minimum drift before seeking
const DRIFT_THRESHOLD_SECONDS = 5;     // Maximum acceptable drift
const SYNC_CHECK_INTERVAL_MS = 10000;  // Periodic sync check frequency
```

### Redis Optimization
- Remove unused fields: `pausedAt`, `pauseOffsetMs`, `pauseStartTime`
- Maintain minimal state: `currentSong`, `playbackStartUtc`, `isPlaying`
- Use Redis TTL for automatic room cleanup

This design provides a robust, maintainable synchronization system that eliminates the complexity and fragility of the current implementation while adding the missing server-authoritative seeking functionality.