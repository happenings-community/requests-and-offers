# Requests and Offers

A **decentralized marketplace** for the Holochain ecosystem, enabling creators, developers, and organizations to post requests and offers for services, skills, and resources.

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

```bash
# Development
bun start              # Start with 2 agents
AGENTS=3 bun start     # Custom number of agents
bun start:tauri        # Desktop app with Tauri

# Testing
bun test               # All tests
bun test:ui            # Frontend tests
bun test:unit          # Unit tests (requires Nix)
bun test:integration   # Integration tests

# Building
bun build:zomes        # Build zomes
bun build:happ         # Build complete hApp
bun package            # Package for distribution
```

> **Note**: Unit tests require Nix environment due to hREA integration. Use `nix develop --command bun test:unit` for autonomous execution.

## 📁 Project Structure

```bash
requests-and-offers/
├── dnas/requests_and_offers/    # Holochain DNA with coordinator/integrity zomes
├── ui/                          # SvelteKit frontend with 7-layer Effect-TS architecture
├── tests/                       # Tryorama integration tests
└── documentation/               # Comprehensive project documentation
```

See [Architecture Overview](documentation/architecture.md) for detailed system design.

## 🤝 Community & Licensing

- **Discord**: [Join our community](https://discord.gg/happening)
- **Website**: [hAppenings.community](https://happenings.community/)
- **Contributing**: See [Contributing Guide](documentation/guides/contributing.md)
- **License**: [Cryptographic Autonomy License v1.0](LICENSE.md)
