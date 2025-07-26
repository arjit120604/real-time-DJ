import { createContext, useState, useContext, useEffect } from "react";
import api from "@/lib/axios";
import { cleanupSocketState, clearRoomContext } from "@/lib/io";

type RegisteredUser = {
  id: string;
  username: string;
  isGuest: false;
};

type GuestUser = {
  id: string;
  username: string;
  isGuest: true;
  allowedRoomId: string;
};

type User = RegisteredUser | GuestUser;

type AuthContextType = {
  isAuthenticated: boolean;
  user: User | null;
  isGuest: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  setGuestUser: (username: string, roomId: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const isGuest = user?.isGuest || false;

  // Check for existing token and validate it on mount
  useEffect(() => {
    const validateToken = async () => {
      const token = localStorage.getItem('jwt');
      const storedUser = localStorage.getItem('user');
      const guestUser = localStorage.getItem('guestUser');

      // Check for guest user first
      if (guestUser) {
        try {
          const guestData = JSON.parse(guestUser);
          setUser({ ...guestData, isGuest: true });
          setIsAuthenticated(true);
          setIsLoading(false);
          return;
        } catch (error) {
          localStorage.removeItem('guestUser');
        }
      }

      // Check for registered user
      if (token && storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          
          // Validate token with server
          const response = await api.get('/auth/validate');
          
          if (response.data.valid) {
            setUser({ ...userData, isGuest: false });
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
        // Clear any guest user data
        localStorage.removeItem('guestUser');
        setUser({ ...res.data.user, isGuest: false });
        setIsAuthenticated(true);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error; // Re-throw so the login page can handle it
    }
  };

  const setGuestUser = (username: string, roomId: string) => {
    const guestUser: GuestUser = {
      id: `guest_${Date.now()}`,
      username,
      isGuest: true,
      allowedRoomId: roomId
    };
    
    localStorage.setItem('guestUser', JSON.stringify(guestUser));
    // Clear any registered user data
    localStorage.removeItem('jwt');
    localStorage.removeItem('user');
    setUser(guestUser);
    setIsAuthenticated(true);
  };

  const logout = () => {
    // Clear local storage
    localStorage.removeItem('jwt');
    localStorage.removeItem('user');
    localStorage.removeItem('guestUser');
    
    // Clear socket state and room context
    cleanupSocketState();
    clearRoomContext();
    
    // Clear auth state
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, isGuest, isLoading, login, setGuestUser, logout }}>
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