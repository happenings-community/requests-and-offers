## Configuration and Deployment Standards

This project uses a sophisticated deployment system with multiple environments and automated workflows. These standards ensure consistency across development, testing, and production deployments.

### Environment Configuration

#### Environment Files Structure
```
project-root/
├── .env.example              # Template with all variables
├── .env.development          # Development environment overrides
├── .env.test                 # Test environment overrides
├── .env.production           # Production environment overrides
└── .env                     # Local overrides (gitignored)
```

#### Environment Variables

**Required Variables**
```bash
# Application Configuration
VITE_APP_ENV=development|test|production
VITE_DEV_FEATURES_ENABLED=true|false
VITE_MOCK_BUTTONS_ENABLED=true|false

# Holochain Configuration
BOOTSTRAP_PORT=dynamic_allocation
UI_PORT=dynamic_allocation
SIGNAL_PORT=dynamic_allocation

# Agent Configuration
AGENTS=2|3|...  # Number of agents for testing

# Development Features
VITE_LOG_LEVEL=debug|info|warn|error
RUST_LOG=debug|info|warn|error

# Network Configuration
NETWORK_SEED=optional_custom_seed
```

**Environment-Specific Settings**

**Development (.env.development)**
```bash
VITE_APP_ENV=development
VITE_DEV_FEATURES_ENABLED=true
VITE_MOCK_BUTTONS_ENABLED=true
VITE_LOG_LEVEL=debug
RUST_LOG=debug
AGENTS=2
```

**Test (.env.test)**
```bash
VITE_APP_ENV=test
VITE_DEV_FEATURES_ENABLED=true
VITE_MOCK_BUTTONS_ENABLED=false
VITE_LOG_LEVEL=warn
RUST_LOG=info
AGENTS=2
```

**Production (.env.production)**
```bash
VITE_APP_ENV=production
VITE_DEV_FEATURES_ENABLED=false
VITE_MOCK_BUTTONS_ENABLED=false
VITE_LOG_LEVEL=error
RUST_LOG=error
AGENTS=2
```

### Development Workflow

#### Local Development Setup

**1. Prerequisites**
```bash
# Required tools
- Bun (package manager)
- Nix (for zome compilation)
- Git (with LFS support)
```

**2. Initial Setup**
```bash
# Clone repository with submodules
git clone --recurse-submodules https://github.com/happenings-community/requests-and-offers.git
cd requests-and-offers

# Install dependencies
bun install

# Initialize Nix environment
nix develop

# Download hREA DNA (automatic on install)
# Or manually: curl -L --output workdir/hrea.dna https://github.com/h-REA/hREA/releases/download/happ-0.3.2-beta/hrea.dna
```

**3. Development Server**
```bash
# Start development server with 2 agents
bun start

# Custom agent count
AGENTS=3 bun start

# Test mode (limited dev features)
bun start:test

# Production mode (all dev features disabled)
bun start:prod

# Tauri desktop app
bun start:tauri
```

#### Port Management

The project uses dynamic port allocation to avoid conflicts:

```bash
# Check for port conflicts
lsof -ti:8888 | xargs kill -9
lsof -ti:4444 | xargs kill -9

# Manual port assignment
UI_PORT=3000 BOOTSTRAP_PORT=8888 bun start
```

### Build and Package Process

#### Building Components

**1. Zome Compilation**
```bash
# Requires Nix environment
nix develop --command bun run build:zomes

# Or directly with cargo
RUSTFLAGS='' CARGO_TARGET_DIR=target cargo build --release --target wasm32-unknown-unknown
```

**2. Frontend Build**
```bash
# Production build
bun run build:ui

# Test build
bun run build:ui:test

# Check build
cd ui && bun run check
```

**3. Complete hApp Build**
```bash
# Build complete hApp package
bun run build:happ

# Package for distribution
bun run package
```

#### Build Verification
```bash
# Verify all components built successfully
bun test  # Includes zome build verification

# Check build outputs
ls -la workdir/
ls -la ui/build/
```

### Testing Strategy

#### Test Categories

**1. Backend Tests (Tryorama)**
```bash
# Run all backend tests
bun test

# Domain-specific tests
bun test:service-types
bun test:requests
bun test:offers
bun test:users
bun test:administration

# Status-specific tests
bun test:service-types:status
bun test:service-types:tags
```

**2. Frontend Tests**
```bash
# All frontend tests
cd ui && bun test

# Unit tests
cd ui && bun test:unit

# Integration tests
cd ui && bun test:integration

# E2E tests
cd ui && bun test:e2e

# Browser-specific tests
cd ui && bun test:e2e:ci:all-browsers
cd ui && bun test:e2e:ci:mobile
```

#### Test Environment Setup

**Tryorama Configuration**
```typescript
// tests/config.ts
export const TEST_CONFIG = {
  agents: 2,
  timeout: 30000,
  retries: 3,
  logLevel: 'debug',
  mockNetwork: true
};
```

**CI/CD Testing**
```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]

jobs:
  test-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - uses: cachix/install-nix-action@v20
      - run: nix develop --command bun test

  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: bun install
      - run: bun run build:zomes
      - run: cd ui && bun test
```

### Deployment Pipeline

#### Deployment Architecture

**Repository Structure**
```
main-repository/
├── requests-and-offers/      # Main project
├── deployment/               # Deployment configuration
│   ├── kangaroo-electron/    # Desktop app repo (submodule)
│   ├── homebrew/             # Homebrew formula repo (submodule)
│   └── scripts/              # Deployment scripts
└── scripts/
    └── deployment/
        ├── deploy.sh         # Main deployment script
        ├── build.sh          # Build automation
        └── release.sh         # Release management
```

#### Deployment Script Usage

**1. Main Deployment Commands**
```bash
# Full deployment across all repositories
bun deploy

# Preview deployment without execution
bun deploy:dry-run

# Check deployment status
bun deploy:status

# Validate completed deployment
bun deploy:validate

# Rollback failed deployment
bun deploy:rollback

# Clean deployment artifacts
bun deploy:clean
```

**2. Deployment Workflow**
```bash
#!/bin/bash
# deployment/deploy.sh

set -e

# 1. Build and test main project
echo "Building main project..."
bun run build:zomes
bun run build:happ
bun test

# 2. Build frontend
echo "Building frontend..."
cd ui && bun run build && cd ..

# 3. Package web app
echo "Packaging web app..."
bun run package

# 4. Update submodules
echo "Updating deployment submodules..."
git submodule update --remote

# 5. Deploy to repositories
echo "Deploying to repositories..."
cd deployment/kangaroo-electron
git add .
git commit -m "chore: update desktop app $(date)"
git push origin main

cd ../homebrew
# Update formula with new version and checksums
# Commit and push changes

# 6. Create GitHub release
echo "Creating GitHub release..."
gh release create v$(cat package.json | jq -r .version) \
  --title "Release v$(cat package.json | jq -r .version)" \
  --notes "Automated release $(date)" \
  workdir/*.happ

echo "Deployment completed successfully!"
```

#### Environment-Specific Deployment

**Development Deployment**
```bash
# Development mode with mock features
VITE_APP_ENV=development \
VITE_DEV_FEATURES_ENABLED=true \
VITE_MOCK_BUTTONS_ENABLED=true \
bun deploy:dry-run
```

**Production Deployment**
```bash
# Production deployment with validation
VITE_APP_ENV=production \
VITE_DEV_FEATURES_ENABLED=false \
VITE_MOCK_BUTTONS_ENABLED=false \
bun deploy
```

### Git Submodule Management

#### Submodule Structure
```bash
# Initialize submodules in existing clone
git submodule update --init --recursive

# Update all submodules to latest
git submodule update --remote

# Work on specific submodule
cd deployment/kangaroo-electron
# Make changes
git add .
git commit -m "Update desktop app"
git push origin main

# Update submodule reference in main repo
cd ../../
git add deployment/kangaroo-electron
git commit -m "Update kangaroo-electron submodule"
git push origin main
```

#### Submodule Best Practices
```bash
# Always check submodule status before deployment
git submodule status

# Pull latest changes before working
git submodule update --init --recursive

# Commit submodule changes separately
cd deployment/submodule-name
git commit -m "Separate commit for submodule changes"

# Update main repo reference
cd ../../
git add deployment/submodule-name
git commit -m "Update submodule reference"
```

### Release Management

#### Version Management

**Package.json Versioning**
```json
{
  "name": "requests_and_offers",
  "version": "0.1.8",
  "engines": {
    "node": ">=16.0.0"
  }
}
```

**Changelog Maintenance**
```markdown
# CHANGELOG.md

## [0.1.8] - 2024-10-15

### Added
- New service type status management
- Enhanced error handling
- Performance improvements

### Fixed
- Connection timeout issues
- Cache invalidation bugs

### Changed
- Updated Holochain client version
- Improved UI responsiveness
```

#### Release Process
```bash
# 1. Update version numbers
# Update package.json, ui/package.json

# 2. Update changelog
# Add release notes to CHANGELOG.md

# 3. Run full test suite
bun test

# 4. Create release
bun deploy

# 5. Tag release
git tag -a v0.1.8 -m "Release version 0.1.8"
git push origin v0.1.8
```

### Monitoring and Maintenance

#### Health Checks

**Application Health**
```typescript
// health-check.ts
export const checkApplicationHealth = async () => {
  const checks = {
    holochain: await checkHolochainConnection(),
    frontend: await checkFrontendBuild(),
    cache: await checkCacheStatus(),
    network: await checkNetworkStatus()
  };

  return {
    healthy: Object.values(checks).every(check => check),
    checks,
    timestamp: new Date().toISOString()
  };
};
```

**Log Monitoring**
```bash
# Development logs
RUST_LOG=debug VITE_LOG_LEVEL=debug bun start

# Production logs
RUST_LOG=error VITE_LOG_LEVEL=error bun start:prod

# Log levels
debug > info > warn > error
```

#### Performance Monitoring

**Cache Performance**
```typescript
// cache-monitoring.ts
export const getCacheMetrics = () => {
  const cache = getEntityCache();
  return {
    size: cache.size(),
    hitRate: cache.hitRate(),
    missRate: cache.missRate(),
    oldestEntry: cache.oldestEntry(),
    newestEntry: cache.newestEntry()
  };
};
```

**Build Performance**
```bash
# Monitor build times
time bun run build:zomes
time bun run build:happ
time bun run package

# Bundle analysis
cd ui && npx vite-bundle-analyzer dist
```

### Security Considerations

#### Environment Security
```bash
# Secure environment variable handling
export VITE_APP_ENV=production
export VITE_DEV_FEATURES_ENABLED=false
export VITE_MOCK_BUTTONS_ENABLED=false

# Never commit secrets to repository
echo ".env" >> .gitignore
echo "*.key" >> .gitignore
echo "*.pem" >> .gitignore
```

#### Network Security
```bash
# Use HTTPS in production
VITE_API_URL=https://api.example.com

# Validate certificates
curl --cacert cert.pem https://api.example.com
```

### Troubleshooting Guide

#### Common Issues

**1. Port Conflicts**
```bash
# Error: Port already in use
lsof -ti:8888 | xargs kill -9

# Use different ports
UI_PORT=3001 BOOTSTRAP_PORT=8889 bun start
```

**2. Zome Compilation Errors**
```bash
# Ensure Nix environment
nix develop

# Clean build
rm -rf target/
bun run build:zomes

# Check Rust version
rustc --version
```

**3. Dependency Issues**
```bash
# Clear cache
rm -rf node_modules bun.lockb
bun install

# Rebuild zomes
bun run build:zomes
```

**4. Connection Issues**
```bash
# Check Holochain conductor
hc sandbox status

# Restart network
hc sandbox clean
bun start
```

#### Debug Commands
```bash
# Check application status
bun deploy:status

# Validate deployment
bun deploy:validate

# Run with debug logging
RUST_LOG=debug VITE_LOG_LEVEL=debug bun start

# Check test coverage
bun test:coverage
```

By following these configuration and deployment standards, we ensure consistent, reliable, and maintainable deployments across all environments in the project.