import { Server, Socket } from 'socket.io';
import { registerRoomHandlers } from './roomHandler';

/**
 * Initializes the Socket.IO server instance, setting up the main connection listener
 * and registering all event handlers for incoming connections.
 *
 * @param {Server} io - The Socket.IO server instance.
 */
export const initSocketServer = (io: Server) => {
  // This event fires for every new client connection.
  io.on('connection', (socket: Socket) => {
    console.log(`A new client has connected: ${socket.id}`);

    // The 'disconnect' event is handled within the roomHandler to ensure access to room-specific context.
    registerRoomHandlers(io, socket);
  });
};
