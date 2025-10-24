# 🚀 Release Checklist Template

> **Comprehensive guide for deploying new versions - Proven 100% success rate**

This checklist ensures consistent, reliable releases using the systematic process that achieved complete cross-platform success in v0.1.9.

## 📋 Pre-Release Checklist

### ✅ **Environment Verification**
- [ ] **Git Authentication**: Ensure push access to main repository and submodules
- [ ] **GitHub CLI Access**: Verify `gh auth status` shows proper authentication
- [ ] **Branch Status**: Confirm correct branch (`main` for main repo, `release` for kangaroo submodule)
- [ ] **Clean Working Directory**: No uncommitted changes in any repository
- [ ] **Submodule Status**: Verify submodules initialized and up to date
  ```bash
  git submodule status
  git submodule update --init --recursive
  ```
- [ ] **Network Access**: Confirm internet connectivity for GitHub operations

### ✅ **Version Planning**
- [ ] **Version Number**: Determine next version following semantic versioning
- [ ] **Change Documentation**: Update CHANGELOG.md with new version details
- [ ] **Breaking Changes**: Identify any breaking changes requiring major version bump
- [ ] **Feature Scope**: Confirm all intended features are complete and tested

### ✅ **Code Quality Checks**
- [ ] **Tests Passing**: Run full test suite (`bun test` in main repo)
- [ ] **Lint Clean**: No linting errors (`cd ui && bun run lint`)
- [ ] **Type Safety**: TypeScript compilation successful (`cd ui && bun run check`)
- [ ] **Build Verification**: Ensure project builds without errors (`bun build:happ`)

## 🔧 Release Preparation

### ✅ **Main Repository Setup**
```bash
cd /path/to/requests-and-offers
```

- [ ] **Update Version Files**: Ensure version consistency across:
  - `dnas/requests_and_offers/dna.yaml`
  - `ui/package.json`
  - `CHANGELOG.md`
- [ ] **Set Test Mode Environment**: Ensure test mode build:
  ```bash
  export VITE_APP_ENV=test
  export VITE_DEV_FEATURES_ENABLED=false
  export VITE_MOCK_BUTTONS_ENABLED=false
  ```
- [ ] **Build WebHapp**: `bun package` (creates `workdir/requests_and_offers.webhapp`)
- [ ] **Verify WebHapp**: Confirm file exists and has reasonable size (>5MB)
- [ ] **Verify Test Mode**: Ensure webhapp built with test mode (no development features)
- [ ] **Commit Changes**: Commit any version updates with clear message

### ✅ **Kangaroo Repository Setup**
```bash
cd deployment/kangaroo-electron
```

- [ ] **Update Version**: Edit `kangaroo.config.ts` with new version number
- [ ] **Update Release Notes**: Create/update `RELEASE_BUILD_NOTES.md`
- [ ] **Copy WebHapp**: Copy latest webhapp from main repo to `pouch/` directory
  ```bash
  cp ../../workdir/requests_and_offers.webhapp pouch/
  ```
- [ ] **Verify Correct WebHapp**: Ensure webhapp in pouch/ built in test mode
- [ ] **Verify Configuration**: Ensure production servers configured:
  - `bootstrapUrl: 'https://holostrap.elohim.host/'`
  - `signalUrl: 'wss://holostrap.elohim.host/'`
- [ ] **Commit Changes**: Commit version and configuration updates in submodule

## 🌿 Branch Synchronization

### ✅ **Main Repository Branch Sync**
```bash
# Ensure main branch is current
git checkout main
git pull origin main

# Check for any unreleased commits
git log --oneline origin/main --not origin/main | wc -l
# Should be 0 for clean release
```

### ✅ **Kangaroo Submodule Branch Sync**
```bash
cd deployment/kangaroo-electron

# Update main branch
git checkout main
git pull origin main

# Sync release branch with main
git checkout release
git merge main --no-edit
git push origin release

# Verify branches are synchronized
git log --oneline main..release | wc -l
# Should be 0 after sync

# Return to main repository
cd ../..
```

## 🚀 Release Execution

### ✅ **Manual Release Process** (PROVEN 100% SUCCESS)

**Step 1: Update Main Repository**
```bash
cd /path/to/requests-and-offers

# Update changelog
/update-changelog

# Update version in package.json
# Edit package.json: "version": "0.1.X"
```

**Step 2: Build WebHapp Package**
```bash
# Enter Nix shell for proper environment
nix develop

# Build the webhapp package
bun package

# Verify the webhapp was created
ls -la workdir/requests_and_offers.webhapp
```

**Step 3: Create Main Repository Release**
```bash
# Create a tag for the new version
git tag v0.1.X

# Create a draft release with comprehensive notes
gh release create v0.1.X \
  --title "🚀 Requests and Offers v0.1.X" \
  --notes "### What's New

[Feature highlights from changelog]

### Installation
[WebApp installation instructions]

### Desktop Apps
🔄 Desktop applications are building... [Links will appear here when ready]

### Technical Specifications
- **Network**: Holostrap alpha network
- **Holochain Version**: 0.5.5
- **UI Framework**: SvelteKit + Svelte 5
- **Architecture**: 7-Layer Effect-TS

### Getting Started
[Quick start guide for new users]

---

⚠️ **Note**: Desktop applications are currently being built. Download links will be added automatically when the build process completes."

# Upload the webhapp as the first asset
gh release upload v0.1.X workdir/requests_and_offers.webhapp --clobber
```

**Step 4: Update Kangaroo Repository**
```bash
cd deployment/kangaroo-electron

# Copy the fresh webhapp to kangaroo pouch
cp ../../workdir/requests_and_offers.webhapp pouch/

# Update version if needed
# Edit package.json and kangaroo.config.ts
```

**Step 5: Trigger Kangaroo CI/CD Build**
```bash
# Commit the webhapp update to trigger CI/CD
git add pouch/requests_and_offers.webhapp
git commit -m "build: update webhapp for v0.1.X release"

# Push to release branch to trigger GitHub Actions
git checkout release
git merge main --no-edit
git push origin release
```

**Step 6: Monitor Kangaroo Build**
```bash
# Monitor GitHub Actions progress
gh run list --limit=5

# View specific run logs if needed
gh run view [RUN_ID] --log-failed

# Verify all platform builds complete:
# - macOS ARM64 (Apple Silicon)
# - macOS x64 (Intel)
# - Windows x64
# - Linux x64
```

**Step 7: Cross-Link Release Notes**
```bash
# After kangaroo builds complete, verify assets
gh release view v0.1.X  # Should show 5+ assets

# Update main repository release notes with working links
gh release edit v0.1.X \
  --notes "### What's New

[Features from changelog]

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
[Same technical details as initial release]

### Getting Started
[Updated guide with desktop app references]"
```

## 📝 Release Notes Finalization

### ✅ **Main Repository Release Notes**
- [ ] **Update Release Description**: Add comprehensive release notes including:
  - **Feature highlights** with clear descriptions
  - **Platform-specific download links** pointing to kangaroo repo
  - **Installation instructions** for each platform
  - **Technical specifications** and network information
  - **Getting started guide** for new users
- [ ] **Verify Asset Links**: Test all download links work correctly
- [ ] **Cross-Repository Links**: Ensure links between main and kangaroo repos work

### ✅ **Communication & Documentation**
- [ ] **Update README**: Reflect any new features or installation changes
- [ ] **Documentation Updates**: Update any relevant documentation
- [ ] **Community Notification**: Prepare announcement for community channels

## 🔄 Post-Release Verification

### ✅ **Download Testing**
- [ ] **Test Downloads**: Verify downloads work from GitHub release page
- [ ] **Installation Testing**: Test installation on at least one platform
- [ ] **Network Connectivity**: Verify app connects to production network
- [ ] **Basic Functionality**: Confirm core features work in released version

### ✅ **Repository Cleanup**
- [ ] **Branch Synchronization**: Ensure main and release branches are in sync
- [ ] **Tag Verification**: Confirm git tags are properly created
- [ ] **Asset Verification**: Double-check all assets are available and working

## 🚨 Troubleshooting Common Issues

### **Branch Sync Issues**
```bash
# If release branch has commits ahead of main
git checkout main
git merge release --no-edit
git push origin main

# Reset release branch to match main
git checkout release
git reset --hard main
git push --force-with-lease origin release
```

### **Missing GitHub Release**
```bash
# Create missing release before builds
gh release create v0.1.X --title "Release Title" --notes "Release notes"
```

### **Build Failures**
```bash
# Check build logs
gh run view [RUN_ID] --log-failed

# Common fixes:
# 1. Ensure release exists on GitHub
# 2. Check APP_ID variable expansion in YAML
# 3. Verify all required scripts exist
# 4. Confirm webhapp file is in pouch/ directory
```

### **Asset Upload Issues**

#### **Electron-Builder Publishing Failures**
**Solution Pattern**:
```yaml
# Use manual GitHub CLI uploads instead of electron-builder auto-publishing
# Apply to all platform builds (Windows, macOS, Linux)

# macOS Example with wildcard pattern (recommended)
- name: build and upload the app (macOS)
  run: |
    yarn build:mac-arm64
    ls dist
    # Use wildcard to handle filename variations
    find dist -name "*.dmg" -exec gh release upload "v${{ steps.kangarooConfig.outputs.APP_VERSION }}" {} \;
```

#### **Filename Mismatch Issues**
```bash
# Instead of hardcoded filenames
gh release upload "v0.1.9" "dist/specific-filename-pattern.dmg"

# Use dynamic file discovery
find dist -name "*.dmg" -exec gh release upload "v0.1.9" {} \;
find dist -name "*.exe" -exec gh release upload "v0.1.9" {} \;
```

## 📊 Release Metrics

### **Performance Benchmarks (v0.1.9 Achieved)**
- **Total Release Time**: ~2.5 hours (including issue resolution)
- **Build Retry Count**: 1 retry (for macOS upload fixes)
- **Success Rate**: 100% (5/5 platforms)
- **Platform Build Times**:
  - macOS ARM64: 1m46s
  - macOS x64: 3m2s
  - Windows x64: 2m54s
  - Linux x64: ~4m (includes post-install scripts)

### **Target Metrics**
- **Total Release Time**: <30 minutes end-to-end
- **Build Retry Count**: 0 retries needed
- **Success Rate**: 100% successful releases
- **Asset Upload Success**: 100% across all platforms

## 🎯 Success Criteria

A successful release includes:

- ✅ All platform builds complete successfully (5 binaries: macOS ARM64/x64, Windows, Linux DEB/AppImage)
- ✅ All assets uploaded and downloadable
- ✅ Release notes complete and accurate with working links
- ✅ Download links tested and working for all platforms
- ✅ Branches synchronized between repositories (main + release)
- ✅ Homebrew formula updated with correct checksums
- ✅ Basic functionality verified in released app
- ✅ Cross-platform installation methods available (GitHub + Homebrew)

### **Release Process Evolution**
- **v0.1.8**: 2/5 platforms (40% success) - Linux only
- **v0.1.9**: 5/5 platforms (100% success) - Complete cross-platform support

---

**Usage**: Follow this checklist for every release to ensure consistency and reliability. Update based on lessons learned from each release.