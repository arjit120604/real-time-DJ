import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import roomsRoutes from './routes/rooms';

const app = express();

// Global middleware
app.use(cors()); // Use cors middleware
app.use(express.json()); // To parse JSON request bodies

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomsRoutes);

// Simple root endpoint for health check
app.get('/', (_req, res) => {
  res.send('Express server is running.');
});

// Global error handling (placeholder)
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

export default app;
