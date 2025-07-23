"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables from .env file
dotenv_1.default.config();
const config = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: process.env.PORT || 8080,
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
    JWT_SECRET: process.env.JWT_SECRET || 'your-default-secret',
    YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY, // Add this line
};
// Validate that all necessary environment variables are set
if (!config.DATABASE_URL || !config.REDIS_URL || !config.YOUTUBE_API_KEY) {
    throw new Error('Missing required environment variables: DATABASE_URL, REDIS_URL, YOUTUBE_API_KEY');
}
exports.default = config;
