# Requests and Offers

A hAppenings.community project facilitating exchange between Holochain creators, developers, advocates, projects, and organizations.
Built with Holochain, it provides an agent-centric, distributed marketplace for requests and offers.

## Quick Links

- [Community Website](https://happenings.community/)
- [Litepaper](https://happenings-community.gitbook.io/)
- [Discord Community](https://discord.gg/happening)

## Documentation

 **[Full Documentation](documentation/README.md)**

### Key Documentation Sections

- **[Guides](documentation/guides/README.md)**
  - [Getting Started](documentation/guides/getting-started.md)
  - [Installation](documentation/guides/installation.md)
  - [Contributing](documentation/guides/contributing.md)

- **[Technical Documentation](documentation/technical/README.md)**
  - [Architecture Overview](documentation/technical/README.md)
  - [hREA Integration](documentation/technical/architecture/hrea-integration.md)
  - [Zome Documentation](documentation/technical/zomes/README.md)
    - [Users Organizations](documentation/technical/zomes/users_organizations.md)
    - [Requests](documentation/technical/zomes/requests.md)
    - [Administration](documentation/technical/zomes/administration.md)
  - [UI Structure](documentation/technical/ui-structure.md)

- **[Specifications](documentation/specifications/README.md)**
  - [MVP Requirements](documentation/specifications/mvp.md)
  - [Feature Specifications](documentation/specifications/features.md)
  - [User Roles](documentation/specifications/roles.md)
  - [Technical Architecture](documentation/specifications/technical.md)
  - [Use Cases](documentation/specifications/use-cases.md)

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
    ├── guides/              # Development guides
    ├── specifications/      # Project specifications
    └── technical/           # Technical documentation
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
