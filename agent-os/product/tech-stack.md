# Technical Stack

## Backend Technologies

### Holochain Framework
- **Holochain Core**: Peer-to-peer application framework for decentralized data storage and validation
- **Rust Programming Language**: Systems programming language for zome development with memory safety and performance
- **hREA Integration**: Holochain Resource Allocation framework for economic resource tracking and management
- **DNA Structure**: Modular coordinator/integrity zome pattern for business logic and data validation

### Holochain Zomes
- **requests_coordinator/integrity**: Request lifecycle management and validation
- **offers_coordinator/integrity**: Offer lifecycle management and validation
- **service_types_coordinator/integrity**: Service type management with admin moderation workflow
- **users_organizations**: Profile and organization management with multi-device support
- **administration**: Admin roles, verification, and content moderation
- **exchanges**: Exchange coordination and economic event management
- **mediums_of_exchange**: Exchange type definitions and preferences

## Frontend Technologies

### Core Framework
- **SvelteKit 2**: Modern web framework with server-side rendering and file-based routing
- **Svelte 5 Runes**: Reactive state management using `$state`, `$derived`, and `$effect`
- **TypeScript**: Type-safe JavaScript development with comprehensive type checking
- **Vite**: Fast build tool and development server with hot module replacement

### Architecture & State Management
- **Effect-TS**: Functional programming library for robust async operations and error handling
- **7-Layer Architecture**: Standardized pattern across all domains (Service, Store, Schema, Error, Composables, Components, Testing)
- **Context.Tag Dependency Injection**: Clean separation of concerns through Effect's dependency system
- **EntityCache**: Performance optimization with intelligent caching and invalidation

### UI Framework & Styling
- **TailwindCSS**: Utility-first CSS framework for rapid UI development
- **SkeletonUI**: Component library built on TailwindCSS with accessible design patterns
- **Svelte Hero Icons**: Consistent icon library for UI elements
- **WCAG Compliance**: Accessibility-first design with keyboard navigation and screen reader support

## Development Tools & Environment

### Package Management & Build
- **Bun**: Fast JavaScript runtime and package manager for dependency management
- **Nix**: Reproducible development environment for Rust/Holochain development
- **Concurrently**: Run multiple development processes simultaneously
- **Rimraf**: Cross-platform file deletion utility

### Testing Framework
- **Tryorama**: Holochain testing framework for multi-agent scenarios
- **Vitest**: Modern testing framework for unit and integration tests
- **Playwright**: End-to-end testing with cross-browser support
- **Effect Testing**: Effect-TS testing utilities with service isolation patterns

### Code Quality & Linting
- **ESLint**: JavaScript/TypeScript linting with Svelte-specific rules
- **Prettier**: Code formatting with consistent style enforcement
- **Svelte Check**: TypeScript checking for Svelte components
- **Rustfmt**: Code formatting for Rust code

## Deployment & Distribution

### Desktop Applications
- **Tauri**: Cross-platform desktop application framework
- **Electron**: Alternative desktop app deployment option
- **Kangaroo**: Custom desktop application distribution system

### Web Deployment
- **GitHub Releases**: Automated release management and distribution
- **Git Submodules**: Unified repository management for deployment components
- **Homebrew**: macOS package management integration

### Build & CI/CD
- **GitHub Actions**: Automated testing and deployment workflows
- **Multi-Environment Support**: Development, test, and production configurations
- **Tree-Shaking**: Development code removal from production builds
- **Asset Optimization**: Bundle optimization and compression

## Data & Storage

### Holochain DHT
- **Distributed Hash Table**: Peer-to-peer data storage and retrieval
- **Content Addressing**: Immutable data storage with cryptographic verification
- **Link Management**: Efficient relationship tracking between entities
- **Path Anchors**: Optimized indexing for tag-based discovery

### Client-Side Storage
- **Local Storage**: User preferences and session data
- **IndexedDB**: Client-side caching for offline functionality
- **Memory Cache**: In-memory entity caching with expiration policies

## Communication & Integration

### Holochain Client
- **@holochain/client**: TypeScript client library for Holochain interaction
- **WebSockets**: Real-time communication with Holochain conductors
- **GraphQL**: Optional GraphQL integration with hREA (@valueflows/vf-graphql-holochain)

### External Services
- **Discord Integration**: Community communication and notifications
- **Email Services**: Contact preference management and notifications
- **Webhook Support**: External system integration capabilities

## Performance & Monitoring

### Optimization
- **Lazy Loading**: On-demand data fetching with pagination
- **Code Splitting**: Optimized bundle sizes with dynamic imports
- **Caching Strategies**: Multi-layer caching for performance
- **Tree-Shaking**: Dead code elimination for production builds

### Monitoring & Analytics
- **Error Tracking**: Comprehensive error logging and reporting
- **Performance Metrics**: Application performance monitoring
- **User Analytics**: Usage patterns and feature adoption tracking
- **System Health**: Holochain network health monitoring

## Security & Privacy

### Data Protection
- **End-to-End Encryption**: Secure peer-to-peer communication
- **Data Sovereignty**: User-controlled data storage and access
- **Privacy Controls**: Granular privacy settings for profiles and content
- **Content Moderation**: Admin tools for community safety

### Authentication & Authorization
- **Holochain Keys**: Cryptographic identity management
- **Role-Based Access**: Admin and user role management
- **Content Validation**: Input sanitization and validation rules
- **Secure Defaults**: Security-first configuration and practices
