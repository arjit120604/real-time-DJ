import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../db';

export const createRoom = async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    const ownerId = req.user?.id || req.body.ownerId; // req.user for authenticated, fallback for testing
    if (!name || !ownerId) {
      return res.status(400).json({ message: 'Room name and ownerId are required' });
    }
    const room = await prisma.room.create({
      data: {
        name,
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
    await prisma.room.delete({ where: { id: roomId } });
    console.log(`Room ${roomId} deleted from database.`);
  } catch (error) {
    console.error(`Failed to delete room ${roomId}:`, error);
  }
};

