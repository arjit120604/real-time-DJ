# Design Document

## Overview

This design extends the existing SyncTunes authentication and room access system to support guest users who can join existing rooms without creating accounts. The system maintains the current JWT-based authentication for registered users while introducing a parallel guest authentication flow that validates room existence before allowing access.

The key architectural principle is to minimize changes to the existing codebase while adding guest functionality through new endpoints and modified frontend flows. Guest users will have limited privileges compared to registered users, specifically being unable to create new rooms.

## Architecture

### Authentication Flow Changes

The current system uses a single authentication flow through JWT tokens. The new design introduces a simplified guest flow:

1. **Registered User Flow** (unchanged): Login → JWT token → Full access including room creation
2. **Guest User Flow** (new): Username + Room ID → Direct socket connection with room validation → In-memory Redis storage only

### Backend Architecture Changes

#### No New HTTP Endpoints Required
Guest authentication will be handled entirely through the existing socket connection flow, eliminating the need for separate REST endpoints.

#### Socket Connection Changes
The socket room handler will be modified to accept guest users by validating room existence and storing guest user data directly in Redis during the joinRoom event.

#### In-Memory Guest Management
All guest user data will be stored in Redis with room-specific keys, requiring no database changes or persistent storage.

### Frontend Architecture Changes

#### Login Page Enhancement
The login page will be modified to include a "Join Room as Guest" option that presents alternative input fields for username and room ID.

#### Authentication Context Updates
The `AuthContext` will be extended to handle guest user state, distinguishing between registered and guest users throughout the application.

## Components and Interfaces

### Backend Components

#### Socket-Based Guest Management
```typescript
interface GuestUser {
  id: string
  username: string
  isGuest: true
  roomId: string
}

interface SocketGuestService {
  validateRoomExists(roomId: string): Promise<boolean>
  createGuestUser(username: string, roomId: string): GuestUser
  storeGuestInRedis(roomId: string, guestUser: GuestUser): Promise<void>
}
```

#### Enhanced Room Handler
```typescript
interface EnhancedJoinRoomPayload {
  roomId: string
  userId?: string  // Optional for guests
  username: string
  isGuest?: boolean
}

interface RoomValidationService {
  roomExists(roomId: string): Promise<boolean>
}
```

### Frontend Components

#### Enhanced Login Component
```typescript
interface LoginPageState {
  mode: 'login' | 'guest-join'
  username: string
  password: string
  roomId: string
  error: string
}
```

#### Updated Authentication Context
```typescript
interface AuthContextType {
  isAuthenticated: boolean
  user: RegisteredUser | GuestUser | null
  isGuest: boolean
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  setGuestUser: (username: string, roomId: string) => void
  logout: () => void
}
```

#### Guest User Indicator Component
```typescript
interface GuestIndicatorProps {
  user: GuestUser
  onSignUpPrompt: () => void
}
```

## Data Models

### Guest User Storage
Guest users will be stored in Redis using the existing room user storage pattern:

```typescript
interface RedisGuestUser {
  id: string
  username: string
  isGuest: true
  roomId: string
}
```

### Enhanced User Context
The existing user context will be extended to support guest users:

```typescript
type User = RegisteredUser | GuestUser

interface RegisteredUser {
  id: string
  username: string
  isGuest: false
}

interface GuestUser {
  id: string
  username: string
  isGuest: true
  allowedRoomId: string
}
```

### Database Schema Changes
No database schema changes are required. Guest users are temporary and stored only in Redis using the existing `room:${roomId}:users` hash pattern. The existing Room and User models remain unchanged.

## Error Handling

### Room Validation Errors
- **Room Not Found**: Clear error message indicating the room doesn't exist
- **Invalid Room ID Format**: Validation error for malformed room IDs
- **Room Access Denied**: Error when guest tries to access unauthorized rooms

### Guest Authentication Errors
- **Username Validation**: Ensure username meets minimum requirements
- **Duplicate Guest Names**: Handle multiple guests with same username in a room
- **Session Expiration**: Graceful handling when guest sessions expire

### Permission Errors
- **Room Creation Attempt**: Clear messaging when guests try to create rooms
- **Unauthorized Actions**: Specific errors for actions requiring registration

### Error Response Format
```typescript
interface ErrorResponse {
  error: string
  code: 'ROOM_NOT_FOUND' | 'INVALID_CREDENTIALS' | 'PERMISSION_DENIED' | 'VALIDATION_ERROR'
  details?: string
  suggestedAction?: 'SIGN_UP' | 'TRY_DIFFERENT_ROOM' | 'CHECK_ROOM_ID'
}
```

## Testing Strategy

### Unit Tests
- Guest authentication service validation
- Room existence checking logic
- Permission validation for guest vs registered users
- Token generation and validation for guest sessions

### Integration Tests
- Complete guest join flow from frontend to backend
- Socket connection handling for guest users
- Room state synchronization with mixed user types
- Error handling for invalid room access attempts

### End-to-End Tests
- Guest user joining existing room successfully
- Guest user attempting to join non-existent room
- Guest user attempting to create room (should fail)
- Mixed room with both registered and guest users
- Guest session expiration and re-authentication

### Security Tests
- Guest token validation and expiration
- Room access permission enforcement
- Prevention of guest users accessing unauthorized rooms
- Validation of room existence before allowing access

### User Experience Tests
- Clear error messaging for all failure scenarios
- Smooth transition between login modes
- Proper guest user identification in room interface
- Sign-up prompts for restricted actions