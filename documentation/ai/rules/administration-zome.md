# Administration Zome Guidelines

## Access Control

- System uses role-based access control
- Core roles: Advocate, Creator, Administrator, Moderator
- Each role has distinct permissions and capabilities

## Core Concepts

- Network Administrators can manage users, organizations, and projects
- Moderators can perform most admin tasks except managing administrators
- Follow progenitor pattern (first agent becomes admin)
- Use anchors for administrators and moderators indexes

## User Management

- Multi-device profile access support
- User verification workflows
- Organization and project association

## User Status Management

- Implement proper status tracking (pending, accepted, rejected, suspended)
- Handle temporary and indefinite suspensions
- Track suspension history and reasons
- Implement proper UI for status visualization

## Entity Verification

- Admin verification of users and organizations
- Project verification if not managed by verified organization
- Status tracking for verification process
- UI indicators for verification status

## Administration Features

- Essential reporting tools
- System configuration capabilities
- Moderation and flagging system
- User concern handling

## Documentation References

- [administration.md](documentation/technical/zomes/administration.md)
- [specifications.md](documentation/specifications.md)
