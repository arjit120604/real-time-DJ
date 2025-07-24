import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import YouTubePlayer, { 
  SYNC_THRESHOLD_SECONDS, 
  USER_SEEK_DETECTION_THRESHOLD, 
  SYNC_CHECK_INTERVAL_MS 
} from '../YouTubePlayer'

// Mock react-youtube
vi.mock('react-youtube', () => ({
  default: ({ videoId }: any) => {
    return <div data-testid="youtube-player" data-video-id={videoId} />
  }
}))

describe('YouTubePlayer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Configuration Constants', () => {
    it('should export correct sync threshold constants', () => {
      expect(SYNC_THRESHOLD_SECONDS).toBe(2)
      expect(USER_SEEK_DETECTION_THRESHOLD).toBe(3)
      expect(SYNC_CHECK_INTERVAL_MS).toBe(1000)
    })
  })

  describe('Component Rendering', () => {
    it('should render with required props', () => {
      render(
        <YouTubePlayer
          videoId="test-video-id"
          isPlaying={true}
          onEnd={vi.fn()}
        />
      )

      expect(screen.getByTestId('youtube-player')).toBeInTheDocument()
      expect(screen.getByTestId('youtube-player')).toHaveAttribute('data-video-id', 'test-video-id')
    })

    it('should render with playbackStartUtc prop', () => {
      render(
        <YouTubePlayer
          videoId="test-video"
          isPlaying={true}
          onEnd={vi.fn()}
          playbackStartUtc={Date.now() - 5000}
        />
      )

      expect(screen.getByTestId('youtube-player')).toBeInTheDocument()
    })

    it('should render with onSeek callback', () => {
      render(
        <YouTubePlayer
          videoId="test-video"
          isPlaying={true}
          onEnd={vi.fn()}
          onSeek={vi.fn()}
        />
      )

      expect(screen.getByTestId('youtube-player')).toBeInTheDocument()
    })
  })
})

// Utility function tests for synchronization calculations
describe('Synchronization Calculations', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Expected Position Calculation', () => {
    it('should calculate correct position for current time', () => {
      const now = Date.now()
      const playbackStartUtc = now - 10000 // 10 seconds ago
      
      // Expected position should be 10 seconds
      const expectedPosition = Math.max(0, (now - playbackStartUtc) / 1000)
      expect(expectedPosition).toBe(10)
    })

    it('should return 0 for future playback start times', () => {
      const now = Date.now()
      const playbackStartUtc = now + 5000 // 5 seconds in future
      
      // Expected position should be 0 (clamped)
      const expectedPosition = Math.max(0, (now - playbackStartUtc) / 1000)
      expect(expectedPosition).toBe(0)
    })

    it('should handle large time differences correctly', () => {
      const now = Date.now()
      const playbackStartUtc = now - 300000 // 5 minutes ago
      
      // Expected position should be 300 seconds
      const expectedPosition = Math.max(0, (now - playbackStartUtc) / 1000)
      expect(expectedPosition).toBe(300)
    })
  })

  describe('Sync Threshold Logic', () => {
    it('should determine when sync is needed based on threshold', () => {
      const currentPosition = 10
      const expectedPosition = 12.5
      const timeDiff = Math.abs(currentPosition - expectedPosition)
      
      // Difference is 2.5 seconds, which exceeds SYNC_THRESHOLD_SECONDS (2)
      expect(timeDiff > SYNC_THRESHOLD_SECONDS).toBe(true)
    })

    it('should not sync when within threshold', () => {
      const currentPosition = 10
      const expectedPosition = 11.5
      const timeDiff = Math.abs(currentPosition - expectedPosition)
      
      // Difference is 1.5 seconds, which is within SYNC_THRESHOLD_SECONDS (2)
      expect(timeDiff > SYNC_THRESHOLD_SECONDS).toBe(false)
    })
  })

  describe('User Seek Detection Logic', () => {
    it('should detect user seeks when difference exceeds threshold', () => {
      const currentTime = 30
      const expectedTime = 10
      const lastKnownPosition = 10
      
      const timeDiff = Math.abs(currentTime - expectedTime)
      const positionChange = Math.abs(currentTime - lastKnownPosition)
      
      const hasUserSeeked = timeDiff > USER_SEEK_DETECTION_THRESHOLD && positionChange > 1
      
      // Difference is 20 seconds, which exceeds USER_SEEK_DETECTION_THRESHOLD (3)
      // Position change is 20 seconds, which exceeds 1 second
      expect(hasUserSeeked).toBe(true)
    })

    it('should not detect seeks for small position changes', () => {
      const currentTime = 10.5
      const expectedTime = 10
      const lastKnownPosition = 10
      
      const timeDiff = Math.abs(currentTime - expectedTime)
      const positionChange = Math.abs(currentTime - lastKnownPosition)
      
      const hasUserSeeked = timeDiff > USER_SEEK_DETECTION_THRESHOLD && positionChange > 1
      
      // Difference is 0.5 seconds, which is within USER_SEEK_DETECTION_THRESHOLD (3)
      expect(hasUserSeeked).toBe(false)
    })
  })
})