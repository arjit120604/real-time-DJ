import '@testing-library/jest-dom'

// Mock YouTube API since it's not available in test environment
declare global {
  var YT: any
}

globalThis.YT = {
  Player: class MockYouTubePlayer {
    constructor() {}
    playVideo() {}
    pauseVideo() {}
    seekTo() {}
    getCurrentTime() { return 0 }
    destroy() {}
  }
} as any

// Mock window.YT
Object.defineProperty(window, 'YT', {
  value: globalThis.YT,
  writable: true
})