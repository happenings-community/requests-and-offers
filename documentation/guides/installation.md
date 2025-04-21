# Installation Guide

This guide provides detailed instructions for installing and setting up the Requests & Offers application.

## System Requirements

- Linux, macOS, or Windows with WSL2
- Holochain Development Environment
- Bun 1.0.0 or later

## Installation Steps

### 1. Development Environment Setup

#### Install Holochain

Follow the [official Holochain installation guide](https://developer.holochain.org/get-started/#2-installing-holochain-development-environment) for your operating system.

You can quickly install Holochain using this command:

```bash
bash <(curl https://holochain.github.io/holochain/setup.sh)
```

This will set up the complete Holochain development environment, including Nix and all necessary components.

### 2. Project Setup

#### Clone the Repository

```bash
git clone https://github.com/Happening-Community/requests-and-offers.git
cd requests-and-offers
```

#### Enter Nix Shell

```bash
nix develop
```

#### Install Dependencies

```bash
bun install
```

This will also download the hREA suite as part of the postinstall script.

### 3. Development Setup

The application consists of two main parts:

1. Frontend (SvelteKit application)
2. Backend (Holochain DNA with multiple zomes)

#### Start Development Environment

```bash
# Start with default configuration (2 agents)
bun start

# Start with custom number of agents
AGENTS=3 bun start

# Start with Tauri (desktop application)
bun start:tauri
```

This will:

1. Clean the Holochain sandbox
2. Build the hApp
3. Start the UI server
4. Launch the Holochain environment
5. Start the Holochain Playground

### 4. Testing

#### Run All Tests

```bash
bun test
```

This runs:

- Zome builds
- Backend tests
- Frontend tests
- Status module tests

#### Component Tests

```bash
# Frontend tests only
bun test:ui

# Individual zome tests
bun test:misc           # Misc zome functionality
bun test:users          # Users Organizations zome
bun test:organizations  # Organizations functionality
bun test:requests       # Requests functionality
bun test:offers         # Offers functionality
bun test:administration # Administration zome
bun test:status        # Status module
```

### 5. Building

#### Development Builds

```bash
# Build Holochain zomes
bun build:zomes

# Build complete hApp (includes zome builds)
bun build:happ
```

#### Production Package

```bash
# Create production package (includes hApp and UI)
bun package
```

### 6. hREA Integration

The project integrates with hREA (Holochain Resource-Event-Agent). The hREA suite is automatically downloaded during installation, but you can manage it with:

```bash
# Re-download hREA suite
bun run download-hrea-suite

# Remove hREA suite
bun run clean:hrea-suite
```

## Development Resources

- [Technical Documentation](../architecture/overview.md)
- [API Documentation](../technical-specs/zomes/)
- [Contributing Guide](./contributing.md)
- [Feature Specifications](../requirements/features.md)

## Troubleshooting

### Common Issues

1. **Port Conflicts**
   The application automatically finds available ports for:
   - UI server
   - Bootstrap server
   - Signal server

2. **Build Issues**

   ```bash
   # Clean and rebuild
   bun run build:zomes
   bun run build:happ
   ```

3. **hREA Integration Issues**

   ```bash
   # Reinstall hREA suite
   bun run clean:hrea-suite
   bun run download-hrea-suite
   ```

### Getting Help

- Join our [Community](https://happenings.community/)
- Check [GitHub Issues](https://github.com/Happening-Community/requests-and-offers/issues)
- Connect on [Discord](https://discord.gg/happening)

### Documentation

- [Getting Started](./getting-started.md)
- [Contributing Guide](./contributing.md)
- [Technical Documentation](../architecture/overview.md) & [Technical Specifications](../technical-specs/general.md)
- [API Documentation](../technical-specs/zomes/)
- [System Architecture](../architecture/overview.md)
- [Feature Specifications](../requirements/features.md)
