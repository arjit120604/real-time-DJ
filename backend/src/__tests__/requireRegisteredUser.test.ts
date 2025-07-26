import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { requireRegisteredUser, AuthRequest } from '../middleware/auth';

// Mock jwt
jest.mock('jsonwebtoken');
const mockedJwt = jwt as jest.Mocked<typeof jwt>;

describe('requireRegisteredUser middleware', () => {
  let mockReq: Partial<AuthRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      headers: {}
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should allow access for registered users with valid JWT and userId', () => {
    // Mock valid JWT token
    mockReq.headers = {
      authorization: 'Bearer valid-token'
    };

    const mockUser = { userId: 'user123', username: 'testuser' };
    mockedJwt.verify.mockImplementation((token, secret, callback: any) => {
      callback(null, mockUser);
    });

    requireRegisteredUser(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockReq.user).toEqual(mockUser);
  });

  it('should deny access when no token is provided', () => {
    mockReq.headers = {};

    requireRegisteredUser(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'No token provided' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should deny access when token is invalid', () => {
    mockReq.headers = {
      authorization: 'Bearer invalid-token'
    };

    mockedJwt.verify.mockImplementation((token, secret, callback: any) => {
      callback(new Error('Invalid token'), null);
    });

    requireRegisteredUser(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Invalid token' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should deny access when user does not have userId (guest user scenario)', () => {
    mockReq.headers = {
      authorization: 'Bearer valid-token'
    };

    const mockUserWithoutUserId = { username: 'guestuser' }; // No userId
    mockedJwt.verify.mockImplementation((token, secret, callback: any) => {
      callback(null, mockUserWithoutUserId);
    });

    requireRegisteredUser(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith({
      message: 'Room creation requires a registered account. Please sign up to create rooms.',
      code: 'PERMISSION_DENIED',
      suggestedAction: 'SIGN_UP'
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should deny access when user has null userId', () => {
    mockReq.headers = {
      authorization: 'Bearer valid-token'
    };

    const mockUserWithNullUserId = { userId: null, username: 'testuser' };
    mockedJwt.verify.mockImplementation((token, secret, callback: any) => {
      callback(null, mockUserWithNullUserId);
    });

    requireRegisteredUser(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith({
      message: 'Room creation requires a registered account. Please sign up to create rooms.',
      code: 'PERMISSION_DENIED',
      suggestedAction: 'SIGN_UP'
    });
    expect(mockNext).not.toHaveBeenCalled();
  });
});