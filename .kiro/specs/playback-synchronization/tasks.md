# Implementation Plan

- [x] 1. Implement server-authoritative seeking functionality
  - Add `seekPlayback` method to PlaybackService that calculates new virtual `playbackStartUtc` based on seek position
  - Add socket event handler for `seekPlayback` events in roomHandler
  - Write unit tests for seek position calculations and edge cases
  - _Requirements: 3.1, 3.2, 3.3, 4.1, 4.2_

- [x] 2. Enhance YouTubePlayer component with seeking capabilities
  - Add `onSeek` callback prop to YouTubePlayer component interface
  - Implement user seek detection in YouTube player event handlers
  - Emit `seekPlayback` socket events when user manually seeks
  - Add logic to distinguish between user-initiated and programmatic seeks
  - _Requirements: 3.1, 3.2, 4.3_

- [x] 3. Simplify client-side synchronization logic
  - Refactor YouTubePlayer to use single `playbackStartUtc` prop for all timing
  - Remove complex multi-effect synchronization and replace with single robust sync effect
  - Implement sync threshold logic to avoid constant micro-adjustments
  - Write unit tests for simplified synchronization calculations
  - _Requirements: 1.1, 1.2, 1.3, 4.2, 4.3_

- [x] 4. Clean up server-side state management
  - Remove unused Redis fields (`pausedAt`, `pauseOffsetMs`, `pauseStartTime`) from playback service
  - Simplify room state interface to only include essential fields
  - Update all state management methods to use minimal state approach
  - Add Redis cleanup for deprecated fields in existing rooms
  - _Requirements: 4.1, 4.2, 4.4_

- [ ] 5. Implement connection recovery and sync resilience
  - Add automatic resync logic on socket reconnection events
  - Implement periodic sync drift detection and correction
  - Add error handling for missing or invalid `playbackStartUtc` values
  - Write integration tests for network resilience scenarios
  - _Requirements: 1.4, 5.1, 5.2, 5.3, 5.4_

- [ ] 6. Add comprehensive test coverage for synchronization
  - Write unit tests for all PlaybackService methods including edge cases
  - Create integration tests for multi-client synchronization scenarios
  - Add performance tests to measure sync accuracy under various network conditions
  - Implement end-to-end tests for seeking functionality across multiple clients
  - _Requirements: 1.1, 2.3, 3.3, 4.4_

- [x] 7. Update room page to handle new seeking functionality
  - Integrate seeking controls into the room page UI
  - Connect seeking controls to YouTubePlayer onSeek callback
  - Update state management to handle new simplified synchronization model
  - Add user feedback for seeking operations
  - _Requirements: 3.1, 3.2, 4.3_

- [ ] 8. Implement configuration and monitoring
  - Add configuration constants for sync thresholds and intervals
  - Implement optional sync accuracy monitoring and logging
  - Add error tracking for synchronization failures
  - Create debugging utilities for sync state inspection
  - _Requirements: 4.4, 5.4_