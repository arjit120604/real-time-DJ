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
exports.deleteRoom = exports.listRooms = exports.createRoom = void 0;
const db_1 = __importDefault(require("../db"));
const createRoom = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { name } = req.body;
        const ownerId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        if (!name || !ownerId) {
            return res.status(400).json({ message: 'Room name and ownerId are required' });
        }
        const room = yield db_1.default.room.create({
            data: {
                name,
                ownerId,
            },
        });
        res.status(201).json(room);
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to create room', error });
    }
});
exports.createRoom = createRoom;
// List all available rooms
const listRooms = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const rooms = yield db_1.default.room.findMany({
            include: { owner: true },
        });
        res.json(rooms);
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to fetch rooms', error });
    }
});
exports.listRooms = listRooms;
const deleteRoom = (roomId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield db_1.default.room.delete({ where: { id: roomId } });
        console.log(`Room ${roomId} deleted from database.`);
    }
    catch (error) {
        console.error(`Failed to delete room ${roomId}:`, error);
    }
});
exports.deleteRoom = deleteRoom;
