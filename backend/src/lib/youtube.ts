import { google } from 'googleapis';
import config from '../config';

export interface YouTubeVideoDetails {
    id: string;
    title: string;
    description: string;
    thumbnailUrl: string;
    durationMs: number;
}
const youtube = google.youtube({
    version: 'v3',
    auth: config.YOUTUBE_API_KEY,
});

/**
 * Parses an ISO 8601 duration string (e.g., "PT2M10S") and returns the duration in milliseconds.
 * @param duration The ISO 8601 duration string.
 * @returns The duration in milliseconds.
 */
const parseDurationToMs = (duration: string): number => {
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
export const getYouTubeVideoDetails = async (
    videoId: string
  ): Promise<YouTubeVideoDetails | null> => {
    try {
      const response = await youtube.videos.list({
        part: ['snippet', 'contentDetails'], // We need snippet for title/thumb and contentDetails for duration
        id: [videoId],
      });
  
      const video = response.data.items?.[0];
  
      if (!video || !video.snippet || !video.contentDetails) {
        console.warn(`No video found with ID: ${videoId}`);
        return null;
      }
  
      // Normalize the data into our desired shape
      const details: YouTubeVideoDetails = {
        id: video.id!,
        title: video.snippet.title!,
        description: video.snippet.description!,
        thumbnailUrl: video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.default?.url!,
        durationMs: parseDurationToMs(video.contentDetails.duration!),
      };
  
      return details;
    } catch (error) {
      console.error(`Error fetching YouTube video details for ID ${videoId}:`, error);
      // You might want more specific error handling here, but returning null is a safe default
      return null;
    }
  };
  /**
 * Extracts a YouTube video ID from various forms of YouTube URLs.
 * @param url The YouTube URL.
 * @returns The extracted video ID, or null if no valid ID is found.
 */
export const extractVideoIdFromUrl = (url: string): string | null => {
    // Regular expression to match various YouTube URL formats
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);

    return match ? match[1] : null;
};