import { Router } from 'express';
import { createRoom, listRooms } from '../controllers/rooms';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Protected route to create a new room
router.post('/rooms', authenticateToken, createRoom);

// Public route to list all rooms
router.get('/rooms', listRooms);

export default router;
