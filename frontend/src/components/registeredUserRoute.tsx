import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/authContext";

export default function RegisteredUserRoute() {
  const { isAuthenticated, isGuest, isLoading } = useAuth();

  // Show loading while auth is being validated
  if (isLoading) {
    return (
      <div className="w-screen min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-4 rounded-lg mb-4 inline-block">
            <div className="h-8 w-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated at all, redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If authenticated but is a guest user, redirect to login with message
  if (isGuest) {
    return <Navigate to="/login" replace state={{ 
      message: "Room creation requires a registered account. Please sign up to create rooms.",
      suggestedAction: "SIGN_UP"
    }} />;
  }

  // If authenticated and not a guest (i.e., registered user), allow access
  return <Outlet />;
}