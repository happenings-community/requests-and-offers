# Requests and Offers

A hAppenings.community project facilitating exchange between Holochain creators, developers, advocates, projects, and organizations. 
Built with Holochain, it provides an agent-centric, distributed marketplace for requests and offers.

## Quick Links

- [Community Website](https://happenings.community/)
- [Litepaper](https://happenings-community.gitbook.io/)
- [Discord Community](https://discord.gg/happening)

## Documentation

📚 **[Full Documentation](documentation/README.md)**

### Key Documentation Sections

- **[Guides](documentation/guides/README.md)**
  - [Getting Started](documentation/guides/getting-started.md)
  - [Installation](documentation/guides/installation.md)
  - [Contributing](documentation/guides/contributing.md)

- **[Technical Documentation](documentation/technical/README.md)**
  - [Architecture Overview](documentation/technical/README.md)
  - [hREA Integration](documentation/technical/architecture/hrea-integration.md)
  - [Zome Documentation](documentation/technical/zomes/README.md)
    - [Users Organizations](documentation/technical/zomes/users.md)
    - [Administration](documentation/technical/zomes/administration.md)

- **[Specifications](documentation/specifications/README.md)**
  - [MVP Requirements](documentation/specifications/mvp.md)
  - [Feature Specifications](documentation/specifications/features.md)
  - [User Roles](documentation/specifications/roles.md)
  - [Technical Architecture](documentation/specifications/technical.md)
  - [Use Cases](documentation/specifications/use-cases.md)

## Quick Start

### Prerequisites

- [Holochain Development Environment](https://developer.holochain.org/docs/install/)
- Node.js 16+
- pnpm 9.7.0+

### Setup

```bash
# Clone repository
git clone https://github.com/Happening-Community/requests-and-offers.git
cd requests-and-offers

# Enter nix shell
nix develop

# Install dependencies
pnpm install
```

### Development

```bash
# Start with 2 agents (default)
pnpm start

# Start with custom number of agents
AGENTS=3 pnpm start

# Start with Tauri (desktop app)
pnpm start:tauri
```

This will:
- Create a network of agents
- Start the UI for each agent
- Launch the Holochain Playground for conductor introspection

### Testing

```bash
# Run all tests
pnpm test

# Frontend tests
pnpm test:ui

# Individual zome tests
pnpm test:misc           # Functionalities of the misc zome
pnpm test:users          # Users functionalities of user_organizations zome
pnpm test:administration # Functionalities of the administration zome
pnpm test:organizations  # Organizations functionalities of user_organizations zome
pnpm test:status         # Unit tests of the status in the administration zome
```

### Building

```bash
# Build zomes
pnpm build:zomes

# Build complete hApp
pnpm build:happ

# Package for distribution
pnpm package
```

## Project Structure

```
requests-and-offers/
├── dnas/                    # Holochain DNA
│   └── requests_and_offers/
│       └── zomes/           # DNA zomes
│           ├── coordinator/ # Coordinator zomes
│           └── integrity/   # Integrity zomes
├── ui/                      # SvelteKit frontend
│   ├── src/
│   │   ├── lib/             # Shared components
│   │   ├── routes/          # SvelteKit routes
│   │   ├── services/        # Holochain services
│   │   └── stores/          # State management
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
