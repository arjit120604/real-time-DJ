import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import RegisteredUserRoute from '../registeredUserRoute';
import { AuthProvider } from '@/contexts/authContext';

// Mock the auth context
const mockAuthContext = {
  isAuthenticated: false,
  user: null,
  isGuest: false,
  isLoading: false,
  login: vi.fn(),
  setGuestUser: vi.fn(),
  logout: vi.fn(),
};

vi.mock('@/contexts/authContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => mockAuthContext,
}));

// Mock Navigate component
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    Navigate: ({ to, state }: { to: string; state?: any }) => (
      <div data-testid="navigate" data-to={to} data-state={JSON.stringify(state)}>
        Navigate to {to}
      </div>
    ),
    Outlet: () => <div data-testid="outlet">Protected Content</div>,
  };
});

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        {component}
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('RegisteredUserRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading when isLoading is true', () => {
    mockAuthContext.isLoading = true;
    mockAuthContext.isAuthenticated = false;
    mockAuthContext.isGuest = false;

    renderWithRouter(<RegisteredUserRoute />);
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should redirect to login when not authenticated', () => {
    mockAuthContext.isLoading = false;
    mockAuthContext.isAuthenticated = false;
    mockAuthContext.isGuest = false;

    renderWithRouter(<RegisteredUserRoute />);
    
    const navigate = screen.getByTestId('navigate');
    expect(navigate).toHaveAttribute('data-to', '/login');
  });

  it('should redirect to login with message when user is a guest', () => {
    mockAuthContext.isLoading = false;
    mockAuthContext.isAuthenticated = true;
    mockAuthContext.isGuest = true;

    renderWithRouter(<RegisteredUserRoute />);
    
    const navigate = screen.getByTestId('navigate');
    expect(navigate).toHaveAttribute('data-to', '/login');
    
    const state = JSON.parse(navigate.getAttribute('data-state') || '{}');
    expect(state.message).toBe('Room creation requires a registered account. Please sign up to create rooms.');
    expect(state.suggestedAction).toBe('SIGN_UP');
  });

  it('should render outlet when user is authenticated and not a guest', () => {
    mockAuthContext.isLoading = false;
    mockAuthContext.isAuthenticated = true;
    mockAuthContext.isGuest = false;

    renderWithRouter(<RegisteredUserRoute />);
    
    expect(screen.getByTestId('outlet')).toBeInTheDocument();
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});