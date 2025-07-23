import { useEffect, useRef } from 'react'
import YouTube, { type YouTubeProps } from 'react-youtube'

interface YouTubePlayerProps {
    videoId: string
    isPlaying: boolean
    onEnd: () => void
    startTime?: number // Add startTime prop for sync
    seekToTime?: number // Add seekToTime prop for pause/resume sync
}

export default function YouTubePlayer({
    videoId,
    isPlaying,
    onEnd,
    startTime,
    seekToTime
}: YouTubePlayerProps) {
    const playerRef = useRef<any>(null)
    const hasSeekOnLoad = useRef<boolean>(false)

    const opts: YouTubeProps['opts'] = {
        height: '200',
        width: '100%',
        playerVars: {
            autoplay: 1,
            controls: 0, // Hide YouTube controls since we have our own
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
            modestbranding: 1,
            rel: 0,
            showinfo: 0,
        },
    }

    const onReady: YouTubeProps['onReady'] = (event) => {
        playerRef.current = event.target

        // If we have a startTime, seek to that position for sync
        if (startTime && startTime > 0) {
            event.target.seekTo(startTime, true)
            hasSeekOnLoad.current = true
        }

        if (isPlaying) {
            event.target.playVideo()
        }
    }

    const onStateChange: YouTubeProps['onStateChange'] = (event) => {
        // YouTube Player States:
        // -1 (unstarted)
        // 0 (ended)
        // 1 (playing)
        // 2 (paused)
        // 3 (buffering)
        // 5 (video cued)

        if (event.data === 0) { // ended
            onEnd()
        }
        // Note: We don't handle play/pause state changes here anymore
        // since playback state is now controlled by the server for sync
    }

    useEffect(() => {
        if (playerRef.current) {
            if (isPlaying) {
                playerRef.current.playVideo()
            } else {
                playerRef.current.pauseVideo()
            }
        }
    }, [isPlaying])

    // Handle video changes and reset seek flag
    useEffect(() => {
        hasSeekOnLoad.current = false
        if (playerRef.current && startTime && startTime > 0) {
            playerRef.current.seekTo(startTime, true)
            hasSeekOnLoad.current = true
        }
    }, [videoId]) // Only depend on videoId, not startTime

    // Handle seeking to specific time for pause/resume sync
    useEffect(() => {
        if (playerRef.current && seekToTime !== undefined && seekToTime >= 0) {
            console.log('Seeking to time for sync:', seekToTime)
            playerRef.current.seekTo(seekToTime, true)
        }
    }, [seekToTime])

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