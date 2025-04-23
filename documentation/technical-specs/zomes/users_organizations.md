# Users and Organizations Zome

## Overview

The Users and Organizations zome is a core component that manages user profiles, organization profiles, and their relationships within the system. It provides comprehensive functionality for handling both individual users and organizational entities, including their creation, management, and interconnections.

## Components

### [User Management](users.md)

Handles individual user profiles and relationships:

- User profile creation and updates
- Agent-user relationships
- Profile status management
- User validation rules
- User queries and retrieval

### [Organization Management](organizations.md)

Manages organization profiles and their member relationships:

- Organization profile creation and updates
- Member and coordinator management
- Organization status tracking
- Organization-user relationships
- Organization validation rules

## Technical Implementation

### Entry Types

The zome defines two primary entry types:

```rust
// User entry for individual profiles
pub struct User {
    pub name: String,
    pub nickname: String,
    pub bio: String,
    pub picture: Option<SerializedBytes>,
    pub user_type: String,
    pub skills: Vec<String>,
    pub email: String,
    pub phone: Option<String>,
    pub time_zone: String,
    pub location: String,
}

// Organization entry for group profiles
pub struct Organization {
    pub name: String,
    pub description: String,
    pub logo: Option<SerializedBytes>,
    pub email: String,
    pub urls: Vec<String>,
    pub location: String,
}
```

### Link Types

The zome uses various link types to maintain relationships:

```rust
pub enum LinkTypes {
    // User-related links
    UserUpdates,
    AllUsers,
    MyUser,
    UserStatus,
    UserAgents,
    
    // Organization-related links
    AllOrganizations,
    OrganizationStatus,
    UserOrganizations,
    OrganizationMembers,
    OrganizationCoordinators,
    OrganizationUpdates,
}
```

## Integration Points

1. **Administration Zome**
   - Status management for both users and organizations
   - Administrator verification
   - Entity moderation

2. **Status Management**
   - Both users and organizations have associated statuses
   - Status types: Created, Accepted, Rejected
   - Status tracking through administration zome

## Implementation Location

- Integrity: `dnas/requests_and_offers/zomes/integrity/users_organizations`
- Coordinator: `dnas/requests_and_offers/zomes/coordinator/users_organizations`

## Detailed Documentation

For more detailed information about specific components:

- [User Management Documentation](users.md)
- [Organization Management Documentation](organizations.md)
