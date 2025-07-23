import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Music, Users, ThumbsUp, Plus, Copy, Check, ArrowLeft, Play, Pause, SkipForward } from "lucide-react"
import { Link, useParams, useNavigate } from "react-router-dom"
import { socket } from '@/lib/io'
import { useAuth } from '@/contexts/authContext'
import YouTubePlayer from '@/components/YouTubePlayer'

interface Song {
  id: string
  title: string
  artist: string
  url: string
  votes: number
  addedBy: string
  thumbnail: string
}

interface User {
  id: string;
  username: string;
}

export default function RoomPage() {
  const params = useParams()
  const navigate = useNavigate()
  const roomId = params.roomId as string
  const { isAuthenticated, user } = useAuth()

  const [songs, setSongs] = useState<Song[]>([])
  const [newSongUrl, setNewSongUrl] = useState("")
  const [connectedUsers, setConnectedUsers] = useState<User[]>([])
  const [copied, setCopied] = useState(false)
  const [currentlyPlaying, setCurrentlyPlaying] = useState<Song | null>(null)
  const [isPlaying, setIsPlaying] = useState(true)
  const [playbackStartTime, setPlaybackStartTime] = useState<number | null>(null)
  const [seekToTime, setSeekToTime] = useState<number | undefined>(undefined)

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
  }, [isAuthenticated, navigate])

  const transformSong = useCallback((song: any): Song => ({
    id: song.id,
    title: song.title,
    artist: 'Unknown Artist', // Backend doesn't have artist field
    url: `https://youtube.com/watch?v=${song.id}`,
    votes: song.score || 0,
    addedBy: 'User', // Backend doesn't have this, might need to add later
    thumbnail: song.thumbnailUrl || "/placeholder.svg?height=60&width=60"
  }), []);


  useEffect(() => {
    if (!user) return; // Don't join room if user is not available

    console.log('Joining room:', roomId, 'with user:', user.username);
    
    // Test socket connection first
    socket.emit('joinRoom', { roomId, userId: user.id, username: user.username });
    
    // Add timeout to detect if roomState is not received
    let roomStateTimeout: NodeJS.Timeout;
    roomStateTimeout = setTimeout(() => {
      console.error('No roomState received within 5 seconds - possible connection issue');
      // Try rejoining
      socket.emit('joinRoom', { roomId, userId: user.id, username: user.username });
    }, 5000);

    socket.on('roomState', (state: any) => {
      if (roomStateTimeout) clearTimeout(roomStateTimeout); // Clear the timeout since we received roomState
      console.log('Received roomState:', {
        playlistLength: state.playlist?.length || 0,
        userCount: state.users?.length || 0,
        currentSong: state.currentSong?.title || 'none',
        isPlaying: state.isPlaying
      });
      
      if (state.playlist && Array.isArray(state.playlist)) {
        const transformedSongs = state.playlist.map(transformSong);
        console.log('Setting songs:', transformedSongs);
        setSongs(transformedSongs);
      } else {
        console.log('No playlist in roomState or playlist is not an array');
        setSongs([]);
      }
      
      if (state.users && Array.isArray(state.users)) {
        setConnectedUsers(state.users.map((user: any) => ({ id: user.id, username: user.username })));
      } else {
        console.log('No users in roomState or users is not an array');
        setConnectedUsers([]);
      }
      
      if (state.currentSong) {
        console.log('Setting currently playing:', state.currentSong);
        setCurrentlyPlaying(transformSong(state.currentSong));
        setIsPlaying(state.isPlaying !== false); // Default to true if not specified
        
        // Set playback start time for sync
        if (state.isPlaying && state.playbackStartUtc) {
          setPlaybackStartTime(state.playbackStartUtc);
        } else if (!state.isPlaying && state.pausedAt) {
          // If paused, use the paused position directly
          setPlaybackStartTime(Date.now() - state.pausedAt);
        } else if (state.playbackStartUtc) {
          setPlaybackStartTime(state.playbackStartUtc);
        }
        
        // Set exact playback time for immediate sync when joining
        if (state.currentPlaybackTime !== undefined) {
          setSeekToTime(state.currentPlaybackTime);
          // Clear seekToTime after a short delay to avoid repeated seeks
          setTimeout(() => setSeekToTime(undefined), 100);
        }
      } else {
        console.log('No current song in roomState');
        setCurrentlyPlaying(null);
        setPlaybackStartTime(null);
        setIsPlaying(false);
      }
    });

    socket.on('playlistUpdated', (playlist: any[]) => {
      console.log('Received playlistUpdated:', playlist);
      const transformedSongs = playlist.map(transformSong);
      console.log('Transformed songs:', transformedSongs);
      setSongs(transformedSongs)
    })

    socket.on('playNewSong', (data: any) => {
      console.log('Received playNewSong event:', data);
      if (data && data.song) {
        const transformedSong = transformSong(data.song);
        console.log('Setting currently playing to:', transformedSong);
        setCurrentlyPlaying(transformedSong);
        setIsPlaying(data.isPlaying !== false);

        // Set playback start time for sync
        if (data.playbackStartUtc) {
          setPlaybackStartTime(data.playbackStartUtc);
        }

        // Remove the currently playing song from the queue if it exists
        setSongs(prevSongs => {
          const filteredSongs = prevSongs.filter(song => song.id !== transformedSong.id);
          console.log('Filtered songs after removing currently playing:', filteredSongs);
          return filteredSongs;
        });
      } else {
        setCurrentlyPlaying(null);
        setPlaybackStartTime(null);
      }
    });

    socket.on('playbackStateChanged', (data: any) => {
      console.log('Received playbackStateChanged event:', data);
      setIsPlaying(data.isPlaying);
      if (data.playbackStartUtc) {
        setPlaybackStartTime(data.playbackStartUtc);
      }
      // Set the exact playback time for sync when pause/resume happens
      if (data.currentPlaybackTime !== undefined) {
        setSeekToTime(data.currentPlaybackTime);
        // Clear seekToTime after a short delay to avoid repeated seeks
        setTimeout(() => setSeekToTime(undefined), 100);
      }
    });

    socket.on('noSongAvailable', () => {
      setCurrentlyPlaying(null);
      setIsPlaying(false);
      setPlaybackStartTime(null);
    });

    socket.on('userJoined', (user: any) => {
      setConnectedUsers((prev) => [...prev, { id: user.userId, username: user.username }]);
    });

    socket.on('userLeft', ({ userId }: { userId: string }) => {
      setConnectedUsers((prev) => prev.filter((u) => u.id !== userId));
    });

    socket.on('usersUpdated', (users: any[]) => {
      setConnectedUsers(users);
    });

    socket.on('error', (error: any) => {
      console.error('Socket error:', error.message)
      alert('Error: ' + error.message)
    })

    return () => {
      console.log('Leaving room:', roomId);
      socket.emit('leaveRoom', { roomId, userId: user?.id });
      socket.off('roomState');
      socket.off('playlistUpdated');
      socket.off('playNewSong');
      socket.off('playbackStateChanged');
      socket.off('noSongAvailable');
      socket.off('userJoined');
      socket.off('userLeft');
      socket.off('usersUpdated');
      socket.off('error');
    }
  }, [roomId, transformSong, user])

  const copyRoomLink = async () => {
    const roomLink = `${window.location.origin}/room/${roomId}`
    await navigator.clipboard.writeText(roomLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const extractVideoId = (url: string): string | null => {
    const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/
    const match = url.match(regex)
    return match ? match[1] : null
  }

  const addSong = () => {
    if (!newSongUrl.trim()) return

    const videoId = extractVideoId(newSongUrl)
    if (!videoId) {
      alert('Please enter a valid YouTube URL')
      return
    }

    console.log('Emitting addSong:', { roomId, videoId })
    socket.emit('addSong', { roomId, videoId })
    setNewSongUrl("")
  }

  const upvoteSong = (songId: string) => {
    socket.emit('voteSong', { roomId, songId, vote: 1 });
  }

  const handleNextSong = () => {
    socket.emit('playNextSong', { roomId });
  }

  const togglePlayPause = () => {
    // Send toggle request to server for sync across all users
    socket.emit('togglePlayPause', { roomId, isPlaying: !isPlaying })
  }

  const sortedSongs = [...songs].sort((a, b) => b.votes - a.votes)

  // Calculate current playback position for sync (memoized to prevent constant recalculation)
  const [syncStartTime, setSyncStartTime] = useState<number>(0)
  
  useEffect(() => {
    if (playbackStartTime) {
      const elapsedMs = Date.now() - playbackStartTime
      setSyncStartTime(Math.max(0, Math.floor(elapsedMs / 1000)))
    } else {
      setSyncStartTime(0)
    }
  }, [playbackStartTime, currentlyPlaying?.id]) // Only recalculate when playback starts or song changes

  return (
    <div className="w-screen min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                to="/"
                className="flex items-center space-x-2 text-gray-600 hover:text-purple-600 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
                <span>Back</span>
              </Link>
              <div className="flex items-center space-x-2">
                <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-2 rounded-lg">
                  <Music className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Room {roomId}</h1>
                  <p className="text-sm text-gray-500">{connectedUsers.length} users connected</p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="hidden md:flex items-center space-x-2">
                <Users className="h-4 w-4 text-gray-500" />
                <div className="flex -space-x-2">
                  {connectedUsers.slice(0, 3).map((user) => (
                    <div
                      key={user.id}
                      className="w-8 h-8 bg-gradient-to-r from-purple-400 to-blue-400 rounded-full flex items-center justify-center text-white text-xs font-medium border-2 border-white"
                    >
                      {user.username[0]}
                    </div>
                  ))}
                  {connectedUsers.length > 3 && (
                    <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center text-white text-xs font-medium border-2 border-white">
                      +{connectedUsers.length - 3}
                    </div>
                  )}
                </div>
              </div>

              <Button
                onClick={copyRoomLink}
                variant="outline"
                size="sm"
                className="flex items-center space-x-2 bg-transparent"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span>{copied ? "Copied!" : "Share Room"}</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Now Playing & Add Song */}
          <div className="lg:col-span-1 space-y-6">
            {/* Now Playing */}
            {currentlyPlaying ? (
              <Card className="border-2 border-purple-200">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Play className="h-5 w-5 text-purple-600" />
                    <span>Now Playing</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* YouTube Player */}
                  <YouTubePlayer
                    videoId={currentlyPlaying.id}
                    isPlaying={isPlaying}
                    onEnd={handleNextSong}
                    startTime={syncStartTime}
                    seekToTime={seekToTime}
                  />

                  {/* Song Info */}
                  <div className="flex items-center space-x-4">
                    <img
                      src={currentlyPlaying.thumbnail || "/placeholder.svg"}
                      alt={currentlyPlaying.title}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{currentlyPlaying.title}</h3>
                      <p className="text-sm text-gray-600 truncate">{currentlyPlaying.artist}</p>
                      <p className="text-xs text-gray-500">Added by {currentlyPlaying.addedBy}</p>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center justify-center space-x-2">
                    <Button
                      onClick={togglePlayPause}
                      size="lg"
                      className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                    >
                      {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                    </Button>
                    <Button
                      onClick={handleNextSong}
                      variant="outline"
                      size="lg"
                      className="border-purple-200 hover:bg-purple-50"
                    >
                      <SkipForward className="h-5 w-5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-2 border-gray-200">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Music className="h-5 w-5 text-gray-600" />
                    <span>Nothing Playing</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-center text-gray-500">The queue is empty. Add a song to start the party!</p>
                </CardContent>
              </Card>
            )}

            {/* Add Song */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Plus className="h-5 w-5" />
                  <span>Add Song</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Paste YouTube URL here..."
                  value={newSongUrl}
                  onChange={(e) => setNewSongUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addSong()}
                />
                <Button onClick={addSong} className="w-full" disabled={!newSongUrl.trim()}>
                  Add to Queue
                </Button>
                <p className="text-xs text-gray-500 text-center">Songs are automatically sorted by votes</p>
              </CardContent>
            </Card>

            {/* Connected Users */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>Connected Users ({connectedUsers.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {connectedUsers.map((connectedUser) => (
                    <div key={connectedUser.id} className="flex items-center space-x-2">
                      <div className="w-6 h-6 bg-gradient-to-r from-purple-400 to-blue-400 rounded-full flex items-center justify-center text-white text-xs font-medium">
                        {connectedUser.username[0]}
                      </div>
                      <span className="text-sm">{connectedUser.username}</span>
                      {connectedUser.id === user?.id && (
                        <Badge variant="secondary" className="text-xs">
                          You
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Music Queue */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Music className="h-5 w-5" />
                    <span>Music Queue ({songs.length})</span>
                  </div>
                  <Badge variant="outline">Live Updates</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {sortedSongs.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No songs in queue yet</p>
                    <p className="text-sm">Add a YouTube URL to get started!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {sortedSongs.map((song, index) => (
                      <div key={song.id}>
                        <div className="flex items-center space-x-4 p-4 rounded-lg hover:bg-gray-50 transition-colors">
                          <div className="text-lg font-bold text-gray-400 w-8 text-center">{index + 1}</div>

                          <img
                            src={song.thumbnail || "/placeholder.svg"}
                            alt={song.title}
                            className="w-12 h-12 rounded-lg object-cover"
                          />

                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold truncate">{song.title}</h3>
                            <p className="text-sm text-gray-600 truncate">{song.artist}</p>
                            <p className="text-xs text-gray-500">Added by {song.addedBy}</p>
                          </div>

                          <div className="flex items-center space-x-2 bg-white">
                            <Button
                              onClick={() => upvoteSong(song.id)}
                              variant="outline"
                              size="sm"
                              className="flex items-center space-x-1 hover:bg-green-50 hover:border-green-300 bg-white"
                            >
                              <ThumbsUp className="h-4 w-4" />
                              <span>{song.votes}</span>
                            </Button>
                          </div>
                        </div>
                        {index < sortedSongs.length - 1 && <Separator />}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
