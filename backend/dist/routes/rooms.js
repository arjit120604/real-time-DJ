"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const rooms_1 = require("../controllers/rooms");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Protected route to create a new room
router.post('/rooms', auth_1.authenticateToken, rooms_1.createRoom);
// Public route to list all rooms
router.get('/rooms', rooms_1.listRooms);
exports.default = router;
