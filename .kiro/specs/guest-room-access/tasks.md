# Implementation Plan

- [x] 1. Update socket room handler for guest users
  - Modify joinRoom socket handler to accept guest users without userId
  - Add room validation before allowing guest users to join (no auto-creation)
  - Update Redis user storage to handle guest users with isGuest flag
  - _Requirements: 1.3, 1.4, 1.5, 3.1, 3.2_

- [x] 2. Add guest join option to login page
  - Add "Join Room as Guest" option to login page
  - Implement guest join form with username and room ID inputs
  - Connect guest join form to socket-based room joining
  - _Requirements: 1.1, 1.2_

- [x] 3. Update AuthContext for guest users
  - Extend AuthContext to support guest user state
  - Add setGuestUser method to set guest user without backend call
  - _Requirements: 1.5, 3.3_

- [x] 4. Add room creation access control
  - Prevent guest users from accessing room creation (home page)
  - Add requireRegisteredUser middleware to room creation endpoints
  - _Requirements: 2.1, 2.2, 3.4_

- [ ] 5. Add basic guest user identification
  - Update user display to show guest status in connected users list
  - Add visual distinction between registered and guest users
  - _Requirements: 1.5, 3.3, 4.2_