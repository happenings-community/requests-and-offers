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

1. Frontend (SvelteKit application with 7-layer Effect-TS architecture)
2. Backend (Holochain DNA with multiple zomes)

#### Build and Verify Setup

Before starting the development environment, build the components to verify everything works:

```bash
# Build Holochain zomes (requires Nix environment)
bun build:zomes
```

**Verification**: This should complete without errors and create compiled zomes in the target directory.

```bash
# Build complete hApp
bun build:happ
```

**Verification**: Should create `workdir/requests_and_offers.happ` file.

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

#### Verify Development Environment

After running `bun start`, you should see:

1. **Terminal Output**: Multiple URLs displayed:
   - UI servers for each agent (e.g., `http://localhost:5173`, `http://localhost:5174`)
   - Bootstrap server URL
   - Signal server URL  
   - Holochain Playground URL

2. **Browser Windows**: Automatically opened browser windows for each agent

3. **Successful Connection**: Each UI should show the main interface without connection errors

**If you see errors**:
- Check the [Troubleshooting section](#troubleshooting) below
- Ensure Nix environment is properly activated: `nix develop`
- Verify all dependencies are installed: `bun install`

### 4. Testing & Verification

#### Verify Installation with Tests

Run tests to ensure everything is working correctly:

```bash
# Run all tests (comprehensive verification)
bun test
```

This runs:
- Zome builds and compilation
- Backend Tryorama tests
- Frontend unit and integration tests  
- Status module tests

**Expected Result**: All tests should pass. If tests fail, check dependencies and environment.

#### Component Tests for Verification

```bash
# Frontend tests only (verify UI layer)
bun test:ui

# Individual zome tests (verify specific domains)
bun test:service-types  # Service types functionality (complete reference implementation)
bun test:users          # Users Organizations zome
bun test:organizations  # Organizations functionality
bun test:requests       # Requests functionality
bun test:offers         # Offers functionality
bun test:administration # Administration zome
bun test:status        # Status module
```

#### Advanced Testing (Optional)

```bash
# Frontend unit tests (requires Nix for hREA integration)
nix develop --command bun test:unit

# Integration tests
cd ui && bun test:integration

# E2E tests with Holochain
cd ui && bun test:e2e:holochain
```

### 4.5. First Development Task

**Validate Your Setup**: Complete this task to confirm your environment is ready for development.

#### Task: Explore Service Types Domain

The **Service Types** domain is 100% complete and serves as the architectural template. Use it to verify your understanding:

1. **Examine the Implementation**:

   ```bash
   # Look at the service layer (Effect-TS with dependency injection)
   cat ui/src/lib/services/zomes/serviceTypes.service.ts | head -50
   
   # Check the store implementation (Svelte 5 Runes + Effect-TS)
   cat ui/src/lib/stores/serviceTypes.store.svelte.ts | head -50
   
   # See the composable pattern (business logic abstraction)
   cat ui/src/lib/composables/domain/service-types/useServiceTypesManagement.svelte.ts
   
   # View component organization
   ls -la ui/src/lib/components/service-types/
   ```

2. **Run Domain-Specific Tests**:

   ```bash
   # Backend tests (Tryorama multi-agent)
   bun test:service-types
   
   # Frontend tests (Effect-TS integration)
   cd ui && bun test:unit -- service-types
   ```

3. **See It In Action**:
   - Navigate to Service Types section in the running app
   - Try creating a new service type
   - Edit an existing service type
   - Notice the error handling and loading states
   - Observe the Effect-TS patterns in developer tools

**Success Criteria**:
- [ ] All commands run without errors
- [ ] Service type CRUD operations work in the UI
- [ ] Tests pass for service-types domain
- [ ] You can identify the 7-layer architecture in the code

#### Next Steps After Setup

Once your installation is verified:

1. **Learn the Architecture**: Read our [Getting Started Guide](./getting-started.md) for architecture overview
2. **Understand Patterns**: Study [Effect-TS Primer](./effect-ts-primer.md) for project-specific patterns  
3. **Practice Implementation**: Follow [Development Workflow](./development-workflow.md) for feature development
4. **Join Community**: Connect on [Discord](https://discord.gg/happening) for support

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

### Common Setup Issues

#### 1. **Nix Environment Problems**

**Symptoms**: `command not found: holochain` or build failures

**Solutions**:
```bash
# Ensure Nix is properly installed
nix --version

# Enter development environment
nix develop

# If still issues, try rebuilding the environment
nix develop --rebuild
```

#### 2. **Port Conflicts**

**Symptoms**: "Port already in use" errors

**Solution**: The application automatically finds available ports for:
- UI servers (starts from 5173)
- Bootstrap server
- Signal server

If you still have conflicts, close other development servers or restart your terminal.

#### 3. **Build Issues**

**Symptoms**: Compilation errors or missing files

**Solutions**:
```bash
# Clean and rebuild zomes
bun run build:zomes

# If zome build fails, check Nix environment
nix develop --command bun run build:zomes

# Clean and rebuild hApp
bun run build:happ

# Clean Holochain sandbox if needed
rm -rf .hc*
```

#### 4. **Dependencies Issues**

**Symptoms**: Module not found or version conflicts

**Solutions**:
```bash
# Reinstall dependencies
rm -rf node_modules bun.lockb
bun install

# Reinstall UI dependencies
cd ui
rm -rf node_modules bun.lockb
bun install
cd ..
```

#### 5. **hREA Integration Issues**

**Symptoms**: hREA-related test failures or missing DNA files

**Solutions**:
```bash
# Reinstall hREA suite
bun run clean:hrea-suite
bun run download-hrea-suite

# Verify hREA installation
ls -la workdir/hrea.dna
```

#### 6. **Effect-TS Runtime Issues**

**Symptoms**: Runtime errors in Effect operations or service injection failures

**Solutions**:
- Check that all services are properly provided in layers
- Verify Context.Tag usage in service definitions
- Ensure proper error handling in Effect operations
- Review Effect-TS patterns in our [Effect-TS Primer](./effect-ts-primer.md)

#### 7. **Frontend Issues**

**Symptoms**: UI not loading, component errors, or state management issues

**Solutions**:
```bash
# Check TypeScript compilation
cd ui && bun run check

# Run linting
cd ui && bun run lint

# Clear browser cache and restart
# Check browser console for specific errors
```

#### 8. **Test Failures**

**Symptoms**: Tests failing during verification

**Detailed Solutions**:

```bash
# If backend tests fail
bun test:service-types  # Test specific domain
cd tests && bun test    # Run Tryorama tests directly

# If frontend tests fail
cd ui && bun test:unit -- --reporter=verbose

# If hREA integration tests fail
nix develop --command bun test:unit
```

### Environment Verification Checklist

If you're having persistent issues, verify your environment:

```bash
# Check all required tools
nix --version                    # Should show Nix version
bun --version                    # Should show Bun 1.0.0+
node --version                   # Should show Node 18+

# Check Nix environment
nix develop --command which holochain  # Should show holochain path
nix develop --command cargo --version  # Should show Rust toolchain

# Check project structure
ls -la workdir/                  # Should contain DNA/hApp files
ls -la ui/node_modules/          # Should contain dependencies
```

### Performance Issues

#### Slow Builds
```bash
# Enable parallel builds
export CARGO_BUILD_JOBS=4

# Use release mode for faster zome builds
bun run build:zomes -- --release
```

#### High Memory Usage
```bash
# Limit concurrent operations
export NODE_OPTIONS="--max-old-space-size=4096"

# Run with fewer agents for testing
AGENTS=1 bun start
```

### Getting Help

When reporting issues, please include:

1. **Error Output**: Full error messages and stack traces
2. **Environment Info**: OS, Nix version, Bun version
3. **Steps to Reproduce**: What commands led to the issue
4. **Context**: What were you trying to accomplish

**Support Channels**:
- **Community**: Join our [hAppenings Community](https://happenings.community/)
- **Issues**: Report on [GitHub Issues](https://github.com/Happening-Community/requests-and-offers/issues)
- **Chat**: Connect on [Discord](https://discord.gg/happening)
- **Documentation**: Check our [AI Development Rules](../ai/rules/README.md) for development guidance

### Quick Recovery Commands

If you need to completely reset your environment:

```bash
# Nuclear option - clean everything
rm -rf .hc* node_modules ui/node_modules workdir/*.dna workdir/*.happ
bun install
bun build:zomes
bun build:happ
bun start
```

**Warning**: This will remove all local data and require rebuilding everything.

### Documentation

- [Getting Started](./getting-started.md)
- [Contributing Guide](./contributing.md)
- [Technical Documentation](../architecture/overview.md) & [Technical Specifications](../technical-specs/general.md)
- [API Documentation](../technical-specs/zomes/)
- [System Architecture](../architecture/overview.md)
- [Feature Specifications](../requirements/features.md)
