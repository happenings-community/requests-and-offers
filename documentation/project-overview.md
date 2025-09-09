# Project Overview

## Introduction

The **Requests and Offers** project is a Holochain application (hApp) designed for the hAppenings.community. It
facilitates connections within the Holochain ecosystem by providing a simplified bulletin board where users can:

- **Post Requests** for services, skills, or resources they need
- **Create Offers** to provide services, skills, or resources they can share
- **Discover opportunities** through search and tagging systems
- **Connect directly** through clearly displayed contact information

## Key Features (Simplified MVP)

### Service Types & Tag-Based Discovery System

- **Dynamic Service Type Management**: DHT-based service type entries with admin validation workflow
- **Tag-Based Discovery**: Comprehensive tagging system enabling efficient search across requests, offers, and service
  types
- **Cross-Entity Discovery**: Find related content through tag navigation (service types → requests/offers)
- **Admin Moderation**: Full approval/rejection workflow for user-suggested service types
- **Autocomplete & Statistics**: Real-time tag suggestions and usage analytics

### Request Management

- Create detailed requests specifying what you need with service type integration
- Set preferences for communication, timing, and exchange type
- Link requests to service types for better categorization and discovery
- Tag-based filtering and search capabilities

### Offer Management

- Create comprehensive offers detailing what you can provide with service type integration
- Specify availability, skills, and interaction preferences
- Connect offers to service types for improved discoverability
- Tag-based filtering and search capabilities

### User & Organization Profiles

- Individual user profiles with skills and preferences
- Organization/project management with team coordination
- Multi-device access and profile synchronization

### Listing Management

- Archive your own requests/offers when fulfilled or no longer relevant
- Delete your own requests/offers permanently
- View all your listings in a personal dashboard

### Administrative Tools

- Admin interface for approving/rejecting service type suggestions
- User verification and role management
- Content moderation capabilities
- Tag analytics and management dashboards

## Technology Stack

### Backend (Holochain)

- **Distributed Hash Table (DHT)**: Peer-to-peer data storage and retrieval
- **Zome Architecture**: Modular coordinator/integrity pattern
  - `requests_coordinator`: Request management and lifecycle
  - `offers_coordinator`: Offer management and lifecycle
  - `service_types_coordinator`: Service type management with tag indexing
  - `users_organizations`: Profile and organization management
  - `administration`: Admin roles and verification
- **Cross-Zome Integration**: Seamless data flow between different functional areas
- Tag-Based Indexing: Efficient path anchor system for discovery and search

### Frontend (SvelteKit + Effect TS)

- **SvelteKit**: Modern web framework with server-side rendering
- **Svelte 5 Runes**: Reactive state management (`$state`, `$derived`, `$effect`)
- **Effect TS**: Functional programming patterns for robust async operations and error handling
- **TailwindCSS + SkeletonUI**: Modern, responsive design system

### Development Environment

- **Nix**: Reproducible development environment (for DNA/zome development)
- **Bun**: Fast JavaScript runtime and package manager (for frontend)
- **Tryorama**: Holochain testing framework (backend tests)
- **Vitest**: Modern testing framework (frontend tests)

## Architecture Patterns

### Effect Service Pattern

All zome interactions use Effect TS for:

- **Type-safe error handling**: Domain-specific error types with proper context
- **Composable async operations**: Clean composition of complex workflows
- **Dependency injection**: Clean separation of concerns through Context Tags
- **Robust state management**: Integration with Svelte stores for reactive UX

### Reactive State Management

- **Svelte Stores**: Feature-specific stores using Svelte 5 Runes
- **Entity Caching**: In-memory caching with expiration and invalidation
- **Event Bus**: Cross-store communication for coordinated state updates
- **Tag-Based Reactivity**: Dynamic updates based on tag selections and filtering

### Component Organization

- **Feature-based structure**: Components organized by domain (requests, offers, service-types, tags)
- **Reusable components**: Shared UI elements with consistent patterns
- **Accessibility-first**: WCAG-compliant interfaces with keyboard navigation
- **Mobile-responsive**: Adaptive design for all device sizes

## User Experience (Simplified MVP)

### For Regular Users

1. **Browse and Discover**: Use search and tag-based navigation to find relevant requests and offers
2. **Create Content**: Post requests or offers with service type categorization
3. **Connect Directly**: View contact information and communicate outside the platform
4. **Manage Listings**: Archive or delete your own requests/offers

### For Administrators

1. **Moderate Content**: Review and approve/reject user-suggested service types
2. **Manage Users**: Verify accounts and manage roles
3. **Analytics**: View tag usage statistics and platform activity
4. **System Health**: Monitor performance and resolve issues

## Current Implementation Status

### Completed Features

- **Service Types System**: Complete implementation with validation workflow
- **Tag-Based Discovery**: Full cross-entity discovery and navigation
- **Request/Offer Management**: Complete CRUD operations with service type integration
- **User/Organization Profiles**: Basic profile management
- **Admin Interface**: Complete moderation and management tools
- **Testing Infrastructure**: Comprehensive test coverage (backend and frontend)

### Simplified MVP Features (In Development)

- Archive/delete functionality for user listings
- Contact information display components
- Simplified navigation and user dashboard
- Documentation updates for simplified approach

### Post-MVP Features (Planned)

- Exchange coordination system (proposals, agreements, reviews)
- In-app messaging system
- Advanced analytics and reporting
- Enhanced user dashboard features
- hREA economic resource integration
- Mobile application
- Advanced recommendation algorithms
- Reputation and rating systems

## Getting Started

### Prerequisites

- Nix (for Holochain development)
- Bun (for frontend development)
- Git

### Quick Start

```bash
# Clone the repository
git clone https://github.com/hAppening-Community/requests-and-offers.git
cd requests-and-offers

# Enter Nix development environment (for backend)
nix develop

# Install frontend dependencies
cd ui && bun install

# Run development servers
bun run dev
```

### Testing

```bash
# Run backend tests
bun run test:backend

# Run frontend tests
bun run test:unit
bun run test:integration
```

## Contributing

We welcome contributions! Please see our contributing guidelines and feel free to:

- Report bugs and suggest features
- Contribute code improvements
- Help with documentation
- Test new features and provide feedback

## Community

- **GitHub**: [hAppening-Community/requests-and-offers](https://github.com/hAppening-Community/requests-and-offers)
- **Community**: hAppenings.community
- **Discord**: [Join our Discord](https://discord.gg/hAppening)
