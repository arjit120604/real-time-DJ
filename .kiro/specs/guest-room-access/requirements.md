# Requirements Document

## Introduction

This feature modifies the existing authentication and room access system to allow unsigned users (guests) to enter existing rooms by providing a username and room ID, while maintaining the restriction that only signed users can create new rooms. The system should not automatically create rooms when users attempt to join non-existent rooms.

## Requirements

### Requirement 1

**User Story:** As an unsigned user, I want to enter an existing room by providing my username and room ID, so that I can participate in the room without creating an account.

#### Acceptance Criteria

1. WHEN an unsigned user is on the login page THEN the system SHALL provide an option to "Join Room as Guest"
2. WHEN an unsigned user selects "Join Room as Guest" THEN the system SHALL display input fields for username and room ID
3. WHEN an unsigned user provides a valid username and existing room ID THEN the system SHALL allow them to enter the room
4. WHEN an unsigned user provides a username and non-existent room ID THEN the system SHALL display an error message and NOT create a new room
5. WHEN an unsigned user enters a room THEN the system SHALL identify them as a guest user in the room

### Requirement 2

**User Story:** As a signed user, I want to maintain my ability to create rooms, so that I can host new music sessions.

#### Acceptance Criteria

1. WHEN a signed user attempts to create a room THEN the system SHALL allow room creation
2. WHEN an unsigned user attempts to create a room THEN the system SHALL deny the request and display an appropriate error message
3. WHEN a signed user enters a non-existent room ID THEN the system SHALL NOT automatically create the room and display an appropriate error message

### Requirement 3

**User Story:** As a system administrator, I want to ensure room creation is controlled, so that only authenticated users can create new rooms and prevent spam.

#### Acceptance Criteria

1. WHEN any user (signed or unsigned) attempts to join a non-existent room THEN the system SHALL return an error and NOT create the room automatically
2. WHEN the system validates room existence THEN it SHALL check against the actual room database
3. WHEN a guest user is in a room THEN the system SHALL clearly distinguish them from signed users in the user interface
4. WHEN a guest user attempts any room creation functionality THEN the system SHALL prevent the action and suggest signing up

### Requirement 4

**User Story:** As a user (signed or unsigned), I want clear feedback about room access attempts, so that I understand why I can or cannot access a room.

#### Acceptance Criteria

1. WHEN a user attempts to join a non-existent room THEN the system SHALL display a clear error message indicating the room does not exist
2. WHEN a guest user successfully joins a room THEN the system SHALL confirm their guest status
3. WHEN a guest user attempts restricted actions THEN the system SHALL provide clear messaging about signing up for full access
4. WHEN room access fails due to any reason THEN the system SHALL provide specific error messages rather than generic failures