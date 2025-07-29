# Kangaroo Electron Deployment Process

**Comprehensive guide for deploying cross-platform desktop applications using Kangaroo Electron framework**

---

## Overview

The Kangaroo Electron deployment process enables cross-platform desktop application distribution for Holochain applications. This document covers the complete workflow from initial setup through production release, based on real-world implementation experience with the Requests and Offers project.

### Repository Architecture

The deployment process involves coordination between three repositories:

- **Main Repository**: `happenings-community/requests-and-offers` (webapp and release management)
- **Desktop Apps Repository**: `happenings-community/requests-and-offers-kangaroo-electron` (Electron builds and asset generation)
- **Homebrew Repository**: `happenings-community/homebrew-requests-and-offers` (macOS package manager distribution)

---

## Technical Architecture

### Core Components

#### 1. Kangaroo Configuration (`kangaroo.config.ts`)
```typescript
import { defineConfig } from './src/main/defineConfig';

export default defineConfig({
  appId: 'requests-and-offers.happenings-community.kangaroo-electron',
  productName: 'Requests and Offers',
  version: '0.1.0-alpha.5.1',
  macOSCodeSigning: false,
  windowsEVCodeSigning: false,
  fallbackToIndexHtml: true,
  autoUpdates: false,
  systray: true,
  passwordMode: 'no-password',
  networkSeed: 'alpha-test-2025',
  bootstrapUrl: 'https://dev-test-bootstrap2.holochain.org/',
});
```

#### 2. WebHapp Integration
The deployment process uses two methods for obtaining the `.webhapp` file:

**Method A: Direct File Inclusion**
- Place `.webhapp` file in `pouch/` directory
- Suitable for local testing and development builds
- File is bundled directly into the desktop application

**Method B: URL-Based Fetching** (Recommended for Production)
- Configure `web-happ.yaml` with download URL
- Kangaroo fetches `.webhapp` during build process
- Enables automatic updates and centralized distribution

#### 3. Build Matrix
GitHub Actions builds for four platforms simultaneously:
- **Windows**: `windows-2022` → `.exe` installer
- **Linux**: `ubuntu-22.04` → `.AppImage` and `.deb` packages
- **macOS Intel**: `macos-13` → `x64.dmg`
- **macOS Apple Silicon**: `macos-latest` → `arm64.dmg`

---

## Branch Strategy

### Repository Branch Structure

```
main branch (development)
├── Feature development
├── Bug fixes
├── Documentation updates
└── Code reviews

release branch (production)
├── Production-ready code
├── Webhapp files (committed)
├── Build triggers
└── Asset generation
```

### Key Principles
- **Main Branch**: No `.webhapp` files committed (development focus)
- **Release Branch**: `.webhapp` files allowed (production deployment)
- **Build Trigger**: Push to `release` branch initiates multi-platform builds
- **Asset Upload**: Requires existing GitHub release before build completion

---

## Deployment Workflow

### Phase 1: Preparation

#### 1.1 Update Main Repository
```bash
# Navigate to main repository
cd requests-and-offers

# Update version and prepare webapp
bun build:happ
bun package

# Commit changes
git add .
git commit -m "feat: release v0.1.0-alpha.5.1 with network reliability fixes"
git push origin main
```

#### 1.2 Create Main Repository Release
```bash
# Create GitHub release for main repository
gh release create v0.1.0-alpha.5.1 \
  --title "v0.1.0-alpha.5.1" \
  --notes-file release_notes.md \
  --prerelease

# Upload webapp assets
gh release upload v0.1.0-alpha.5.1 \
  workdir/requests_and_offers.webhapp
```

### Phase 2: Kangaroo Repository Setup

#### 2.1 Update Kangaroo Configuration
```bash
# Navigate to Kangaroo repository
cd requests-and-offers-kangaroo-electron

# Ensure on release branch
git checkout release
git merge main --no-ff
```

#### 2.2 Configure WebHapp Source
Update `pouch/web-happ.yaml`:
```yaml
name: "Requests and Offers"
description: "Holochain app for community requests and offers exchange"
webhapp_url: "https://github.com/happenings-community/requests-and-offers/releases/download/v0.1.0-alpha.5.1/requests_and_offers.webhapp"
```

#### 2.3 Update Version Information
Update `kangaroo.config.ts`:
```typescript
version: '0.1.0-alpha.5.1'
```

### Phase 3: Desktop App Release Creation

#### 3.1 Create Draft Release
```bash
# Create draft release in Kangaroo repository
gh release create v0.1.0-alpha.5.1 \
  --repo happenings-community/requests-and-offers-kangaroo-electron \
  --title "v0.1.0-alpha.5.1 Desktop Apps" \
  --notes "Cross-platform desktop applications with network reliability improvements" \
  --draft \
  --prerelease
```

#### 3.2 Trigger Build Process
```bash
# Commit and push to trigger GitHub Actions
git add .
git commit -m "release: trigger complete asset build for alpha.5.1

Ensures all platform assets (Windows, macOS, Linux) are uploaded 
to the existing v0.1.0-alpha.5.1 release with network reliability fixes."

git push origin release
```

### Phase 4: Build Monitoring and Asset Verification

#### 4.1 Monitor Build Progress
```bash
# Check build status
gh run list --repo happenings-community/requests-and-offers-kangaroo-electron --limit 3

# View detailed build information
gh run view <run-id> --repo happenings-community/requests-and-offers-kangaroo-electron
```

#### 4.2 Verify Asset Generation
Expected assets after successful build:
```
✅ requests-and-offers.happenings-community.kangaroo-electron-0.1.0-alpha.5.1-setup.exe
✅ requests-and-offers.happenings-community.kangaroo-electron-0.1.0-alpha.5.1-x64.dmg
✅ requests-and-offers.happenings-community.kangaroo-electron-0.1.0-alpha.5.1-arm64.dmg
✅ requests-and-offers.happenings-community.kangaroo-electron-0.1.0-alpha.5.1.AppImage
✅ requests-and-offers.happenings-community.kangaroo-electron_0.1.0-alpha.5.1_amd64.deb
✅ latest.yml, latest-mac.yml, latest-linux.yml (update manifests)
✅ Various .blockmap files for efficient updates
```

#### 4.3 Publish Desktop Release
```bash
# Publish the draft release
gh release edit v0.1.0-alpha.5.1 \
  --repo happenings-community/requests-and-offers-kangaroo-electron \
  --draft=false

# Verify publication
gh release view v0.1.0-alpha.5.1 \
  --repo happenings-community/requests-and-offers-kangaroo-electron
```

### Phase 5: Distribution Updates

#### 5.1 Update Main Repository Release
Update the main repository release notes with correct desktop app download links:

```markdown
| Platform | Architecture | Download |
|----------|-------------|----------|
| **Windows** | x64 | [Download .exe](https://github.com/happenings-community/requests-and-offers-kangaroo-electron/releases/download/v0.1.0-alpha.5.1/requests-and-offers.happenings-community.kangaroo-electron-0.1.0-alpha.5.1-setup.exe) |
| **macOS** | Apple Silicon | [Download .dmg](https://github.com/happenings-community/requests-and-offers-kangaroo-electron/releases/download/v0.1.0-alpha.5.1/requests-and-offers.happenings-community.kangaroo-electron-0.1.0-alpha.5.1-arm64.dmg) |
| **macOS** | Intel | [Download .dmg](https://github.com/happenings-community/requests-and-offers-kangaroo-electron/releases/download/v0.1.0-alpha.5.1/requests-and-offers.happenings-community.kangaroo-electron-0.1.0-alpha.5.1-x64.dmg) |
| **Linux** | x64 | [Download .AppImage](https://github.com/happenings-community/requests-and-offers-kangaroo-electron/releases/download/v0.1.0-alpha.5.1/requests-and-offers.happenings-community.kangaroo-electron-0.1.0-alpha.5.1.AppImage) |
| **Linux** | x64 | [Download .deb](https://github.com/happenings-community/requests-and-offers-kangaroo-electron/releases/download/v0.1.0-alpha.5.1/requests-and-offers.happenings-community.kangaroo-electron_0.1.0-alpha.5.1_amd64.deb) |
```

#### 5.2 Homebrew Formula Update

##### Calculate SHA256 Checksums
```bash
# Download and calculate checksums for macOS assets
curl -sL "https://github.com/happenings-community/requests-and-offers-kangaroo-electron/releases/download/v0.1.0-alpha.5.1/requests-and-offers.happenings-community.kangaroo-electron-0.1.0-alpha.5.1-arm64.dmg" | sha256sum

curl -sL "https://github.com/happenings-community/requests-and-offers-kangaroo-electron/releases/download/v0.1.0-alpha.5.1/requests-and-offers.happenings-community.kangaroo-electron-0.1.0-alpha.5.1-x64.dmg" | sha256sum
```

##### Update Homebrew Formula
Update `Casks/requests-and-offers.rb`:
```ruby
cask "requests-and-offers" do
  version "0.1.0-alpha.5.1"
  
  if Hardware::CPU.arm?
    sha256 "73c996cd4ce846aaed93e00a77b0ba49aa9f058b91da4b47f6721dd4686b833e"
    url "https://github.com/happenings-community/requests-and-offers-kangaroo-electron/releases/download/v#{version}/requests-and-offers.happenings-community.kangaroo-electron-#{version}-arm64.dmg"
  else
    sha256 "7cfc29e5f166c3dcb839586d6a7832353ea238b5ce8c6a52828c0e01659f42b3"
    url "https://github.com/happenings-community/requests-and-offers-kangaroo-electron/releases/download/v#{version}/requests-and-offers.happenings-community.kangaroo-electron-#{version}-x64.dmg"
  end
  
  name "Requests and Offers"
  desc "Holochain app for community requests and offers exchange"
  homepage "https://github.com/happenings-community/requests-and-offers"

  app "Requests and Offers.app"

  # Auto-remove quarantine for better UX
  postflight do
    system_command "/usr/bin/xattr",
                   args: ["-r", "-d", "com.apple.quarantine", "#{appdir}/Requests and Offers.app"],
                   sudo: false
  end

  zap trash: [
    "~/Library/Application Support/requests-and-offers.happenings-community.kangaroo-electron",
    "~/Library/Preferences/requests-and-offers.happenings-community.kangaroo-electron.plist",
    "~/Library/Logs/requests-and-offers.happenings-community.kangaroo-electron",
  ]
end
```

---

## Build Process Deep Dive

### GitHub Actions Workflow

The Kangaroo build process uses a sophisticated GitHub Actions workflow that:

1. **Environment Setup**: Configures Node.js, Rust, and platform-specific tools
2. **Dependency Installation**: Installs Bun, Holochain binaries, and build dependencies
3. **WebHapp Resolution**: Downloads webhapp from URL or uses local file
4. **Cross-Platform Compilation**: Builds for all target platforms simultaneously
5. **Asset Generation**: Creates installers, packages, and update manifests
6. **Release Upload**: Uploads all assets to the existing GitHub release

### Build Requirements
- **Node.js**: Version 18+ with Bun package manager
- **Rust**: For Holochain binary integration
- **Platform Tools**: 
  - Windows: NSIS for installer creation
  - macOS: DMG creation tools and code signing capabilities
  - Linux: AppImage and Debian packaging tools

### Asset Types Generated
- **Installers**: `.exe` (Windows), `.dmg` (macOS), `.deb` (Linux)
- **Portable**: `.AppImage` (Linux)
- **Update Manifests**: YAML files for auto-update functionality
- **Block Maps**: For efficient delta updates

---

## Quality Assurance

### Pre-Release Testing

#### Local Testing
```bash
# Test webhapp functionality
bun start

# Verify build process
bun build:happ
bun package

# Local Kangaroo testing
cd requests-and-offers-kangaroo-electron
yarn install
yarn dev
```

#### Cross-Platform Validation
- **Windows**: Test installer, application startup, and core functionality
- **macOS**: Verify code signing, quarantine removal, and Intel/ARM compatibility
- **Linux**: Test both AppImage and .deb installations

### Post-Release Verification
- Download and install each platform variant
- Verify application launches and connects to Holochain network
- Test core features and user workflows
- Confirm auto-update mechanisms (if enabled)

---

## Troubleshooting

### Common Issues

#### Build Failures
**Problem**: Platform-specific build failures
**Solution**: Check GitHub Actions logs for platform-specific errors
```bash
gh run view <run-id> --log --repo happenings-community/requests-and-offers-kangaroo-electron
```

#### Missing Assets
**Problem**: Some platform assets not uploaded to release
**Solution**: Verify release exists before build completion
```bash
# Check if release exists and is accessible
gh release view v0.1.0-alpha.5.1 --repo happenings-community/requests-and-offers-kangaroo-electron
```

#### WebHapp Download Issues
**Problem**: Build fails to fetch webhapp from URL
**Solution**: Verify URL accessibility and webhapp file validity
```bash
# Test webhapp URL manually
curl -L "https://github.com/happenings-community/requests-and-offers/releases/download/v0.1.0-alpha.5.1/requests_and_offers.webhapp" --output test.webhapp
```

#### Homebrew Installation Issues
**Problem**: brew install fails with checksum mismatch
**Solution**: Recalculate and update SHA256 checksums
```bash
# Recalculate checksums
shasum -a 256 downloaded-asset.dmg
```

### Recovery Procedures

#### Incomplete Build Recovery
If a build fails partially:
1. Check which platforms completed successfully
2. Re-trigger build by making minimal commit to release branch
3. Monitor build progress for any infrastructure issues
4. Verify all assets upload correctly before publishing

#### Release Coordination Issues
If release coordination fails between repositories:
1. Publish Kangaroo release first to establish stable URLs
2. Update main repository release with correct asset links
3. Verify all download links are functional
4. Update Homebrew formula with correct checksums

---

## Security Considerations

### Code Signing
- **macOS**: Developer ID Application certificates required for distribution
- **Windows**: Extended Validation certificates recommended for trusted installation
- **Linux**: GPG signing for repository distribution

### Network Security
- All webhook URLs use HTTPS
- Bootstrap nodes configured with secure endpoints
- Network seeds configured for appropriate environments (development/production)

### Application Security
- Quarantine removal handled securely via postflight scripts
- Application permissions minimized to required functionality
- Update mechanisms secured with signature verification

---

## Performance Optimization

### Build Time Optimization
- Parallel platform builds reduce total build time to ~5-10 minutes
- Caching strategies for dependencies and build artifacts
- Optimized Docker images for consistent build environments

### Asset Size Optimization
- Compression for all downloadable assets
- Delta updates using block maps for efficient updates
- Platform-specific optimizations (e.g., universal binaries for macOS)

### Distribution Optimization
- CDN distribution for faster downloads
- Regional mirrors for global accessibility
- Torrent distribution for large assets (optional)

---

## Maintenance and Updates

### Version Management
- Semantic versioning for all releases
- Consistent version numbers across all repositories
- Automated version bumping where possible

### Dependency Updates
- Regular updates to Kangaroo framework
- Holochain binary updates coordinated with main application
- Security patches applied promptly across all platforms

### Documentation Maintenance
- Keep deployment documentation current with process changes
- Document lessons learned from each release cycle
- Maintain troubleshooting guides based on real issues encountered

---

## Future Enhancements

### Planned Improvements
- **Automated Testing**: Cross-platform E2E testing in CI/CD pipeline
- **Code Signing Automation**: Automated certificate management and signing
- **Auto-Update Implementation**: In-application update mechanisms
- **Telemetry Integration**: Usage analytics and crash reporting

### Scalability Considerations
- **Multi-App Support**: Framework extension for multiple Holochain applications
- **Enterprise Distribution**: Corporate deployment strategies and management
- **Store Distribution**: App store submissions and management
- **Continuous Deployment**: Automated release pipelines with quality gates

---

## Resources and References

### Documentation
- [Kangaroo Electron Framework](https://github.com/holochain/kangaroo)
- [Holochain Developer Documentation](https://developer.holochain.org/)
- [Electron Builder Documentation](https://www.electron.build/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

### Tools and Services
- **GitHub CLI**: `gh` command-line tool for release management
- **Homebrew**: macOS package manager integration
- **Code Signing Services**: Platform-specific certificate management
- **CDN Services**: Global asset distribution networks

### Community Support
- [Holochain Community Forum](https://forum.holochain.org/)
- [GitHub Discussions](https://github.com/happenings-community/requests-and-offers/discussions)
- [Developer Documentation](https://github.com/happenings-community/requests-and-offers/tree/main/documentation)

---

*This documentation is based on real-world implementation experience with the Requests and Offers project Alpha 5.1 release process, completed successfully on July 29, 2025.*