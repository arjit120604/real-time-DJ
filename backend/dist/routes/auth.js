"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../controllers/auth");
const router = (0, express_1.Router)();
// POST /api/auth/register
router.post('/register', auth_1.register);
// POST /api/auth/login
router.post('/login', auth_1.login);
// POST /api/auth/logout
router.post('/logout', auth_1.logout);
exports.default = router;
