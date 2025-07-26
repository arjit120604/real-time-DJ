import { useRef, useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Music } from "lucide-react";
import { useAuth } from '@/contexts/authContext'
import { socket } from '@/lib/io'

type LoginMode = 'login' | 'guest-join';

export default function LoginPage() {
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const guestUsernameRef = useRef<HTMLInputElement>(null);
  const roomIdRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { login, setGuestUser } = useAuth();
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<LoginMode>('login');
  const [redirectMessage, setRedirectMessage] = useState<string>("");

  // Check for redirect message from RegisteredUserRoute
  useEffect(() => {
    const state = location.state as { message?: string; suggestedAction?: string } | null;
    if (state?.message) {
      setRedirectMessage(state.message);
      if (state.suggestedAction === 'SIGN_UP') {
        setMode('login'); // Keep on login mode but show the message
      }
    }
  }, [location.state]);

  // Cleanup effect for component unmount
  useEffect(() => {
    return () => {
      // Remove any lingering socket listeners when component unmounts
      socket.off('roomState');
      socket.off('error');
    };
  }, []);

  const handleLogin = async () => {
    const username = usernameRef.current?.value || "";
    const password = passwordRef.current?.value || "";

    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await login(username, password);
      navigate("/");
    } catch (error: any) {
      console.error("Login failed:", error);
      setError(error.response?.data?.message || "Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestJoin = async () => {
    const username = guestUsernameRef.current?.value || "";
    const roomId = roomIdRef.current?.value || "";

    if (!username.trim() || !roomId.trim()) {
      setError("Please enter both username and room ID");
      return;
    }

    setIsLoading(true);
    setError("");

    let timeoutId: NodeJS.Timeout | null = null;
    let onRoomState: ((roomState: any) => void) | null = null;
    let onError: ((error: any) => void) | null = null;

    try {
      // Create a promise to handle the socket response
      const joinRoomPromise = new Promise<void>((resolve, reject) => {
        // Set up one-time listeners for the response
        onRoomState = (roomState: any) => {
          console.log('Guest successfully joined room, received roomState:', roomState);
          resolve();
        };

        onError = (error: any) => {
          reject(new Error(error.message || 'Failed to join room'));
        };

        socket.on('roomState', onRoomState);
        socket.on('error', onError);

        // Emit the guest join request
        socket.emit('joinRoom', {
          roomId: roomId.trim(),
          username: username.trim(),
          isGuest: true
        });
      });

      // Wait for the socket response with a timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('Request timed out'));
        }, 10000);
      });

      await Promise.race([joinRoomPromise, timeoutPromise]);

      // Set guest user in auth context
      setGuestUser(username.trim(), roomId.trim());

      // Navigate to the room
      navigate(`/room/${roomId.trim()}`);
    } catch (error: any) {
      console.error("Guest join failed:", error);
      setError(error.message || "Failed to join room. Please check the room ID and try again.");
    } finally {
      // Comprehensive cleanup
      setIsLoading(false);

      // Clear timeout if it exists
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      // Remove socket event listeners
      if (onRoomState) {
        socket.off('roomState', onRoomState);
        onRoomState = null;
      }
      if (onError) {
        socket.off('error', onError);
        onError = null;
      }
    }
  };

  return (
    <div className="w-screen min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="border-2 border-purple-200">
          <CardHeader className="text-center">
            <div className="flex justify-center items-center space-x-2 mb-4">
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-2 rounded-lg">
                <Music className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                SyncTunes
              </h1>
            </div>
            <CardTitle>
              {mode === 'login' ? 'Welcome Back!' : 'Join as Guest'}
            </CardTitle>
            <CardDescription>
              {mode === 'login'
                ? 'Log in to your account to continue'
                : 'Enter an existing room without creating an account'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Mode Toggle */}
            <div className="flex space-x-2 mb-4">
              <Button
                variant={mode === 'login' ? 'default' : 'outline'}
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
                className="flex-1"
              >
                Login
              </Button>
              <Button
                variant={mode === 'guest-join' ? 'default' : 'outline'}
                onClick={() => {
                  setMode('guest-join');
                  setError('');
                }}
                className="flex-1"
              >
                Join as Guest
              </Button>
            </div>

            {mode === 'login' ? (
              <>
                {redirectMessage && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
                    <div className="text-yellow-800 text-sm text-center">
                      {redirectMessage}
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Input
                    placeholder="Username"
                    defaultValue=""
                    ref={usernameRef}
                  />
                </div>
                <div className="space-y-2">
                  <Input
                    type="password"
                    placeholder="Password"
                    defaultValue=""
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                    ref={passwordRef}
                  />
                </div>
                {error && (
                  <div className="text-red-500 text-sm text-center">
                    {error}
                  </div>
                )}
                <Button
                  onClick={handleLogin}
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                >
                  {isLoading ? "Logging in..." : "Log In"}
                </Button>
                <div className="text-center text-sm text-gray-600">
                  Don't have an account?{" "}
                  <Link to="/signup" className="text-purple-600 hover:underline">
                    Sign up
                  </Link>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Input
                    placeholder="Your username"
                    defaultValue=""
                    ref={guestUsernameRef}
                  />
                </div>
                <div className="space-y-2">
                  <Input
                    placeholder="Room ID"
                    defaultValue=""
                    onKeyDown={(e) => e.key === "Enter" && handleGuestJoin()}
                    ref={roomIdRef}
                  />
                </div>
                {error && (
                  <div className="text-red-500 text-sm text-center">
                    {error}
                  </div>
                )}
                <Button
                  onClick={handleGuestJoin}
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700"
                >
                  {isLoading ? "Joining room..." : "Join Room as Guest"}
                </Button>
                <div className="text-center text-sm text-gray-600">
                  Want full access?{" "}
                  <Link to="/signup" className="text-purple-600 hover:underline">
                    Create an account
                  </Link>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
