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
exports.extractVideoIdFromUrl = exports.getYouTubeVideoDetails = void 0;
const googleapis_1 = require("googleapis");
const config_1 = __importDefault(require("../config"));
const youtube = googleapis_1.google.youtube({
    version: 'v3',
    auth: config_1.default.YOUTUBE_API_KEY,
});
/**
 * Parses an ISO 8601 duration string (e.g., "PT2M10S") and returns the duration in milliseconds.
 * @param duration The ISO 8601 duration string.
 * @returns The duration in milliseconds.
 */
const parseDurationToMs = (duration) => {
    const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
    const matches = duration.match(regex);
    if (!matches) {
        return 0;
    }
    const hours = parseInt(matches[1] || '0', 10);
    const minutes = parseInt(matches[2] || '0', 10);
    const seconds = parseInt(matches[3] || '0', 10);
    return (hours * 3600 + minutes * 60 + seconds) * 1000;
};
/**
* Fetches details for a specific YouTube video by its ID.
* @param videoId The ID of the YouTube video.
* @returns A promise that resolves to the video details, or null if not found or an error occurs.
*/
const getYouTubeVideoDetails = (videoId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
    try {
        const response = yield youtube.videos.list({
            part: ['snippet', 'contentDetails'], // We need snippet for title/thumb and contentDetails for duration
            id: [videoId],
        });
        const video = (_a = response.data.items) === null || _a === void 0 ? void 0 : _a[0];
        if (!video || !video.snippet || !video.contentDetails) {
            console.warn(`No video found with ID: ${videoId}`);
            return null;
        }
        // Normalize the data into our desired shape
        const details = {
            id: video.id,
            title: video.snippet.title,
            description: video.snippet.description,
            thumbnailUrl: ((_c = (_b = video.snippet.thumbnails) === null || _b === void 0 ? void 0 : _b.high) === null || _c === void 0 ? void 0 : _c.url) || ((_e = (_d = video.snippet.thumbnails) === null || _d === void 0 ? void 0 : _d.default) === null || _e === void 0 ? void 0 : _e.url),
            durationMs: parseDurationToMs(video.contentDetails.duration),
        };
        return details;
    }
    catch (error) {
        console.error(`Error fetching YouTube video details for ID ${videoId}:`, error);
        // You might want more specific error handling here, but returning null is a safe default
        return null;
    }
});
exports.getYouTubeVideoDetails = getYouTubeVideoDetails;
/**
* Extracts a YouTube video ID from various forms of YouTube URLs.
* @param url The YouTube URL.
* @returns The extracted video ID, or null if no valid ID is found.
*/
const extractVideoIdFromUrl = (url) => {
    // Regular expression to match various YouTube URL formats
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
};
exports.extractVideoIdFromUrl = extractVideoIdFromUrl;
