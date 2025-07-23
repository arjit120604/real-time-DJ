import { useState,useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Music, Users, Plus } from "lucide-react";
import { useAuth } from "@/contexts/authContext";
import api from "@/lib/axios";


export default function HomePage() {
  const [roomCode, setRoomCode] = useState("");
  // const [roomName, setRoomName] = useState("");
  const roomNameRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { logout } = useAuth();

  const createRoom = async () => {
    const roomName = roomNameRef.current?.value || "";
    if (roomName.trim()) {
      try {
        const response = await api.post("/rooms/rooms", { id: roomName.trim() });
        const newRoomId = response.data.id;
        navigate(`/room/${newRoomId}`);
      } catch (error) {
        console.error("Error creating room:", error);
        // Optionally, show an error message to the user
      }
    }
  };

  const joinRoom = () => {
    if (roomCode.trim()) {
      navigate(`/room/${roomCode.trim().toUpperCase()}`);
    }
  };

  return (
    <div className="w-screen min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-2 rounded-lg">
                <Music className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                SyncTunes
              </h1>
            </div>
            <Button onClick={logout} variant="outline">
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <h2 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Listen Together,
            <br />
            Anywhere
          </h2>
          <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
            Create virtual music rooms, share YouTube songs, and let your community vote on what plays next. Perfect for
            parties, study sessions, or just hanging out with friends.
          </p>

          {/* Room Actions */}
          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto mb-16">
            <Card className="border-2 border-purple-200 hover:border-purple-300 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center justify-center space-x-2">
                  <Plus className="h-5 w-5" />
                  <span>Create Room</span>
                </CardTitle>
                <CardDescription>Start a new music session and invite friends</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="Enter a name for your room"
                  onKeyDown={(e) => e.key === "Enter" && createRoom()}
                  className="text-center text-lg"
                  ref={roomNameRef}
                />
                <Button
                  onClick={createRoom}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                  size="lg"
                  // disabled={!roomName.trim()}
                >
                  Create New Room
                </Button>
              </CardContent>
            </Card>

            <Card className="border-2 border-blue-200 hover:border-blue-300 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center justify-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>Join Room</span>
                </CardTitle>
                <CardDescription>Enter a room code to join an existing session</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="Enter room code"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && joinRoom()}
                  className="text-center font-mono text-lg"
                />
                <Button
                  onClick={joinRoom}
                  variant="outline"
                  className="w-full border-blue-300 text-blue-600 hover:bg-blue-50 bg-transparent"
                  size="lg"
                  disabled={!roomCode.trim()}
                >
                  Join Room
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
