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
exports.getRoomUsers = exports.removeUserFromRoom = exports.addUserToRoom = void 0;
const redis_1 = __importDefault(require("../lib/redis"));
const ROOM_USERS_KEY = (roomId) => `room:users:${roomId}`;
const addUserToRoom = (roomId, userId) => __awaiter(void 0, void 0, void 0, function* () {
    // SADD is idempotent. If the user is already in the set, it does nothing.
    yield redis_1.default.sadd(ROOM_USERS_KEY(roomId), userId);
    console.log(`User ${userId} added to Redis set for room ${roomId}`);
});
exports.addUserToRoom = addUserToRoom;
const removeUserFromRoom = (roomId, userId) => __awaiter(void 0, void 0, void 0, function* () {
    yield redis_1.default.srem(ROOM_USERS_KEY(roomId), userId);
    console.log(`User ${userId} removed from Redis set for room ${roomId}`);
});
exports.removeUserFromRoom = removeUserFromRoom;
const getRoomUsers = (roomId) => __awaiter(void 0, void 0, void 0, function* () {
    // Returns an array of userIds in the room
    const userIds = yield redis_1.default.smembers(ROOM_USERS_KEY(roomId));
    return userIds;
});
exports.getRoomUsers = getRoomUsers;
