import { Router } from 'express';
import { register, login, logout, validateToken } from '../controllers/auth';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// POST /api/auth/register
router.post('/register', register);

// POST /api/auth/login
router.post('/login', login);

// POST /api/auth/logout
router.post('/logout', logout);

// GET /api/auth/validate
router.get('/validate', authenticateToken, validateToken);

export default router;
