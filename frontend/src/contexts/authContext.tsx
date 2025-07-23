import { createContext, useState, useContext } from "react";
import api from "@/lib/axios";

type AuthContextType = {
  isAuthenticated: boolean;
  login: (username: string, password: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const login = async (username: string, password: string) => {
    const res = await api.post('/auth/login', {username, password});
    if (res.data.token) {
      localStorage.setItem('jwt', res.data.token);
      setIsAuthenticated(true);
    }
  };

  const logout = () => {
    localStorage.removeItem('jwt');
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

  
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
      throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
  };