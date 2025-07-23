import http from 'http';
import { Server } from 'socket.io';
import app from './app'; // Import the configured Express app
import { initSocketServer } from './sockets';
import config from './config';

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*', // Allow all origins for now
    methods: ['GET', 'POST'],
  },
});

// Initialize all the socket event listeners
initSocketServer(io);

const PORT = config.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

