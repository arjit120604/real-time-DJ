import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../db';

export const createRoom = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.body;
    const ownerId = req.user?.userId;
    if (!id || !ownerId) {
      return res.status(400).json({ message: 'Room ID and ownerId are required' });
    }

    // Convert id to number since schema expects Int
    const roomId = parseInt(id, 10);
    if (isNaN(roomId)) {
      return res.status(400).json({ message: 'Room ID must be a valid number' });
    }

    const room = await prisma.room.create({
      data: {
        id: roomId,
        ownerId,
      },
    });
    res.status(201).json(room);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create room', error });
  }
};

// List all available rooms
export const listRooms = async (_req: AuthRequest, res: Response) => {
  try {
    const rooms = await prisma.room.findMany({
      include: { owner: true },
    });
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch rooms', error });
  }
};

export const deleteRoom = async (roomId: string) => {
  try {
    const roomIdInt = parseInt(roomId, 10);
    if (isNaN(roomIdInt)) {
      console.error(`Invalid room ID: ${roomId} - must be a number`);
      return;
    }

    await prisma.room.delete({ where: { id: roomIdInt } });
    console.log(`Room ${roomId} deleted from database.`);
  } catch (error) {
    console.error(`Failed to delete room ${roomId}:`, error);
  }
};

