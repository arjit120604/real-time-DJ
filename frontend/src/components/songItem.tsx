
import { Button } from "@/components/ui/button"
import { ThumbsUp } from "lucide-react"

interface Song {
  id: string
  title: string
  artist: string
  url: string
  votes: number
  addedBy: string
  thumbnail: string
}

interface SongItemProps {
  song: Song
  index: number
  onUpvote: (songId: string) => void
}

export function SongItem({ song, index, onUpvote }: SongItemProps) {
  return (
    <div className="`flex items-center space-x-4 p-4 rounded-lg hover:bg-gray-50 transition-colors">
      <div className="text-lg font-bold text-gray-400 w-8 text-center">{index + 1}</div>

      <img src={song.thumbnail || "/placeholder.svg"} alt={song.title} className="w-12 h-12 rounded-lg object-cover" />

      <div className="flex-1 min-w-0">
        <h3 className="font-semibold truncate">{song.title}</h3>
        <p className="text-sm text-gray-600 truncate">{song.artist}</p>
        <p className="text-xs text-gray-500">Added by {song.addedBy}</p>
      </div>

      <div className="flex items-center space-x-2">
        <Button
          onClick={() => onUpvote(song.id)}
          variant="outline"
          size="sm"
          className="flex items-center space-x-1 hover:bg-green-50 hover:border-green-300"
        >
          <ThumbsUp className="h-4 w-4" />
          <span>{song.votes}</span>
        </Button>
      </div>
    </div>
  )
}
