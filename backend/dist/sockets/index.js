"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSocketServer = void 0;
const roomHandler_1 = require("./roomHandler");
/**
 * Initializes the Socket.IO server instance, setting up the main connection listener
 * and registering all event handlers for incoming connections.
 *
 * @param {Server} io - The Socket.IO server instance.
 */
const initSocketServer = (io) => {
    // This event fires for every new client connection.
    io.on('connection', (socket) => {
        console.log(`A new client has connected: ${socket.id}`);
        // The 'disconnect' event is handled within the roomHandler to ensure access to room-specific context.
        (0, roomHandler_1.registerRoomHandlers)(io, socket);
    });
};
exports.initSocketServer = initSocketServer;
