---
name: Deployment Automation
description: This skill should be used when deploying, releasing, packaging, managing cross-platform builds, or troubleshooting CI/CD pipelines for Holochain hApps
---

# Deployment Automation Skill

Complete deployment system for Holochain hApps with proven patterns from successful production releases (v0.1.9, 100% cross-platform success).

## Capabilities

- **Multi-Repository Coordination**: Main repo (WebHapp), Kangaroo submodule (desktop apps), Homebrew (macOS distribution), git submodule sync
- **Cross-Platform Deployment**: macOS ARM64 + x64, Windows x64, Linux DEB + AppImage, WebApp packaging, Holostrap production network
- **CI/CD Pipeline**: GitHub Actions workflows, manual GitHub CLI asset uploads (100% reliable), cross-platform build verification
- **Release Automation**: 7-step manual process (proven 100% success), version sync across repos, changelog and release notes

## Quick Start

### New Release
"Deploy version 0.2.0 with all platforms"

### Deployment Troubleshooting
"The macOS build failed to upload assets"

### Environment Setup
"Set up deployment environment for a new team member"

## Proven Patterns

### CI/CD Asset Upload Fix

This pattern eliminated asset upload failures in v0.1.9:

```yaml
# Instead of unreliable electron-builder auto-publishing
- name: build and upload the app (macOS)
  run: |
    yarn build:mac-arm64
    ls dist
    # Use wildcard to handle filename variations
    find dist -name "*.dmg" -exec gh release upload "v${{ env.APP_VERSION }}" {} \;
```

### 7-Step Release Process

1. **Main Repository Updates** - Version bump + changelog
2. **WebHapp Build** - `bun package` in Nix environment
3. **GitHub Release Creation** - Manual release with webhapp upload
4. **Kangaroo Repository Update** - Copy webhapp + version sync
5. **CI/CD Trigger** - Push to release branch
6. **Build Monitoring** - Cross-platform build verification
7. **Release Notes Finalization** - Cross-link desktop app links

### Cross-Platform Build Benchmarks (v0.1.9)

- **macOS ARM64**: 1m46s (fastest)
- **macOS x64**: 3m2s
- **Windows x64**: 2m54s
- **Linux x64**: ~4m (includes post-install scripts)

## Architecture Integration

### Repository Structure
```
Main Repository (requests-and-offers)
├── WebHapp build and packaging
├── Release coordination and version management
└── Cross-repository linking

Kangaroo Submodule (deployment/kangaroo-electron)
├── Desktop app builds (Windows/macOS/Linux)
├── GitHub Actions CI/CD + code signing
└── Asset upload automation

Homebrew Repository (deployment/homebrew)
├── Formula management + checksum updates
└── macOS distribution
```

### Deployment Flow
```
1. Pre-flight Validation    → Environment checks, auth verification
2. Version Synchronization  → All repositories aligned
3. WebHapp Build            → Production-ready bundle
4. Release Creation         → GitHub release with webhapp
5. Kangaroo Update          → Copy webhapp, trigger CI/CD
6. Multi-Platform Builds    → Parallel builds across platforms
7. Asset Verification       → All binaries uploaded successfully
8. Cross-Repository Updates → Homebrew formula, documentation
9. Post-Release Validation  → Downloads tested, links verified
```

## Templates and Automation

- **GitHub Workflows**: Optimized CI/CD pipeline templates
- **Kangaroo Config**: Production-ready desktop app configuration
- **Deployment Config**: Multi-environment configuration management
- **Release Notes**: Structured documentation templates
- **Pre-flight Checks**: Environment validation and prerequisites
- **Rollback Procedures**: Emergency recovery automation

## Troubleshooting

- **Asset Upload Failures**: Builds complete but assets missing in release. Cause: electron-builder auto-publishing fails for branch builds. Fix: manual GitHub CLI uploads with wildcard patterns.
- **Build Failures**: Verify webhapp exists in pouch directory, check version sync across repos, ensure Nix environment, validate GitHub CLI auth.
- **Repository Sync Issues**: Submodules out of sync or version mismatches. Fix: proper git branch management and submodule updates.
- **macOS**: Code signing certificate management
- **Windows**: EV certificate configuration
- **Linux**: Post-install script permissions
- **Recovery**: Emergency rollback, partial release recovery, asset re-upload, repository resynchronization

## Performance Metrics (v0.1.9)

- **Platform Success Rate**: 100% (5/5 platforms)
- **Total Release Time**: ~2.5 hours (including issue resolution)
- **Build Retry Count**: 1 retry (macOS upload fix)
- **Asset Upload Success**: 100% after manual pattern implementation

## Best Practices

### Release Management
1. Follow the 7-step process exactly
2. Use manual upload strategy over auto-publishing
3. Use wildcard file discovery to eliminate filename mismatch failures
4. Ensure cross-repository synchronization before starting

### Build Optimization
1. Run all platform builds concurrently
2. Validate all uploads before proceeding
3. Use Nix for consistent build environments
4. Separate dev/test/prod configurations

### Error Prevention
1. Run pre-flight validation before every release
2. Automate version synchronization
3. Have rollback procedures ready
4. Maintain comprehensive release notes

## Knowledge Preservation

This skill preserves critical deployment knowledge:
- **Proven Patterns**: Battle-tested from production releases
- **Troubleshooting**: Solutions to common deployment issues
- **Best Practices**: Evolution of deployment processes
- **Performance Benchmarks**: Real-world metrics
- **Recovery Procedures**: Emergency response patterns

---

**Production-ready deployment infrastructure with proven reliability from successful Holochain application releases.**
