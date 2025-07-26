import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

export interface AuthRequest extends Request {
  user?: any;
}

export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({ message: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

export const requireRegisteredUser = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  // First authenticate the token
  authenticateToken(req, res, (err) => {
    if (err) return;
    
    // Check if user is a guest user (guest users don't have JWT tokens, so this middleware
    // effectively blocks them since they won't pass authenticateToken)
    // Additional check: ensure user has userId (registered users have this)
    if (!req.user?.userId) {
      return res.status(403).json({ 
        message: 'Room creation requires a registered account. Please sign up to create rooms.',
        code: 'PERMISSION_DENIED',
        suggestedAction: 'SIGN_UP'
      });
    }
    
    next();
  });
}; 