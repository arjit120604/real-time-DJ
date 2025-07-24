import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/authContext";

export default function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();

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

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}
