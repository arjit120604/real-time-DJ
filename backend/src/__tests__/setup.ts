// Test setup file
// This file runs before all tests

// Mock Redis to avoid needing a real Redis instance during tests
jest.mock('../lib/redis', () => ({
  hset: jest.fn(),
  hget: jest.fn(),
  hgetall: jest.fn(),
  hdel: jest.fn(),
  del: jest.fn(),
}));

// Mock Socket.IO Server
jest.mock('socket.io', () => ({
  Server: jest.fn().mockImplementation(() => ({
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  })),
}));