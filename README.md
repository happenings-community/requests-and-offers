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
# Development Mode - Full Holochain app with dev features
bun start              # Start complete Holochain app (from project root)
AGENTS=3 bun start     # Custom number of agents

# Desktop App
bun start:tauri        # Desktop app with Tauri
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

The project uses **atomic environment-based feature control** through the DevFeatures Service, providing fine-grained control over development features without a master switch.

### 🎯 Atomic Feature Control

Each development feature is independently controlled via environment variables:

```bash
# Mock/Testing Utilities - Shows mock data buttons in forms for testing
VITE_MOCK_BUTTONS_ENABLED=false

# Network Peers Display - Shows all network peers in test mode
VITE_PEERS_DISPLAY_ENABLED=false
```

### 🧑‍💻 Development Mode

- **Purpose**: Full development experience with debugging tools
- **Command**: `bun start` (from project root)
- **Features**: Mock data buttons, network peers display, development utilities
- **Environment**: Uses `.env` with atomic feature control
- **Service**: DevFeatures Service provides centralized feature management

### 🏗️ Build Mode

The application supports production builds through Vite:

- **Production Build**: `bun run build` (from ui directory)

Development features are controlled at runtime via the atomic environment variables in `.env`, not through different build configurations.

### 🏗️ Architecture Integration

The DevFeatures Service follows the 7-layer Effect-TS architecture:

- **Service Layer**: `DevFeaturesService` with Context.Tag dependency injection
- **Schema Validation**: Type-safe Effect Schema definitions
- **Component Integration**: Used across all form components
- **Production Safety**: Automatic removal via Vite tree-shaking

**Usage Example**:
```typescript
import { shouldShowMockButtons } from '$lib/services/devFeatures.service';

// In components without Effect context
if (shouldShowMockButtons()) {
  // Show mock data buttons
}
```

For detailed information, see [Architecture Overview](documentation/architecture.md) and [Developer Guide](documentation/guides/getting-started.md).

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
