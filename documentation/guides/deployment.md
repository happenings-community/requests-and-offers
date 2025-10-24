# Deployment Guide: Current Status & Working Process

**Guide for deploying Requests and Offers across all platforms and repositories**

---

## 🚨 Current Status: Manual Process Working, Automation Scripts Broken

### ✅ **What Actually Works (v0.1.9 Proven)**
- **Manual 7-Step Process**: Reliable deployment using documented manual procedures
- **Cross-Platform Builds**: All 5 platforms building successfully (macOS ARM64/x64, Windows, Linux DEB/AppImage)
- **Manual GitHub CLI Uploads**: More reliable than electron-builder auto-publishing
- **Wildcard Asset Patterns**: Dynamic file discovery prevents filename mismatches
- **Cross-Repository Coordination**: Established workflow between main repo → kangaroo submodule

### ❌ **What's Currently Broken**
- **Automated Deployment Scripts**: Non-functional due to path mismatches and structural issues
- **Package.json Deploy Commands**: Refer to non-existent scripts
- **Single-Command Automation**: Not available - requires manual 7-step process
- **CI/CD Integration**: Partial - GitHub Actions work but require manual trigger

### 🎯 **Recommendation**
Use the **Manual 7-Step Process** documented in [Release Checklist](../RELEASE_CHECKLIST.md) until automated deployment system is completely reworked. This process is proven, reliable, and successfully delivered v0.1.9.

---

## 🏗️ Current Architecture

### Repository Structure (Actual)

```
requests-and-offers/                          # Main Repository
├── workdir/
│   └── requests_and_offers.webhapp     # Built WebHapp package
├── deployment/
│   ├── kangaroo-electron/                  # Submodule: Desktop App
│   │   ├── .github/workflows/
│   │   │   └── release.yaml          # CI/CD Pipeline (WORKING)
│   │   ├── pouch/                       # WebHapp staging
│   │   ├── scripts/                     # Build scripts
│   │   └── dist/                        # Build artifacts
│   └── homebrew/                       # Submodule: macOS Formula
└── documentation/
    └── RELEASE_CHECKLIST.md              # Working manual process
```

### Working Deployment Flow (v0.1.9 Proven)

```
1. Environment Setup → 2. WebHapp Build → 3. Main Release Creation →
4. Kangaroo Update → 5. CI/CD Trigger → 6. Build Monitoring →
7. Asset Linking
```

### Repository Coordination (Working)

- **Main Repository**: `happenings-community/requests-and-offers`
  - ✅ WebHapp build and packaging (`bun package`)
  - ✅ GitHub release creation with webhapp asset
  - ✅ Version management (package.json, CHANGELOG.md)

- **Kangaroo Submodule**: `deployment/kangaroo-electron`
  - ✅ Cross-platform builds via GitHub Actions
  - ✅ Manual GitHub CLI uploads (reliable pattern)
  - ✅ Wildcard file discovery (`find dist -name "*.dmg"`)
  - ✅ Build monitoring and validation

- **Homebrew Submodule**: `deployment/homebrew`
  - ✅ Formula updates with SHA256 checksums
  - ✅ Manual commit and push workflow

### What's Missing (Broken Automation)

```
❌ scripts/deployment/deploy.sh               # Does not exist
❌ scripts/deployment/lib/validation.sh        # Does not exist
❌ scripts/deployment/lib/version-manager.sh     # Does not exist
❌ scripts/deployment/lib/webapp-builder.sh      # Does not exist
❌ scripts/deployment/lib/kangaroo-deployer.sh   # Does not exist
❌ scripts/deployment/lib/homebrew-updater.sh    # Does not exist
❌ package.json deploy commands                # Refer to missing scripts
```

---

## 🛠️ Current Setup & Prerequisites

### Required Tools

```bash
# Essential tools (all working)
git --version
gh --version        # GitHub CLI (authenticated)
bun --version
nix --version      # Required for zome compilation

# Authentication check
gh auth status      # Must show write access to both repositories
```

### Repository Setup (Working)

The project uses git submodules for unified management:

```bash
# Clone main repository with submodules
git clone --recurse-submodules https://github.com/happenings-community/requests-and-offers.git
cd requests-and-offers

# Initialize submodules in existing clone
git submodule update --init --recursive

# Update submodules to latest versions
git submodule update --remote

# Verify submodule status
git submodule status
```

**Working Submodule Structure**:
- **Main Repository**: `happenings-community/requests-and-offers` (root)
- **Kangaroo Repository**: `deployment/kangaroo-electron` (submodule) ✅
- **Homebrew Repository**: `deployment/homebrew` (submodule) ✅

### Pre-Flight Checks (Working)

```bash
# From main repository root
cd /home/soushi888/Projets/Holochain/requests-and-offers

# Verify clean working directory
git status

# Check submodules are initialized
ls -la deployment/kangaroo-electron/.git
ls -la deployment/homebrew/.git

# Verify GitHub CLI access
gh auth status

# Test Nix environment (for zome builds)
nix develop --command "echo 'Nix shell working'"
```

---

## 🚀 Current Working Deployment Process

### Overview

The following **manual 7-step process** is proven to work reliably and successfully delivered v0.1.9. This should be used until automated deployment system is completely reworked.

### Step 1: Environment Setup & Preparation

```bash
# Navigate to main repository
cd /home/soushi888/Projets/Holochain/requests-and-offers

# Verify clean working directory
git status

# Check submodules are initialized
git submodule status

# Update submodules if needed
git submodule update --init --recursive

# Verify GitHub CLI access
gh auth status
```

### Step 2: WebHapp Build

```bash
# Enter Nix shell for zome compilation
nix develop

# Build WebHapp package
bun package

# Verify webhapp was created successfully
ls -la workdir/requests_and_offers.webhapp

# Ensure it was built in test mode (no dev features)
# The build should be ~5-10MB for test mode
```

### Step 3: Main Repository Release

```bash
# Create git tag for new version
git tag v0.1.X

# Create GitHub release with webhapp
gh release create v0.1.X \
  --title "🚀 Requests and Offers v0.1.X" \
  --notes "### What's New

[Feature highlights from CHANGELOG.md]

### Desktop Apps 📱
🔄 Building cross-platform desktop applications...

### Installation
[WebApp installation instructions]

### Technical Specifications
- **Network**: Holostrap alpha network
- **Holochain Version**: 0.5.5
- **UI Framework**: SvelteKit + Svelte 5

---

⚠️ **Note**: Desktop applications are currently building. Download links will be added automatically when build process completes."

# Upload webhapp as first asset
gh release upload v0.1.X workdir/requests_and_offers.webhapp --clobber
```

### Step 4: Kangaroo Repository Update

```bash
# Navigate to kangaroo submodule
cd deployment/kangaroo-electron

# Copy fresh webhapp to kangaroo pouch directory
cp ../../workdir/requests_and_offers.webhapp pouch/

# Verify version files are consistent
# Check package.json and kangaroo.config.ts have correct version

# Commit webhapp update (this triggers CI/CD)
git add pouch/requests_and_offers.webhapp
git commit -m "build: update webhapp for v0.1.X release"

# Push to release branch to trigger GitHub Actions
git checkout release
git merge main --no-edit
git push origin release

# Return to main repository root
cd ../..
```

### Step 5: Build Monitoring

```bash
# Monitor GitHub Actions progress
gh run list --limit=5 --repo happenings-community/kangaroo-electron

# View specific run logs if needed
gh run view [RUN_ID] --log --repo happenings-community/kangaroo-electron

# Expected platforms: macOS ARM64, macOS x64, Windows, Linux DEB/AppImage
# Build time: ~2-4 minutes per platform
# Total time: ~10-15 minutes for all platforms
```

### Step 6: Asset Upload & Verification

```bash
# After CI/CD completes, verify all assets exist
gh release view v0.1.X --repo happenings-community/kangaroo-electron

# Expected assets:
# - Requests-and-Offers-{version}-arm64-mac.dmg
# - Requests-and-Offers-{version}-x64-mac.dmg
# - Requests-and-Offers-{version}-x64-win.exe
# - Requests-and-Offers-{version}-x64-linux.deb
# - Requests-and-Offers-{version}.AppImage
# - checksums.txt
```

### Step 7: Release Notes Finalization

```bash
# Update main repository release with working desktop links
gh release edit v0.1.X \
  --notes "### What's New

[Features from CHANGELOG.md]

### Desktop Apps 📱

#### macOS
- **Apple Silicon**: [Download .dmg](https://github.com/happenings-community/kangaroo-electron/releases/download/v0.1.X/Requests-and-Offers-0.1.X-arm64-mac.dmg)
- **Intel**: [Download .dmg](https://github.com/happenings-community/kangaroo-electron/releases/download/v0.1.X/Requests-and-Offers-0.1.X-x64-mac.dmg)

#### Windows
- [Download .exe](https://github.com/happenings-community/kangaroo-electron/releases/download/v0.1.X/Requests-and-Offers-0.1.X-x64-win.exe)

#### Linux
- **Debian/Ubuntu**: [Download .deb](https://github.com/happenings-community/kangaroo-electron/releases/download/v0.1.X/Requests-and-Offers-0.1.X-x64-linux.deb)
- **Universal Portable**: [Download AppImage](https://github.com/happenings-community/kangaroo-electron/releases/download/v0.1.X/Requests-and-Offers-0.1.X.AppImage)

### Installation
[Platform-specific installation instructions]

### Technical Specifications
- **Network**: Holostrap alpha network
- **Desktop App**: Cross-platform Electron application
- **WebApp**: Holochain hApp with SvelteKit frontend"

# Test download links work
curl -I https://github.com/happenings-community/kangaroo-electron/releases/download/v0.1.X/Requests-and-Offers-0.1.X-arm64-mac.dmg
```

---

## 🔧 Working Patterns from v0.1.9 Release

### Manual GitHub CLI Uploads (Proven Pattern)

**Key Discovery**: Manual GitHub CLI uploads are more reliable than electron-builder auto-publishing for branch builds.

**Working Asset Upload Pattern**:
```yaml
# From .github/workflows/release.yaml (lines 73-85)
# macOS Example (reliable):
- name: build and upload app WITHOUT code signing (macOS x86)
  run: |
    yarn build:mac-x64
    ls dist
    # Upload any .dmg file found in dist directory
    find dist -name "*.dmg" -exec gh release upload "v${{ steps.kangarooConfig.outputs.APP_VERSION }}" {} \;
```

**Advantages over electron-builder auto-publishing**:
- ✅ Works reliably on branch builds (not just main releases)
- ✅ Dynamic file discovery handles naming variations
- ✅ No dependency on `publish` configuration settings
- ✅ Clear error handling and visibility

### Wildcard File Discovery

**Problem Solved**: Hardcoded filenames don't match actual electron-builder output.

**Solution Pattern**:
```bash
# Instead of this (fails):
gh release upload "v0.1.9" "dist/Requests-and-Offers-0.1.9-x64-mac.dmg"

# Use this (works):
find dist -name "*.dmg" -exec gh release upload "v0.1.9" {} \;
find dist -name "*.exe" -exec gh release upload "v0.1.9" {} \;
```

**Benefits**:
- ✅ Handles filename variations automatically
- ✅ Works across all platforms
- ✅ No need to know exact naming patterns
- ✅ Resilient to electron-builder version changes

### CI/CD Workflow Analysis

The **actual working CI/CD** (`.github/workflows/release.yaml`) shows these patterns:

1. **Manual Upload Strategy**: Lines 74, 85, 103, 118, 133, 149 all use manual `gh release upload` commands
2. **Wildcard Discovery**: Uses `find dist -name "*.dmg"` patterns (lines 74, 85)
3. **Cross-Platform Matrix**: Builds on `windows-2022`, `macos-13`, `macos-latest`, `ubuntu-22.04` (line 12)
4. **Asset Generation**: All platforms generate binaries and checksums automatically
5. **Build Verification**: Each platform uploads assets with `--clobber` flag to handle duplicates

### Cross-Repository Coordination Flow

**Working Synchronization**:
1. **Main → Kangaroo**: Copy webhapp to `deployment/kangaroo-electron/pouch/`
2. **Version Consistency**: Update `package.json` and `kangaroo.config.ts` in sync
3. **Trigger CI/CD**: Commit to kangaroo `release` branch triggers GitHub Actions
4. **Asset Linking**: Main release notes link to kangaroo release assets
5. **Repository Communication**: Both repos reference each other

**Critical Success Factors**:
- ✅ Fresh webhapp copied before triggering builds
- ✅ Version numbers synchronized across all files
- ✅ Correct branch management (main → release → main)
- ✅ Proper GitHub CLI authentication and permissions

---

## 🚨 Troubleshooting Common Issues

### Electron-Builder Publishing Failures

**Problem**: Builds complete successfully but assets don't upload to GitHub release
**Root Cause**: electron-builder's `publish` configuration is disabled for branch builds
**Working Solution**: Manual GitHub CLI uploads (as used in v0.1.9)

```bash
# Instead of relying on electron-builder publish:
# 1. Build each platform
yarn build:mac-x64
yarn build:mac-arm64
yarn build:win
yarn build:linux

# 2. Upload with wildcard discovery
find dist -name "*.dmg" -exec gh release upload "v0.1.9" {} \;
find dist -name "*.exe" -exec gh release upload "v0.1.9" {} \;
find dist -name "*.deb" -exec gh release upload "v0.1.9" {} \;
find dist -name "*.AppImage" -exec gh release upload "v0.1.9" {} \;
```

### Filename Mismatch Issues

**Problem**: Upload commands fail because generated filenames don't match expected patterns
**Root Cause**: electron-builder artifact naming differs from hardcoded expectations

**Solution**: Use dynamic file discovery with wildcards

```bash
# Discover actual files before upload
ls dist/
find dist -name "*.dmg" -exec echo "Found: {}" \;

# Upload with dynamic discovery
find dist -name "*.dmg" -exec gh release upload "v0.1.9" {} \;
```

### Asset Upload Recovery

**If assets fail to upload completely**:

```bash
# 1. Verify release exists
gh release view v0.1.X

# 2. Check build completion
gh run list --repo happenings-community/kangaroo-electron

# 3. Re-trigger builds if needed
cd deployment/kangaroo-electron
echo "retrigger $(date)" > .trigger
git add .trigger
git commit -m "trigger: rebuild v0.1.X"
git push origin release
```

### Platform-Specific Issues

#### macOS Builds
- **Issue**: Code signing certificate conflicts
- **Solution**: Set `MACOS_CODE_SIGNING=false` in kangaroo config for unsigned builds
- **Verification**: Check `.github/workflows/release.yaml` conditions (lines 56-58)

#### Windows Builds
- **Issue**: EV certificate setup complexity
- **Solution**: Use unsigned builds for testing, enable signing for production
- **Reference**: Lines 151-170 in release.yaml show AzureSignTool integration

#### Linux Builds
- **Issue**: DEB post-install script failures
- **Solution**: Check `scripts/extend-deb-postinst.mjs` (referenced line 131)
- **Verification**: Ensure AppImage includes proper desktop integration

---

## 📋 Cross-Repository Workflow

### Git Submodule Management

**Current Working Structure**:
```bash
# Verify submodule status
git submodule status

# Update to latest
git submodule update --remote deployment/kangaroo-electron
git submodule update --remote deployment/homebrew

# Initialize if needed
git submodule update --init --recursive
```

### Version Synchronization

**Critical Files to Keep in Sync**:
1. `package.json` (main repository) - Source of truth
2. `deployment/kangaroo-electron/package.json` - Must match main
3. `deployment/kangaroo-electron/kangaroo.config.ts` - Electron app version
4. `CHANGELOG.md` - Documentation reference

**Sync Process**:
```bash
# Update main version
# Edit package.json: "version": "0.1.X"

# Update kangaroo version
cd deployment/kangaroo-electron
# Edit package.json: "version": "0.1.X"
# Edit kangaroo.config.ts: version: '0.1.X'

# Commit all changes
git add package.json kangaroo.config.ts
git commit -m "build: sync versions to v0.1.X"
```

### Branch Management Strategy

**Working Branch Strategy**:
- **Main Repository**: Work on `main` branch, create tags for releases
- **Kangaroo Repository**: Use `release` branch for CI/CD triggers
- **Homebrew Repository**: Use `main` branch for formula updates

**Synchronization Commands**:
```bash
# For kangaroo submodule
cd deployment/kangaroo-electron
git checkout main
git pull origin main
git checkout release
git merge main --no-edit
git push origin release

# Return to main repository
cd ../..
```

---

## 📊 Performance & Metrics

### v0.1.9 Success Metrics (Reference)

**Build Performance**:
- **Total Release Time**: ~2.5 hours (including troubleshooting)
- **Build Success Rate**: 100% (5/5 platforms)
- **Platform Build Times**:
  - macOS ARM64: 1m46s
  - macOS x64: 3m2s
  - Windows x64: 2m54s
  - Linux x64: ~4m (includes post-install scripts)

**Asset Upload Success**:
- **Upload Method**: Manual GitHub CLI commands (reliable)
- **File Discovery**: Wildcard patterns (handles naming variations)
- **Retry Count**: 1 retry needed (for macOS upload fixes)

### Quality Metrics

**Success Criteria Achieved**:
- ✅ All platform builds complete successfully
- ✅ All assets uploaded and downloadable
- ✅ Release notes complete and accurate with working links
- ✅ Download links tested and working for all platforms
- ✅ Branches synchronized between repositories
- ✅ Basic functionality verified in released app

### Key Success Factors

1. **Manual Process Reliability**: Step-by-step execution with verification
2. **Wildcard File Discovery**: Eliminates filename mismatch failures
3. **Cross-Platform CI/CD**: GitHub Actions working consistently
4. **Repository Communication**: Proper linking between main and kangaroo repos
5. **Asset Upload Strategy**: Manual GitHub CLI more reliable than auto-publishing

---

## 🔮 Future Automation Development

### What Needs to Be Built

To transition from manual to automated deployment, the following components need development:

1. **Script Development**:
   - Create `scripts/deployment/deploy.sh` orchestrator
   - Implement version management system
   - Add validation and rollback capabilities

2. **Path Configuration**:
   - Dynamic path resolution for repository structure
   - Environment-specific configuration handling
   - Cross-repository synchronization

3. **Asset Upload Automation**:
   - Replicate working manual GitHub CLI patterns
   - Implement wildcard file discovery
   - Add error handling and retry logic

4. **CI/CD Integration**:
   - Build monitoring and validation
   - Automated link generation for release notes
   - Cross-platform build coordination

5. **Homebrew Automation**:
   - SHA256 checksum calculation
   - Formula updates and testing
   - Git commit and push automation

### Development Approach

**Phase 1: Working Script Extraction**
- Extract proven patterns from manual v0.1.9 process
- Document reliable commands and error handling
- Test with actual repository structure

**Phase 2: Automation Scripting**
- Convert manual commands to automated scripts
- Add comprehensive validation and error recovery
- Implement rollback and backup capabilities

**Phase 3: Integration Testing**
- End-to-end testing with real repositories
- CI/CD integration and monitoring
- Performance optimization and reliability testing

---

## 📞 Quick Reference

### Working Commands Summary

```bash
# Complete deployment (7 steps)
# 1. Environment setup
cd /home/soushi888/Projets/Holochain/requests-and-offers
git status && git submodule status

# 2. WebHapp build
nix develop --command "bun package"

# 3. Main release
git tag v0.1.X
gh release create v0.1.X --title "Release Title" --notes "Release notes"
gh release upload v0.1.X workdir/requests_and_offers.webhapp

# 4. Kangaroo update
cd deployment/kangaroo-electron
cp ../../workdir/requests_and_offers.webhapp pouch/
git add pouch/requests_and_offers.webhapp
git commit -m "build: update webhapp for v0.1.X"
git checkout release && git merge main --no-edit && git push origin release

# 5. Build monitoring
gh run list --repo happenings-community/kangaroo-electron

# 6. Asset verification
gh release view v0.1.X --repo happenings-community/kangaroo-electron

# 7. Release notes update
gh release edit v0.1.X --notes "Updated notes with desktop links"
```

### Essential File Locations

```bash
# Main repository
/home/soushi888/Projets/Holochain/requests-and-offers/package.json
/home/soushi888/Projets/Holochain/requests-and-offers/workdir/requests_and_offers.webhapp
/home/soushi888/Projets/Holochain/requests-and-offers/CHANGELOG.md

# Kangaroo submodule
/home/soushi888/Projets/Holochain/requests-and-offers/deployment/kangaroo-electron/.github/workflows/release.yaml
/home/soushi888/Projets/Holochain/requests-and-offers/deployment/kangaroo-electron/kangaroo.config.ts
/home/soushi888/Projets/Holochain/requests-and-offers/deployment/kangaroo-electron/package.json
```

### Troubleshooting Commands

```bash
# Check git authentication
gh auth status

# Verify submodule status
git submodule status

# Monitor builds
gh run list --repo happenings-community/kangaroo-electron

# View build logs
gh run view [RUN_ID] --log --repo happenings-community/kangaroo-electron

# Check releases
gh release view v0.1.X --repo happenings-community/requests-and-offers
gh release view v0.1.X --repo happenings-community/kangaroo-electron
```

---

**This guide reflects the current working reality as of v0.1.9. Use the manual 7-step process until automated deployment system is completely rebuilt with working patterns proven in this release.**
