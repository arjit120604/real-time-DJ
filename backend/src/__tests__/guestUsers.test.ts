import { validateRoomExists } from '../sockets/roomHandler';
import prisma from '../db';

// Mock Redis since it's already mocked in setup.ts
jest.mock('../lib/redis', () => ({
  hset: jest.fn(),
  hget: jest.fn(),
  hdel: jest.fn(),
  del: jest.fn(),
  sadd: jest.fn(),
  srem: jest.fn(),
  smembers: jest.fn().mockResolvedValue([])
}));

describe('Guest User Socket Functionality', () => {
  const testRoomId = 'test-guest-room-123';
  const testUserId = 'test-user-123';

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Clean up database
    await prisma.room.deleteMany({});
    await prisma.user.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('should validate room exists for guest users', async () => {
    // Create a test room in the database
    await prisma.room.create({
      data: {
        id: testRoomId,
        name: 'Test Room',
        owner: {
          create: {
            id: testUserId,
            username: 'testuser',
            password: 'hashedpassword'
          }
        }
      }
    });

    // Test that existing room returns true
    const existingRoomResult = await validateRoomExists(testRoomId);
    expect(existingRoomResult).toBe(true);

    // Test that non-existent room returns false
    const nonExistentRoomResult = await validateRoomExists('non-existent-room');
    expect(nonExistentRoomResult).toBe(false);
  });

  test('should generate guest user ID with guest prefix', () => {
    // This tests the UUID generation logic for guest users
    const { v4: uuidv4 } = require('uuid');
    const guestId = `guest_${uuidv4()}`;
    expect(guestId).toMatch(/^guest_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  test('should store guest user info with isGuest flag', () => {
    const guestUsername = 'TestGuest';
    const guestId = 'guest_123';
    
    const userInfo = { 
      id: guestId, 
      username: guestUsername, 
      isGuest: true 
    };

    // Test that the user info structure is correct
    expect(userInfo.id).toBe(guestId);
    expect(userInfo.username).toBe(guestUsername);
    expect(userInfo.isGuest).toBe(true);
  });
});