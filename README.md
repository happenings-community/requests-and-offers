# Requests and Offers

A hAppenings.community project facilitating exchange between Holochain creators, developers, advocates, projects, and organizations.
Built with Holochain, it provides an agent-centric, distributed marketplace for requests and offers.

## Quick Links

- [Community Website](https://happenings.community/)
- [Litepaper](https://happenings-community.gitbook.io/)
- [Discord Community](https://discord.gg/happening)
- [Changelog](CHANGELOG.md) - Track project updates and releases.

## Documentation

 **[Project Overview](documentation/project-overview.md)**

### Core Documentation

- **[Requirements](documentation/requirements.md)**
  - [Requirements Details](documentation/requirements/README.md)
  - [Features](documentation/requirements/features.md)
  - [MVP](documentation/requirements/mvp.md)
  - [Roles](documentation/requirements/roles.md)
  - [Use Cases](documentation/requirements/use-cases.md)

- **[Architecture](documentation/architecture.md)**
  - [Architecture Details](documentation/architecture/README.md)
  - [General Overview](documentation/architecture/overview.md)
  - [hREA Integration](documentation/architecture/hrea-integration.md)

- **[Technical Specifications](documentation/technical-specs.md)**
  - [Technical Specs Details](documentation/technical-specs/README.md)
  - [General Specs](documentation/technical-specs/general.md)
  - [Zome Details](documentation/technical-specs/zomes/README.md)
  - [UI Structure](documentation/technical-specs/ui-structure.md)
  - [Event Bus Pattern](documentation/technical-specs/event-bus-pattern.md)
- **[Work In Progress](documentation/work-in-progress.md)**
- **[Status](documentation/status.md)**

### Guides

- **[Guides Overview](documentation/guides/README.md)**
  - [Getting Started](documentation/guides/getting-started.md)
  - [Installation](documentation/guides/installation.md)
  - [Contributing](documentation/guides/contributing.md)

## Quick Start

### Prerequisites

- [Holochain Development Environment](https://developer.holochain.org/docs/install/)
- [Bun](https://bun.sh) 1.0.0+

### Setup

```bash
# Clone repository
git clone https://github.com/Happening-Community/requests-and-offers.git
cd requests-and-offers

# Enter nix shell
nix develop

# Install dependencies
bun install
```

### Development

```bash
# Start with 2 agents (default)
bun start

# Start with custom number of agents
AGENTS=3 bun start

# Start with Tauri (desktop app)
bun start:tauri
```

This will:

- Create a network of agents
- Start the UI for each agent
- Launch the Holochain Playground for conductor introspection

### Testing

```bash
# Run all tests
bun test

# Frontend tests
bun test:ui

# Individual zome tests
bun test:misc           # Functionalities of the misc zome
bun test:users          # Users functionalities of user_organizations zome
bun test:administration # Functionalities of the administration zome
bun test:organizations  # Organizations functionalities of user_organizations zome
bun test:requests       # Functionalities of the requests zome
bun test:offers         # Functionalities of the offers zome
bun test:status         # Unit tests of the status in the administration zome
```

### Frontend Tests

```bash
# Run unit tests (requires Nix environment for hREA integration)
nix develop --command bun test:unit

# Run integration tests
cd ui && bun test:integration
```

### Backend Tests

```bash
# Run Tryorama tests (requires Nix environment)
cd tests && bun test
```

**Note:** Unit tests now require the Nix environment due to hREA DNA integration. Use the autonomous command `nix develop --command bun test:unit` to run tests without manual intervention.

### Building

```bash
# Build zomes
bun build:zomes

# Build complete hApp
bun build:happ

# Package for distribution
bun package
```

## Project Structure

``` bash
requests-and-offers/
├── dnas/                    # Holochain DNA
│   └── requests_and_offers/
│       └── zomes/           # DNA zomes
│           ├── coordinator/ # Coordinator zomes
│           └── integrity/   # Integrity zomes
├── ui/                      # SvelteKit frontend
│   ├── src/
│   │   ├── lib/             # Reusable code (components, services, stores)
│   │   │   ├── components/  # UI components (organized by feature)
│   │   │   ├── services/    # Service layer (Holochain, hREA)
│   │   │   ├── stores/      # Svelte stores (state management)
│   │   │   ├── types/       # TypeScript type definitions
│   │   │   └── utils/       # Utility functions
│   │   ├── routes/          # SvelteKit routes/pages
│   │   ├── app.html         # Main HTML template
│   │   └── ...              # Other config files (app.css, app.d.ts, etc.)
├── tests/                   # Tryorama tests
└── documentation/           # Project documentation
    ├── project-overview.md  # Main project overview
    ├── requirements.md      # Requirements entry point
    ├── architecture.md      # Architecture entry point
    ├── technical-specs.md   # Technical Specs entry point
    ├── work-in-progress.md  # Current development focus
    ├── status.md            # Project status
    ├── requirements/        # Detailed requirements
    ├── architecture/        # Detailed architecture docs
    ├── technical-specs/     # Detailed technical specs
    ├── guides/              # Development guides
    └── assets/              # Documentation assets
```

## Feature Development

See our [Contributing Guide](documentation/guides/contributing.md) for detailed development workflow:

1. **DNA Development**
   - Implement zome functionality
   - Write Tryorama tests
   - Document entry and link types

2. **Service Layer**
   - Create Holochain services
   - Implement store management
   - Handle state updates

3. **UI Implementation**
   - Build reusable components
   - Create feature pages
   - Integrate with stores

## Community

- Join our [Discord](https://discord.gg/happening)
- Visit [hAppenings Community](https://happenings.community/)
- Follow development on [GitHub](https://github.com/Happening-Community/requests-and-offers)

## License

This project is licensed under [Cryptographic Autonomy License version 1.0](LICENSE.md)
