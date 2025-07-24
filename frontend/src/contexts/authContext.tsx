import { createContext, useState, useContext, useEffect } from "react";
import api from "@/lib/axios";

type User = {
  id: string;
  username: string;
};

type AuthContextType = {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing token and validate it on mount
  useEffect(() => {
    const validateToken = async () => {
      const token = localStorage.getItem('jwt');
      const storedUser = localStorage.getItem('user');

      if (token && storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          
          // Validate token with server
          const response = await api.get('/auth/validate');
          
          if (response.data.valid) {
            setUser(userData);
            setIsAuthenticated(true);
          } else {
            // Token is invalid, clear it
            localStorage.removeItem('jwt');
            localStorage.removeItem('user');
          }
        } catch (error) {
          // Token validation failed or invalid stored data, clear it
          localStorage.removeItem('jwt');
          localStorage.removeItem('user');
        }
      }
      
      setIsLoading(false);
    };

    validateToken();
  }, []);

  const login = async (username: string, password: string): Promise<void> => {
    try {
      const res = await api.post('/auth/login', { username, password });
      console.log('Login response:', res.data); // Debug log
      
      if (res.data.token && res.data.user) {
        localStorage.setItem('jwt', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        setUser(res.data.user);
        setIsAuthenticated(true);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error; // Re-throw so the login page can handle it
    }
  };

  const logout = () => {
    localStorage.removeItem('jwt');
    localStorage.removeItem('user');
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, isLoading, login, logout }}>
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