import http from 'http';
import { Server } from 'socket.io';
import app from './app'; // Import the configured Express app
import { initSocketServer } from './sockets';
import { cleanupAllRooms } from './services/playNextSong';
import config from './config';

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*', // Allow all origins for now
    methods: ['GET', 'POST'],
  },
});

initSocketServer(io);

const PORT = config.PORT;

httpServer.listen(PORT, async () => {
  console.log(`Server listening on port ${PORT}`);
  
  // Clean up deprecated fields from all existing rooms on server startup
  // This ensures all rooms follow the minimal state approach (requirement 4.4)
  try {
    console.log('Starting cleanup of deprecated fields for all existing rooms...');
    await cleanupAllRooms();
    console.log('Completed cleanup of deprecated fields for all existing rooms');
  } catch (error) {
    console.error('Error during startup cleanup of deprecated fields:', error);
  }
});

