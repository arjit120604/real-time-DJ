import { Router } from 'express';
import { createRoom, listRooms } from '../controllers/rooms';
import { requireRegisteredUser } from '../middleware/auth';

const router = Router();

// Protected route to create a new room - requires registered user
router.post('/rooms', requireRegisteredUser, createRoom);

// Public route to list all rooms
router.get('/rooms', listRooms);

export default router;
