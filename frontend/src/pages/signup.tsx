import { useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Music } from "lucide-react";
import { useAuth } from "@/contexts/authContext";
import api from "@/lib/axios";

export default function SignUpPage() {
  const nameRef = useRef<HTMLInputElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSignUp = async () => {
    const name = nameRef.current?.value || "";
    const username = usernameRef.current?.value || "";
    const password = passwordRef.current?.value || "";
    if (name.trim() && username.trim() && password.trim()) {
      const res = await api.post('/auth/register', {name, username, password});
      if (res.data.token) {
        await login(username, password);
        navigate("/");
      }
      // Optionally, handle error cases here
    }
  };

  return (
    <div className="w-screen min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="border-2 border-blue-200">
          <CardHeader className="text-center">
            <div className="flex justify-center items-center space-x-2 mb-4">
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-2 rounded-lg">
                <Music className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                SyncTunes
              </h1>
            </div>
            <CardTitle>Create an Account</CardTitle>
            <CardDescription>Join the party and start listening together</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Input
                placeholder="Name"
                ref={nameRef}
              />
            </div>
            <div className="space-y-2">
              <Input
                placeholder="Username"
                ref={usernameRef}
              />
            </div>
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Password"
                ref={passwordRef}
                onKeyDown={(e) => e.key === "Enter" && handleSignUp()}
              />
            </div>
            <Button
              onClick={handleSignUp}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              Sign Up
            </Button>
            <div className="text-center text-sm text-gray-600">
              Already have an account?{" "}
              <Link to="/login" className="text-purple-600 hover:underline">
                Log in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
