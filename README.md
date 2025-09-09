# Requests and Offers

A **simple peer-to-peer bulletin board** for the Holochain community, enabling creators, developers, and organizations to post requests and offers for services, skills, and resources with direct contact facilitation.

## 🚀 Quick Start

```bash
# Clone and setup
git clone https://github.com/Happening-Community/requests-and-offers.git
cd requests-and-offers && nix develop
bun install && bun start
```

## 📖 Documentation

### Essential Reading

- **[📋 Project Overview](documentation/project-overview.md)** - Complete project introduction and features
- **[🚀 Quick Reference](documentation/QUICK_REFERENCE.md)** - Essential commands, patterns, and workflows
- **[🏗️ Architecture](documentation/architecture.md)** - System design and 7-layer Effect-TS architecture
- **[🔧 Developer Guide](documentation/guides/getting-started.md)** - Setup and development workflow
- **[🆘 Troubleshooting](documentation/TROUBLESHOOTING.md)** - Common issues and solutions
- **[📚 Full Documentation Index](documentation/DOCUMENTATION_INDEX.md)** - Comprehensive documentation catalog

### Quick Reference

- **Requirements**: [Overview](documentation/requirements.md) | [Features](documentation/requirements/features.md) | [Use Cases](documentation/requirements/use-cases.md)
- **Technical**: [API Reference](documentation/technical-specs/api/README.md) | [Zomes](documentation/technical-specs/zomes/README.md) | [Testing](documentation/guides/testing.md)
- **Community**: [Contributing](documentation/guides/contributing.md) | [Discord](https://discord.gg/happening) | [Website](https://happenings.community/)

## 🛠️ Development Commands

### Running the Application

```bash
# Development Mode - Full dev features enabled
bun start              # Start with 2 agents + mock buttons
AGENTS=3 bun start     # Custom number of agents
bun start:tauri        # Desktop app with Tauri

# Test Mode - Alpha testing without mock buttons
bun start:test         # Test deployment simulation

# Production Mode - Clean production build
bun start:prod         # Production-ready deployment
```

### Testing

```bash
bun test               # All tests
bun test:ui            # Frontend tests
bun test:unit          # Unit tests (requires Nix)
bun test:integration   # Integration tests
```

### Building

```bash
bun build:zomes        # Build zomes
bun build:happ         # Build complete hApp
bun package            # Package for distribution
```

> **Note**: Unit tests require Nix environment due to hREA integration. Use `nix develop --command bun test:unit` for autonomous execution.

## 🔧 Development Features System

The project includes a comprehensive development features system with three distinct modes:

### 🧑‍💻 Development Mode

- **Purpose**: Full development experience with all debugging tools
- **Features**: Mock data buttons, development utilities, debug panels
- **Command**: `bun start`
- **Environment**: Uses `.env.development` with all dev features enabled

### 🧪 Test Mode (Alpha)

- **Purpose**: Alpha testing environment simulating production
- **Features**: Limited dev features, no mock buttons, realistic testing
- **Command**: `bun start:test`
- **Environment**: Uses `.env.test` with selective feature enablement

### 🚀 Production Mode

- **Purpose**: Clean production deployment
- **Features**: All development code tree-shaken out, optimized builds
- **Command**: `bun start:prod`
- **Environment**: Uses `.env.production` with zero dev features

### Environment Variables

The system uses Vite environment variables for build-time optimization:

```bash
# Core configuration
VITE_APP_ENV=development|test|production
VITE_DEV_FEATURES_ENABLED=true|false
VITE_MOCK_BUTTONS_ENABLED=true|false
```

**Tree-Shaking**: Development features are completely removed from production builds through Vite's build-time optimization, ensuring zero overhead in production deployments.

For detailed information, see [Development Features System](documentation/technical-specs/development-features-system.md).

## 📁 Project Structure

```bash
requests-and-offers/
├── dnas/requests_and_offers/    # Holochain DNA with coordinator/integrity zomes
├── ui/                          # SvelteKit frontend with 7-layer Effect-TS architecture
├── tests/                       # Tryorama integration tests
└── documentation/               # Comprehensive project documentation
```

See [Architecture Overview](documentation/architecture.md) for detailed system design.

## 🔄 MVP Transition

This project is currently transitioning to a simplified MVP approach:

### Simplified MVP Features

- **Bulletin Board**: Simple request/offer listing system
- **Direct Contact**: Clear display of contact information for communication
- **User Management**: Archive/delete own listings
- **Search & Browse**: Find requests and offers by keywords and tags

### Post-MVP Features (Coming Later)

- **Exchange Process**: Proposal, agreement, and review workflows
- **In-App Messaging**: Secure communication between users
- **Reputation System**: Review and rating mechanisms
- **Advanced Matching**: Algorithmic request/offer matching

See [MVP Documentation](documentation/mvp/README.md) for details on the simplified approach.

## 🤝 Community & Licensing

- **Discord**: [Join our community](https://discord.gg/happening)
- **Website**: [hAppenings.community](https://happenings.community/)
- **Contributing**: See [Contributing Guide](documentation/guides/contributing.md)
- **License**: [Cryptographic Autonomy License v1.0](LICENSE.md)
