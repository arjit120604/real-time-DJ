import { Routes, Route } from "react-router-dom";
import LandingPage from "@/pages/landing";
import RoomPage from "@/pages/room";
import LoginPage from "@/pages/login";
import SignUpPage from "@/pages/signup";
import HomePage from "@/pages/home";
import ProtectedRoute from "@/components/protectedRoute";

function NotFound() {
  return <div>404 - Page Not Found</div>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/room/:roomId" element={<RoomPage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
