"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const app_1 = __importDefault(require("./app")); // Import the configured Express app
const sockets_1 = require("./sockets");
const playNextSong_1 = require("./services/playNextSong");
const config_1 = __importDefault(require("./config"));
const httpServer = http_1.default.createServer(app_1.default);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: '*', // Allow all origins for now
        methods: ['GET', 'POST'],
    },
});
(0, sockets_1.initSocketServer)(io);
const PORT = config_1.default.PORT;
httpServer.listen(PORT, () => __awaiter(void 0, void 0, void 0, function* () {
    console.log(`Server listening on port ${PORT}`);
    // Clean up deprecated fields from all existing rooms on server startup
    // This ensures all rooms follow the minimal state approach (requirement 4.4)
    try {
        console.log('Starting cleanup of deprecated fields for all existing rooms...');
        yield (0, playNextSong_1.cleanupAllRooms)();
        console.log('Completed cleanup of deprecated fields for all existing rooms');
    }
    catch (error) {
        console.error('Error during startup cleanup of deprecated fields:', error);
    }
}));
