"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const auth_1 = __importDefault(require("./routes/auth"));
const rooms_1 = __importDefault(require("./routes/rooms"));
const app = (0, express_1.default)();
// Global middleware
app.use((0, cors_1.default)()); // Use cors middleware
app.use(express_1.default.json()); // To parse JSON request bodies
// Mount API routes
app.use('/api/auth', auth_1.default);
app.use('/api/rooms', rooms_1.default);
// Simple root endpoint for health check
app.get('/', (_req, res) => {
    res.send('Express server is running.');
});
// Global error handling (placeholder)
app.use((err, _req, res, _next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});
exports.default = app;
