"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const app_1 = __importDefault(require("./app")); // Import the configured Express app
const sockets_1 = require("./sockets");
const config_1 = __importDefault(require("./config"));
const httpServer = http_1.default.createServer(app_1.default);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: '*', // Allow all origins for now
        methods: ['GET', 'POST'],
    },
});
(0, sockets_1.initSocketServer)(io);
const PORT = config_1.default.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
