import io from 'socket.io-client';

// "undefined" means the URL will be computed from the `window.location` object
const URL = import.meta.env.VITE_SOCKET_URL;

export const socket = io(URL, {
  // Enable automatic reconnection
  autoConnect: true,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  maxReconnectionAttempts: 5,
  timeout: 20000,
  forceNew: false
});

// Connection recovery state management
interface ConnectionState {
  isConnected: boolean;
  reconnectAttempts: number;
  lastRoomId?: string;
  lastUserId?: string;
  lastUsername?: string;
}

const connectionState: ConnectionState = {
  isConnected: false,
  reconnectAttempts: 0
};

// Store room context for reconnection
export const setRoomContext = (roomId: string, userId: string, username: string) => {
  connectionState.lastRoomId = roomId;
  connectionState.lastUserId = userId;
  connectionState.lastUsername = username;
};

// Clear room context on intentional leave
export const clearRoomContext = () => {
  connectionState.lastRoomId = undefined;
  connectionState.lastUserId = undefined;
  connectionState.lastUsername = undefined;
};

// Connection event handlers for recovery
socket.on('connect', () => {
  console.log('Socket connected');
  connectionState.isConnected = true;
  connectionState.reconnectAttempts = 0;
  
  // Auto-rejoin room if we were in one before disconnection
  if (connectionState.lastRoomId && connectionState.lastUserId && connectionState.lastUsername) {
    console.log('Auto-rejoining room after reconnection:', connectionState.lastRoomId);
    socket.emit('joinRoom', {
      roomId: connectionState.lastRoomId,
      userId: connectionState.lastUserId,
      username: connectionState.lastUsername
    });
  }
});

socket.on('disconnect', (reason) => {
  console.log('Socket disconnected:', reason);
  connectionState.isConnected = false;
});

socket.on('reconnect', (attemptNumber) => {
  console.log('Socket reconnected after', attemptNumber, 'attempts');
  connectionState.isConnected = true;
  connectionState.reconnectAttempts = attemptNumber;
});

socket.on('reconnect_attempt', (attemptNumber) => {
  console.log('Reconnection attempt:', attemptNumber);
  connectionState.reconnectAttempts = attemptNumber;
});

socket.on('reconnect_error', (error) => {
  console.error('Reconnection error:', error);
});

socket.on('reconnect_failed', () => {
  console.error('Reconnection failed - max attempts reached');
});

// Export connection state for components to use
export const getConnectionState = () => ({ ...connectionState });