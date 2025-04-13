# Technical Context

## Technologies Used

### Core Technologies
- **Svelte 5**: Latest version with runes for reactive state management
- **Holochain**: v0.17.1 for distributed backend
- **TypeScript**: v5.7.3 for type safety
- **Effect**: v3.14.4 for functional programming patterns
- **GraphQL**: v15.10.1 with ValueFlows integration
- **TailwindCSS**: v3.4.17 for styling
- **SkeletonUI**: v2.7.0 for UI components

### Development Tools
- **Bun**: Latest version for fast JavaScript runtime
- **Vite**: v5.4.14 for build tooling
- **Vitest**: v1.6.0 for unit testing
- **Playwright**: v1.50.0 for E2E testing
- **ESLint**: v8.57.1 for code linting
- **Prettier**: v3.4.2 for code formatting
- **SvelteKit**: v2.16.1 for application framework

### Integration Libraries
- **@holochain/client**: v0.17.1
- **@holochain/tryorama**: v0.18.0-dev.5
- **@valueflows/vf-graphql**: v0.9.0-alpha.10
- **@valueflows/vf-graphql-holochain**: v0.0.1-alpha.22
- **@vf-ui/graphql-client-holochain**: v0.0.1-alpha.22

## Development Setup

### Prerequisites
- Nix environment for Holochain development
- Bun for package management and running scripts
- Node.js compatible environment
- Git for version control

### Environment Setup
```bash
# Install dependencies
bun install

# Start development server
bun run start

# Build for production
bun run build

# Run tests
bun run test           # All tests
bun run test:unit     # Unit tests
bun run test:e2e      # E2E tests
```

### Development Scripts
- `start`: Runs development server
- `build`: Builds production bundle
- `check`: Type checks TypeScript
- `package`: Creates distributable package
- `test`: Runs all tests
- `lint`: Checks code style
- `format`: Formats code

## Technical Constraints

### Architecture
1. **Distributed System**
   - Holochain DNA structure
   - P2P networking
   - Local-first data storage

2. **State Management**
   - Effect for functional patterns
   - Svelte 5 runes for reactivity
   - EntityCache for data caching

3. **UI Architecture**
   - Component-based structure
   - Responsive design
   - Accessibility compliance

### Performance
1. **Client-Side**
   - Bundle size optimization
   - Code splitting
   - Asset optimization
   - Lazy loading

2. **Data Management**
   - Efficient caching
   - Batch operations
   - Optimistic updates
   - Error handling

3. **Network**
   - Request batching
   - Data prefetching
   - Connection resilience
   - Offline support

## Dependencies

### Frontend
1. **Core**
   - Svelte 5
   - TypeScript
   - TailwindCSS
   - SkeletonUI

2. **State Management**
   - Effect
   - Svelte stores
   - EntityCache

3. **Testing**
   - Vitest
   - Playwright
   - Tryorama

### Backend
1. **Holochain**
   - DNA modules
   - Zome functions
   - Entry types

2. **Integration**
   - GraphQL
   - ValueFlows
   - MessagePack

3. **Development**
   - Nix
   - Bun
   - Vite

## Development Patterns

### Code Organization
1. **Frontend Structure**
   ```
   ui/
   ├── src/
   │   ├── lib/
   │   │   ├── components/
   │   │   ├── stores/
   │   │   ├── services/
   │   │   └── utils/
   │   ├── routes/
   │   └── app.html
   ```

2. **Backend Structure**
   ```
   dnas/
   ├── requests_and_offers/
   │   ├── zomes/
   │   │   ├── coordinator/
   │   │   └── integrity/
   │   └── workdir/
   ```

### Testing Strategy
1. **Unit Testing**
   - Component tests
   - Store tests
   - Utility tests
   - Service tests

2. **Integration Testing**
   - API integration
   - Component integration
   - Flow testing

3. **E2E Testing**
   - User workflows
   - Edge cases
   - Performance

### Code Quality
1. **Standards**
   - ESLint configuration
   - Prettier formatting
   - TypeScript strict mode
   - Component patterns

2. **Documentation**
   - JSDoc comments
   - README files
   - API documentation
   - Component stories

3. **Review Process**
   - Code review guidelines
   - Testing requirements
   - Performance criteria
   - Accessibility checks

## Development Standards
### Svelte 5 Implementation
- Using Svelte 5 runes for state management
- TypeScript with strict mode enabled
- Component organization by feature/domain
- Proper props and events handling using new Svelte 5 syntax

### Project Structure
```
src/
├── lib/
│   ├── components/    # Organized by feature
│   ├── stores/        # Global state management
│   ├── types/         # TypeScript definitions
│   └── utils/         # Shared utilities
└── routes/           # SvelteKit routes
```

## Core Dependencies
- **Holochain Runtime**: Core framework for distributed applications
- **@holochain/client**: Holochain client library
- **hREA Integration Libraries**: Economic resource management
- **SvelteKit**: Frontend framework and routing
- **TailwindCSS**: Utility-first CSS framework
- **SkeletonUI**: UI component library
- **Tryorama**: Testing framework for Holochain
- **@holochain-playground/cli**: Development tooling

## Integration Points
1. hREA Economic Model
   - Resource specification mapping
   - Economic event tracking
   - Value flow patterns
   - Agent and organization modeling

2. User Authentication
   - Agent key management
   - Multi-device profile access
   - Organization association
   - Role-based permissions

3. External Systems
   - Holo hosting integration
   - API endpoints structure
   - Data exchange formats
   - Search functionality implementation

## Documentation Standards
1. Structure
   - Modular documentation
   - Clear hierarchy
   - Consistent formatting
   - Working examples

2. Versioning
   - Documentation versioning
   - Breaking changes tracking
   - Changelog maintenance
   - Implementation links

3. Quality Assurance
   - Technical accuracy
   - Cross-reference maintenance
   - Code example testing
   - Style guide compliance 