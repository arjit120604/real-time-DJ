import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import LoginPage from '../login';
import { AuthProvider } from '@/contexts/authContext';

// Mock the socket
vi.mock('@/lib/io', () => ({
  socket: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  }
}));

// Mock the auth context
const mockLogin = vi.fn();
const mockSetGuestUser = vi.fn();

vi.mock('@/contexts/authContext', async () => {
  const actual = await vi.importActual('@/contexts/authContext');
  return {
    ...actual,
    useAuth: () => ({
      login: mockLogin,
      setGuestUser: mockSetGuestUser,
      isAuthenticated: false,
      user: null,
      isGuest: false,
      isLoading: false,
      logout: vi.fn(),
    }),
  };
});

const renderLoginPage = () => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('LoginPage Guest Join Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render login mode by default', () => {
    renderLoginPage();
    
    expect(screen.getByText('Welcome Back!')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Username')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByText('Log In')).toBeInTheDocument();
  });

  it('should switch to guest join mode when clicking "Join as Guest"', () => {
    renderLoginPage();
    
    const guestButton = screen.getByRole('button', { name: 'Join as Guest' });
    fireEvent.click(guestButton);
    
    expect(screen.getByPlaceholderText('Your username')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Room ID')).toBeInTheDocument();
    expect(screen.getByText('Join Room as Guest')).toBeInTheDocument();
    expect(screen.getByText('Enter an existing room without creating an account')).toBeInTheDocument();
  });

  it('should show validation error when guest form is incomplete', async () => {
    renderLoginPage();
    
    // Switch to guest mode
    const guestButton = screen.getByRole('button', { name: 'Join as Guest' });
    fireEvent.click(guestButton);
    
    // Try to submit without filling fields
    const joinButton = screen.getByText('Join Room as Guest');
    fireEvent.click(joinButton);
    
    await waitFor(() => {
      expect(screen.getByText('Please enter both username and room ID')).toBeInTheDocument();
    });
  });

  it('should have proper form inputs for guest join', () => {
    renderLoginPage();
    
    // Switch to guest mode
    const guestButton = screen.getByRole('button', { name: 'Join as Guest' });
    fireEvent.click(guestButton);
    
    const usernameInput = screen.getByPlaceholderText('Your username');
    const roomIdInput = screen.getByPlaceholderText('Room ID');
    
    expect(usernameInput).toBeInTheDocument();
    expect(roomIdInput).toBeInTheDocument();
    
    // Test that inputs accept values
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(roomIdInput, { target: { value: 'room123' } });
    
    expect(usernameInput).toHaveValue('testuser');
    expect(roomIdInput).toHaveValue('room123');
  });

  it('should switch back to login mode when clicking "Login"', () => {
    renderLoginPage();
    
    // Switch to guest mode first
    const guestButton = screen.getByRole('button', { name: 'Join as Guest' });
    fireEvent.click(guestButton);
    
    expect(screen.getByPlaceholderText('Your username')).toBeInTheDocument();
    
    // Switch back to login mode
    const loginButton = screen.getByRole('button', { name: 'Login' });
    fireEvent.click(loginButton);
    
    expect(screen.getByText('Welcome Back!')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Username')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
  });
});