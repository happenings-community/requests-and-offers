# Requests and Offers Documentation

Welcome to the Requests & Offers documentation! This documentation provides comprehensive information about the hAppenings.community project that facilitates exchanges within the Holochain ecosystem.

## Documentation Structure

### Core Documents
- [Requirements](./requirements.md)
- [Architecture](./architecture.md)
- [Technical Specifications](./technical-specs.md)
- [Work In Progress](./work-in-progress.md)
- [Status](./status.md)

### Detailed Sections

- **[Requirements Details](./requirements/)**
  - [Features](./requirements/features.md)
  - [MVP](./requirements/mvp.md)
  - [Roles](./requirements/roles.md)
  - [Use Cases](./requirements/use-cases.md)
- **[Architecture Details](./architecture/)**
  - [Overview](./architecture/overview.md)
  - [hREA Integration](./architecture/hrea-integration.md)
- **[Technical Specification Details](./technical-specs/)**
  - [General Specs](./technical-specs/general.md)
  - [UI Structure](./technical-specs/ui-structure.md)
  - [Zome Details](./technical-specs/zomes/README.md)

### [Guides](./guides/)

Quick-start guides and development resources:

- **[Getting Started](./guides/getting-started.md)** - Project introduction and setup
- **[Installation](./guides/installation.md)** - Detailed installation steps
- **[Contributing](./guides/contributing.md)** - Development workflow and guidelines

### [Technical Specifications](./technical-specs/README.md)

Implementation details and architecture:

- **[Architecture](./architecture/README.md)**
  - [Overview](./architecture/README.md) - System architecture and design
  - [hREA Integration](./architecture/hrea-integration.md)
- **[Zomes](./technical-specs/zomes/README.md)**
  - [Overview](./technical-specs/zomes/README.md) - Zome structure and guidelines
  - [Users & Organizations](./technical-specs/zomes/users_organizations.md)
    - [User Management](./technical-specs/zomes/users.md)
    - [Organization Management](./technical-specs/zomes/organizations.md)
  - [Requests](./technical-specs  /zomes/requests.md) - Request creation and management
  - [Administration](./technical-specs/zomes/administration.md)
- **[UI Structure](./technical-specs/ui-structure.md)** - Frontend architecture and components

### [Requirements](./requirements/)

Detailed project requirements:

- **[MVP](./requirements/mvp.md)** - Core requirements
- **[Features](./requirements/features.md)** - Feature details
- **[Roles](./requirements/roles.md)** - User roles and permissions
- **[Technical](./requirements/technical.md)** - Technical requirements
- **[Use Cases](./requirements/use-cases.md)** - User workflows

## Development Resourcesa

### Quick Links

- [Project Repository](https://github.com/Happening-Community/requests-and-offers)
- [Community Website](https://happenings.community/)
- [Discord Community](https://discord.gg/happening)
- [Changelog](../CHANGELOG.md) - Track project updates and releases.

### Development Flow

1. **DNA Development**
    - Implement zome functionality using the **coordinator/integrity pattern**.
    - Define entry and link types in integrity zomes.
    - Write Tryorama tests for validation and CRUD operations.
    - Document entry/link types and zome functions.

2. **Service Layer**
    - Create TypeScript services (e.g., `requests.service.ts`) to interact with specific zomes.
    - Wrap Holochain client calls using **`effect`** for robust, typed, and composable asynchronous operations and error handling.
    - Define specific error types (e.g., `RequestError`) for the service layer.

3. **UI Implementation & State Management**
    - [UI Structure](./technical-specs/ui-structure.md) - Reference for frontend architecture.
    - Implement Svelte stores (e.g., `requests.store.svelte.ts`) using **Svelte 5 runes (`$state`)** for reactive state management.
    - Orchestrate service calls from stores, managing loading and error states.
    - Utilize an **`EntityCache`** within stores for caching fetched data and reducing backend calls.
    - Employ a **`storeEventBus`** for cross-store communication and state synchronization.
    - Build reusable Svelte components.
    - Create feature pages and integrate them with the stores.

### Key Technologies

- **Holochain** - Core framework
- **SvelteKit** - Frontend framework
- **Effect TS** - TypeScript functional programming library
- **hREA** - Agent-based economic resource management
- **Tryorama** - Holochain testing framework

### Development Tools

- **[@holochain/client](https://www.npmjs.com/package/@holochain/client)** - Holochain client library
- **[@holochain-playground/cli](https://www.npmjs.com/package/@holochain-playground/cli)** - Development tooling
- **[bun](https://bun.sh/)** - Package manager and runtime
- **[Nix](https://nixos.org/)** - Development environment

## Getting Help

### Documentation

- Start with [Getting Started](./guides/getting-started.md)
- Check [Installation Guide](./guides/installation.md)
- Review [Contributing Guide](./guides/contributing.md)

### Community Support

- Join our [Discord](https://discord.gg/happening)
- Visit [hAppenings Community](https://happenings.community/)
- Check [GitHub Issues](https://github.com/Happening-Community/requests-and-offers/issues)

### Development Support

- Review [Technical Documentation](./technical-specs.md) & [Architecture](./architecture.md)
- Check [Zome Documentation](./technical-specs/zomes/README.md)
- Follow [Feature Development](./guides/contributing.md#feature-development-workflow)

## Documentation Standards

### Structure

- Keep documentation modular
- Maintain clear hierarchy
- Use consistent formatting
- Include working examples

### Updates

- Keep in sync with implementation
- Document breaking changes
- Update examples regularly
- Version documentation

### Quality

- Ensure technical accuracy
- Maintain cross-references
- Test code examples
- Follow style guidelines

## Version Control

### Documentation Versioning

- Tag documentation versions
- Track breaking changes
- Maintain changelog
- Link to implementation

### Release Process

- Update all affected docs
- Review cross-references
- Test code examples
- Update version numbers 