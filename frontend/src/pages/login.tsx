import { useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Music } from "lucide-react";
import { useAuth } from '@/contexts/authContext'

export default function LoginPage() {
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async () => {
    const username = usernameRef.current?.value || "";
    const password = passwordRef.current?.value || "";

    if (username.trim() && password.trim()) {
      await login(username, password);
      navigate("/");
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
            <CardTitle>Welcome Back!</CardTitle>
            <CardDescription>Log in to your account to continue</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
            <Button
              onClick={handleLogin}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              // disabled={!usernameRef.current.trim() && !passwordRef.current.trim()}

            >
              Log In
            </Button>
            <div className="text-center text-sm text-gray-600">
              Don't have an account?{" "}
              <Link to="/signup" className="text-purple-600 hover:underline">
                Sign up
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
