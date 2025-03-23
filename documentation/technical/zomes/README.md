# Zome Documentation

This directory contains detailed documentation for the Holochain zomes in the Requests and Offers project.

## Zome Structure

### [Users and Organizations Zome](users_organizations.md)
Core zome managing user and organization profiles:
- User profile management
- Agent relationships
- Profile status tracking
- Organization profile management
- Member and coordinator management
- Organization-user relationships
- Organization status tracking

Implementation:
- Integrity: `dnas/requests_and_offers/zomes/integrity/users_organizations`
- Coordinator: `dnas/requests_and_offers/zomes/coordinator/users_organizations`

Components:
- [User Management](users.md) - User profiles and relationships
- [Organization Management](organizations.md) - Organization profiles and member management

### [Requests Zome](requests.md)
Manages request creation and lifecycle:
- Request creation and management
- Request-user relationships
- Request-organization relationships
- Request validation

Implementation:
- Integrity: `dnas/requests_and_offers/zomes/integrity/requests`
- Coordinator: `dnas/requests_and_offers/zomes/coordinator/requests`

### [Administration Zome](administration.md)
Handles system administration and status management:
- Administrator management
- Status tracking
- Entity verification
- System moderation

Implementation:
- Integrity: `dnas/requests_and_offers/zomes/integrity/administration`
- Coordinator: `dnas/requests_and_offers/zomes/coordinator/administration`

## Documentation Structure

Each zome's documentation follows this structure:
1. Overview
2. Technical Implementation
   - Entry Types
   - Link Types
   - Core Functions
3. Validation Rules
4. Access Control
5. Integration Points
6. Usage Examples

## Development Guidelines

1. **Function Documentation**:
   - Document all public functions
   - Include parameter and return type descriptions
   - Provide error conditions and handling

2. **Link Types**:
   - Document all link types
   - Explain link creation conditions
   - Describe link validation rules

3. **Entry Types**:
   - Document all entry fields
   - Include validation rules
   - Provide example entries

4. **Examples**:
   - Show common use cases
   - Include error handling
   - Demonstrate integration points
