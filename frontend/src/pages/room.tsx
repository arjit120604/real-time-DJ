import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Music, Users, ThumbsUp, Plus, Copy, Check, ArrowLeft, Play, Pause } from "lucide-react"
import { Link, useParams } from "react-router-dom"
import { socket } from '@/lib/io'

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
  const roomId = params.roomId as string

  const [songs, setSongs] = useState<Song[]>([])
  const [newSongUrl, setNewSongUrl] = useState("")
  const [connectedUsers, setConnectedUsers] = useState<User[]>([])
  const [copied, setCopied] = useState(false)
  const [currentlyPlaying, setCurrentlyPlaying] = useState<Song | null>(null)
  const [isPlaying, setIsPlaying] = useState(true)

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
    const userId = 'user-' + Date.now();
    socket.emit('joinRoom', { roomId, userId })

    socket.on('roomState', (state) => {
      const transformedSongs = state.playlist.map(transformSong);
      setSongs(transformedSongs);
      setConnectedUsers(state.users.map((id: string) => ({ id, username: `User-${id.substring(0, 4)}` })));
      if (state.currentSong) {
        setCurrentlyPlaying(transformSong(state.currentSong));
      } else {
        setCurrentlyPlaying(null);
      }
    });

    socket.on('playlistUpdated', (playlist) => {
      const transformedSongs = playlist.map(transformSong);
      setSongs(transformedSongs)
    })

    socket.on('playNewSong', (data) => {
      if (data && data.song) {
        setCurrentlyPlaying(transformSong(data.song));
        setIsPlaying(true);
      } else {
        setCurrentlyPlaying(null);
      }
    });

    socket.on('userJoined', (user) => {
      setConnectedUsers((prev) => [...prev, { id: user.userId, username: user.username }]);
    });

    socket.on('userLeft', ({ userId }) => {
      setConnectedUsers((prev) => prev.filter((u) => u.id !== userId));
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error.message)
      alert('Error: ' + error.message)
    })

    return () => {
      socket.off('roomState');
      socket.off('playlistUpdated');
      socket.off('playNewSong');
      socket.off('userJoined');
      socket.off('userLeft');
      socket.off('error');
    }
  }, [roomId, transformSong])

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
    setIsPlaying(!isPlaying)
    // If we are pausing, and we are at the end of the song, we should probably play the next one.
    // This logic can be improved, for now, we just toggle.
    // A better approach would be to use the YouTube player API to detect when a song ends.
    // For now, let's assume clicking "play" after it's paused and finished goes to next.
    if (!isPlaying) {
        // Let's assume the user wants the next song if they click play when paused.
        // This is a simplification.
        handleNextSong();
    }
  }

  const sortedSongs = [...songs].sort((a, b) => b.votes - a.votes)

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
                <CardContent>
                  <div className="flex items-center space-x-4">
                    <img
                      src={currentlyPlaying.thumbnail || "/placeholder.svg"}
                      alt={currentlyPlaying.title}
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{currentlyPlaying.title}</h3>
                      <p className="text-sm text-gray-600 truncate">{currentlyPlaying.artist}</p>
                      <p className="text-xs text-gray-500">Added by {currentlyPlaying.addedBy}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-center">
                    <Button
                      onClick={togglePlayPause}
                      size="lg"
                      className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                    >
                      {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
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
                  {connectedUsers.map((user) => (
                    <div key={user.id} className="flex items-center space-x-2">
                      <div className="w-6 h-6 bg-gradient-to-r from-purple-400 to-blue-400 rounded-full flex items-center justify-center text-white text-xs font-medium">
                        {user.username[0]}
                      </div>
                      <span className="text-sm">{user.username}</span>
                      {user.id.startsWith('user-') && (
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
