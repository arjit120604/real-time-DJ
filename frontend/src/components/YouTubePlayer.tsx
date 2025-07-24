import { useEffect, useRef, useState } from 'react'
import YouTube, { type YouTubeProps } from 'react-youtube'

// Configuration constants for sync behavior
const SYNC_THRESHOLD_SECONDS = 2      // Minimum drift before seeking
const USER_SEEK_DETECTION_THRESHOLD = 3  // Threshold for detecting user seeks
const SYNC_CHECK_INTERVAL_MS = 1000   // How often to check for user seeks

interface YouTubePlayerProps {
    videoId: string
    isPlaying: boolean
    onEnd: () => void
    playbackStartUtc?: number // Single source of timeline truth
    onSeek?: (seekToMs: number) => void // Callback for user-initiated seeks
}

export default function YouTubePlayer({
    videoId,
    isPlaying,
    onEnd,
    playbackStartUtc,
    onSeek
}: YouTubePlayerProps) {
    const playerRef = useRef<any>(null)
    const [isProgrammaticSeek, setIsProgrammaticSeek] = useState(false)
    const lastKnownPositionRef = useRef<number>(0)

    const opts: YouTubeProps['opts'] = {
        height: '200',
        width: '100%',
        playerVars: {
            autoplay: 1,
            controls: 1, // Enable controls to allow user seeking
            disablekb: 0, // Enable keyboard controls for seeking
            fs: 0,
            iv_load_policy: 3,
            modestbranding: 1,
            rel: 0,
            showinfo: 0,
        },
    }

    // Calculate expected playback position based on playbackStartUtc
    const calculateExpectedPosition = (): number => {
        if (!playbackStartUtc || !isPlaying) return 0
        return Math.max(0, (Date.now() - playbackStartUtc) / 1000)
    }

    // Helper function to perform programmatic seeks
    const performProgrammaticSeek = (seekToSeconds: number) => {
        if (playerRef.current) {
            setIsProgrammaticSeek(true)
            lastKnownPositionRef.current = seekToSeconds
            playerRef.current.seekTo(seekToSeconds, true)
            // Reset flag after a short delay to allow for the seek to complete
            setTimeout(() => setIsProgrammaticSeek(false), 500)
        }
    }

    const onReady: YouTubeProps['onReady'] = (event) => {
        playerRef.current = event.target
        
        // Initial sync when player is ready
        if (playbackStartUtc && isPlaying) {
            const seekToSeconds = calculateExpectedPosition()
            performProgrammaticSeek(seekToSeconds)
        }
        
        // Set initial playback state
        if (isPlaying) {
            event.target.playVideo()
        } else {
            event.target.pauseVideo()
        }
    }

    const onStateChange: YouTubeProps['onStateChange'] = (event) => {
        if (event.data === 0) { // ended
            onEnd()
        }
    }

    // Single robust synchronization effect - handles all timing logic
    useEffect(() => {
        if (!playerRef.current) return

        // Handle play/pause state
        if (isPlaying) {
            playerRef.current.playVideo()
        } else {
            playerRef.current.pauseVideo()
            return // Don't sync position when paused
        }

        // Handle position synchronization when playing
        if (playbackStartUtc) {
            const expectedPosition = calculateExpectedPosition()
            const currentPosition = playerRef.current.getCurrentTime()
            const timeDiff = Math.abs(currentPosition - expectedPosition)
            
            // Only seek if significantly out of sync to avoid constant micro-adjustments
            if (timeDiff > SYNC_THRESHOLD_SECONDS) {
                console.log('Syncing to timeline:', expectedPosition, 'current:', currentPosition, 'diff:', timeDiff)
                performProgrammaticSeek(expectedPosition)
            }
            
            // Update last known position for user seek detection
            lastKnownPositionRef.current = expectedPosition
        }
    }, [playbackStartUtc, isPlaying])

    // Detect user-initiated seeks by polling the player's current time
    useEffect(() => {
        if (!playerRef.current || !onSeek) return

        const checkForUserSeek = () => {
            if (playerRef.current && !isProgrammaticSeek && isPlaying) {
                const currentTime = playerRef.current.getCurrentTime()
                const expectedTime = calculateExpectedPosition()

                // Check if user has manually seeked (significant difference from expected position)
                const timeDiff = Math.abs(currentTime - expectedTime)
                const hasUserSeeked = timeDiff > USER_SEEK_DETECTION_THRESHOLD && 
                                   Math.abs(currentTime - lastKnownPositionRef.current) > 1

                if (hasUserSeeked) {
                    console.log('User seek detected:', currentTime, 'expected:', expectedTime)
                    lastKnownPositionRef.current = currentTime
                    onSeek(Math.round(currentTime * 1000)) // Convert to milliseconds
                }
            }
        }

        const interval = setInterval(checkForUserSeek, SYNC_CHECK_INTERVAL_MS)
        return () => clearInterval(interval)
    }, [playbackStartUtc, isPlaying, isProgrammaticSeek, onSeek])

    return (
        <div className="w-full rounded-lg overflow-hidden">
            <YouTube
                videoId={videoId}
                opts={opts}
                onReady={onReady}
                onStateChange={onStateChange}
            />
        </div>
    )
}

// Export utility functions for testing
export { SYNC_THRESHOLD_SECONDS, USER_SEEK_DETECTION_THRESHOLD, SYNC_CHECK_INTERVAL_MS }