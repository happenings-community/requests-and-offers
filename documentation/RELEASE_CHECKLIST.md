# 🚀 Release Checklist

> **Comprehensive guide for deploying new versions of Requests and Offers**

This checklist ensures consistent, reliable releases by following a systematic process that addresses common failure points and edge cases.

## 📋 Pre-Release Checklist

### ✅ **Environment Verification**
- [ ] **Git Authentication**: Ensure you can push to main repository and submodules
- [ ] **GitHub CLI Access**: Verify `gh auth status` shows proper authentication
- [ ] **Branch Status**: Confirm you're on the correct branch (`main` for main repo, `release` for kangaroo submodule)
- [ ] **Clean Working Directory**: No uncommitted changes in main repository or submodules
- [ ] **Submodule Status**: Verify submodules are initialized and up to date
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
cd /home/soushi888/Projets/Holochain/requests-and-offers
```

- [ ] **Update Version Files**: Ensure version consistency across:
  - `dnas/requests_and_offers/dna.yaml`
  - `ui/package.json`
  - `CHANGELOG.md`
- [ ] **Set Test Mode Environment**: Ensure test mode (no development features) before building:
  ```bash
  # This ensures development features are disabled in the build
  export VITE_APP_ENV=test
  export VITE_DEV_FEATURES_ENABLED=false
  export VITE_MOCK_BUTTONS_ENABLED=false
  ```
- [ ] **Build WebHapp**: `bun package` (creates `workdir/requests_and_offers.webhapp`)
- [ ] **Verify WebHapp**: Confirm file exists and has reasonable size (>5MB)
- [ ] **Verify Test Mode**: Ensure the webhapp was built with test mode (no development features)
- [ ] **Commit Changes**: Commit any version updates with clear message

### ✅ **Kangaroo Repository Setup**
```bash
# Option 1: Work in submodule directory
cd deployment/kangaroo-electron

# Option 2: Work from main repo with submodule commands
git submodule update --remote kangaroo-electron
cd deployment/kangaroo-electron
```

- [ ] **Update Version**: Edit `kangaroo.config.ts` with new version number
- [ ] **Update Release Notes**: Create/update `RELEASE_BUILD_NOTES.md`
- [ ] **Copy WebHapp**: Copy latest webhapp from main repo to `pouch/` directory
  ```bash
  cp ../../workdir/requests_and_offers.webhapp pouch/
  ```
- [ ] **Verify Correct WebHapp**: Ensure the webhapp in pouch/ is built in test mode (no development features)
- [ ] **Verify Configuration**: Ensure production servers are configured:
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
# Work in kangaroo submodule
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

### ✅ **Manual Release Process**

**Step 1: Update Main Repository**
```bash
cd /home/soushi888/Projets/Holochain/requests-and-offers

# Update changelog using the command
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

# Create a basic draft release with initial notes
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

**Step 4: Create Kangaroo GitHub Release (CRITICAL)**
```bash
# Navigate to kangaroo submodule
cd deployment/kangaroo-electron

# Copy the fresh webhapp to kangaroo pouch
cp ../../workdir/requests_and_offers.webhapp pouch/

# Update version in package.json (if needed)
# Edit package.json: "version": "0.1.X"

# Update version in kangaroo.config.ts (if needed)
# Edit kangaroo.config.ts: version: '0.1.X'

# ⚠️ IMPORTANT: Create GitHub release BEFORE pushing to trigger CI/CD
# The CI/CD workflow needs an existing release to upload assets to
gh release create v0.1.X \
  --title "🚀 Kangaroo Desktop v0.1.X - [Release Theme]" \
  --notes "### Desktop Application Release

This release contains the Kangaroo desktop applications for Requests and Offers v0.1.X.

#### 📱 Platforms
- Windows x64, macOS ARM64/x64, Linux x64 (DEB + AppImage)
- Version: v0.1.X
- Network: Holostrap alpha network

**Main Repository**: https://github.com/happenings-community/requests-and-offers/releases/tag/v0.1.X"
```

**Step 5: Trigger Kangaroo CI/CD Build**
```bash
# Commit the webhapp update to trigger CI/CD
git add pouch/requests_and_offers.webhapp package.json kangaroo.config.ts
git commit -m "build: update webhapp and version for v0.1.X release"

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

**Step 8: Update Homebrew Formula (CRITICAL)**
```bash
# Navigate to Homebrew formula directory
cd deployment/homebrew

# Get SHA256 checksums for macOS assets (ARM64 and Intel)
curl -sL "https://github.com/happenings-community/requests-and-offers-kangaroo-electron/releases/download/v0.1.X/requests-and-offers.happenings-community.kangaroo-electron-0.1.X-arm64.dmg" | shasum -a 256
curl -sL "https://github.com/happenings-community/requests-and-offers-kangaroo-electron/releases/download/v0.1.X/requests-and-offers.happenings-community.kangaroo-electron-0.1.X-x64.dmg" | shasum -a 256

# Update Homebrew cask with new version and checksums
# Edit: deployment/homebrew/Casks/requests-and-offers.rb
# - Update version to "0.1.X"
# - Update ARM64 sha256 with checksum from above
# - Update Intel sha256 with checksum from above
# - Update comment with release theme

# Commit and push Homebrew formula update
git add Casks/requests-and-offers.rb
git commit -m "feat: update Homebrew formula for v0.1.X release"
git push origin main
```

**Step 9: Final Link Verification (CRITICAL)**
```bash
# Test ALL download links before considering release complete
curl -I "https://github.com/happenings-community/requests-and-offers-kangaroo-electron/releases/download/v0.1.X/requests-and-offers.happenings-community.kangaroo-electron-0.1.X-arm64.dmg"
curl -I "https://github.com/happenings-community/requests-and-offers-kangaroo-electron/releases/download/v0.1.X/requests-and-offers.happenings-community.kangaroo-electron-0.1.X-x64.dmg"
curl -I "https://github.com/happenings-community/requests-and-offers-kangaroo-electron/releases/download/v0.1.X/requests-and-offers.happenings-community.kangaroo-electron-0.1.X-setup.exe"
curl -I "https://github.com/happenings-community/requests-and-offers-kangaroo-electron/releases/download/v0.1.X/requests-and-offers.happenings-community.kangaroo-electron_0.1.X_amd64.deb"
curl -I "https://github.com/happenings-community/requests-and-offers-kangaroo-electron/releases/download/v0.1.X/requests-and-offers.happenings-community.kangaroo-electron-0.1.X.AppImage"

# All should return HTTP/2 302 (redirect) - this confirms links work
# Any 404 or other error indicates broken links that must be fixed
```

### ✅ **Automated Deployment (Currently Broken)**

⚠️ **Note**: The automated deployment scripts are currently non-functional due to path mismatches and require complete review. Use the manual 7-step process above until automated system is fixed.

The following automated scripts exist but are not working:
```bash
# These commands currently FAIL - do not use
./deployment/scripts/deploy.sh deploy 0.1.X
./deployment/scripts/deploy.sh --dry-run
./deployment/scripts/deploy.sh status
```

**Automated System Should Handle** (when fixed):
- ✅ Environment validation (including submodules)
- ✅ WebApp build and GitHub release
- ✅ Kangaroo desktop app builds (all platforms)
- ✅ Homebrew formula updates
- ✅ Cross-repository synchronization
- ✅ Comprehensive validation and rollback

### ✅ **Manual Release (Alternative)**

If you prefer manual release process:

- [ ] **Main Repository Release**: Create GitHub release for main repo
  ```bash
  gh release create v0.1.X --title "🚀 Requests and Offers v0.1.X - Feature Name" --notes "Initial release notes"
  ```
- [ ] **Kangaroo Submodule Release**: Create GitHub release for kangaroo submodule
  ```bash
  cd deployment/kangaroo-electron
  gh release create v0.1.X --title "v0.1.X - Feature Name" --notes "Desktop release notes"
  cd ../..
  ```
- [ ] **Upload WebHapp**: Add webhapp to main repository release
  ```bash
  gh release upload v0.1.X /path/to/requests_and_offers.webhapp --clobber
  ```

### ✅ **Desktop Build Trigger**
- [ ] **Trigger Builds**: Push to kangaroo submodule release branch triggers GitHub Actions
  ```bash
  # Create trigger commit in kangaroo submodule if needed
  cd deployment/kangaroo-electron
  echo "$(date)" > .trigger
  git add .trigger
  git commit -m "trigger: release v0.1.X build"
  git push origin release
  cd ../..
  ```
- [ ] **Monitor Builds**: Track build progress
  ```bash
  gh run list --limit 1
  gh run view [RUN_ID] --log-failed  # If builds fail
  ```

### ✅ **Build Verification**
- [ ] **All Platforms Complete**: Verify builds complete successfully
  - ✅ macOS ARM64 (Apple Silicon)
  - ✅ macOS x64 (Intel)
  - ✅ Windows
  - ✅ Linux (DEB + AppImage)
- [ ] **Asset Upload Confirmation**: Check all expected assets are uploaded
  ```bash
  gh release view v0.1.X  # Should show 6+ assets (5 binaries + checksums)
  ```

## 📝 Release Notes Finalization

### ✅ **Release Notes Generation**
  - **Location**: `.claude/skills/deployment/templates/release-notes.md`
  - **Template**: Based on established v0.1.8 format with comprehensive sections
  - **Automation**: Generates properly structured release notes with placeholder variables

### ✅ **Main Repository Release Notes**
- [ ] **Update Release Description**: Add comprehensive release notes including:
  - **Feature highlights** with clear descriptions and commit hashes
  - **Platform-specific download links** pointing to kangaroo repo
  - **Installation instructions** for each platform
  - **Technical specifications** and network information
  - **Getting started guide** for new users
- [ ] **Use Template**: Fill in the release notes template with actual changes:
  - Extract features from CHANGELOG.md and commit history
  - Verify all download links work correctly
  - Include commit hashes for traceability
  - Follow v0.1.8 established structure and formatting
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

### **Missing GitHub Release (Kangaroo Repository)**
**Error**: `release doesn't exist and not created because "publish" is not "always" and build is not on tag`

**Cause**: The kangaroo-electron repository CI/CD workflow requires an existing GitHub release to upload assets to. Without a release, electron-builder cannot publish the generated binaries.

**Solution**:
```bash
# Navigate to kangaroo repository
cd deployment/kangaroo-electron

# Create the missing GitHub release FIRST
gh release create v0.1.X \
  --title "🚀 Kangaroo Desktop v0.1.X - [Release Theme]" \
  --notes "### Desktop Application Release

This release contains the Kangaroo desktop applications for Requests and Offers v0.1.X.

#### 📱 Platforms
- Windows x64, macOS ARM64/x64, Linux x64 (DEB + AppImage)
- Version: v0.1.X
- Network: Holostrap alpha network

**Main Repository**: https://github.com/happenings-community/requests-and-offers/releases/tag/v0.1.X"

# Then retrigger the build by pushing to release branch
git checkout release
git merge main --no-edit
git push origin release
```

**Prevention**: Always create the kangaroo GitHub release in Step 4 before triggering CI/CD in Step 5.

### **Build Failures**
```bash
# Check build logs
gh run view [RUN_ID] --log-failed

# Common fixes:
# 1. Ensure release exists on GitHub (see above)
# 2. Check APP_ID variable expansion in YAML
# 3. Verify all required scripts exist
# 4. Confirm webhapp file is in pouch/ directory
```

### **Asset Upload Issues**

#### **Electron-Builder Publishing Failures**
**Symptoms**: Builds complete successfully but assets don't upload to GitHub release
**Root Cause**: electron-builder's `publish` configuration is disabled for branch builds

**Solution Pattern**:
```yaml
# Use manual GitHub CLI uploads instead of electron-builder auto-publishing
# Apply to all platform builds (Windows, macOS, Linux)

# Windows Example
- name: build and upload the app (Windows)
  run: |
    yarn build:win
    ls dist
    gh release upload "v${{ steps.kangarooConfig.outputs.APP_VERSION }}" "dist/${{ steps.kangarooConfig.outputs.APP_ID }}-${{ steps.kangarooConfig.outputs.APP_VERSION }}-setup.exe" --clobber

# macOS Example with wildcard pattern (recommended)
- name: build and upload the app (macOS)
  run: |
    yarn build:mac-arm64
    ls dist
    # Use wildcard to handle filename variations
    find dist -name "*.dmg" -exec gh release upload "v${{ steps.kangarooConfig.outputs.APP_VERSION }}" {} \;
```

**Key Learning**: Manual GitHub CLI uploads are more reliable than electron-builder auto-publishing for branch builds.

#### **Filename Mismatch Issues**
**Symptoms**: Upload commands fail because generated filenames don't match expected patterns
**Root Cause**: electron-builder artifact naming differs from hardcoded expectations

**Solution Pattern**:
```bash
# Instead of hardcoded filenames
gh release upload "v0.1.9" "dist/specific-filename-pattern.dmg"

# Use dynamic file discovery
find dist -name "*.dmg" -exec gh release upload "v0.1.9" {} \;
find dist -name "*.exe" -exec gh release upload "v0.1.9" {} \;
```

#### **General Asset Upload Recovery**
```bash
# Re-trigger builds with clean release
gh release delete v0.1.X --yes
gh release create v0.1.X --title "Title" --notes "Notes"
# Push trigger commit to restart builds
```

#### **Platform-Specific Troubleshooting**
```bash
# Check which files were actually created
gh run view [RUN_ID] --log | grep "ls dist"

# Verify file exists before upload
if [ -f "dist/target-file.dmg" ]; then
  gh release upload "v0.1.9" "dist/target-file.dmg"
else
  echo "Target file not found - check build logs"
fi
```

## 📊 Release Metrics

Track these metrics for release process improvement:

- **⏱️ Total Release Time**: Target <30 minutes end-to-end
- **🔄 Build Retry Count**: Target 0 retries needed
- **✅ Success Rate**: Target 100% successful releases
- **🐛 Issues Found**: Track common failure modes for process improvement

### **Performance Benchmarks (v0.1.9 Achieved)**
- **Total Release Time**: ~2.5 hours (including issue resolution)
- **Build Retry Count**: 1 retry (for macOS upload fixes)
- **Success Rate**: 100% (5/5 platforms)
- **Platform Build Times**:
  - macOS ARM64: 1m46s
  - macOS x64: 3m2s
  - Windows x64: 2m54s
  - Linux x64: ~4m (includes post-install scripts)

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

### **Continuous Improvement Areas**
- **CI/CD Reliability**: Manual upload strategy more robust than electron-builder auto-publishing
- **Asset Upload Strategy**: Wildcard patterns eliminate filename mismatch failures
- **Cross-Repository Coordination**: Established workflow for main repo + kangaroo + homebrew synchronization
- **Documentation Quality**: Enhanced troubleshooting patterns for common failure modes

---

**Next:** Use this checklist for every release to ensure consistency and reliability. Update the checklist based on lessons learned from each release.

## 🔧 Kangaroo CI/CD Process Details

### **Repository Structure**
- **Main Repository**: `https://github.com/happenings-community/requests-and-offers`
- **Kangaroo Repository**: `https://github.com/happenings-community/kangaroo-electron` (submodule)
- **Submodule Path**: `deployment/kangaroo-electron`

### **CI/CD Trigger Mechanism**
- **Trigger**: Any commit to `release` branch in kangaroo repository
- **Required Files**:
  - `pouch/requests_and_offers.webhapp` (the webapp package)
  - Proper version in `package.json` and `kangaroo.config.ts`
- **Build Platforms**: Windows x64, macOS ARM64, macOS x64, Linux x64
- **Expected Assets**: 5 desktop binaries (macOS ARM64/x64, Windows setup, Linux DEB/AppImage) + 1 webhapp

### **Critical Integration Points**

1. **WebHapp Transfer**: Main → Kangaroo
   ```bash
   # From main repo root
   cp workdir/requests_and_offers.webhapp deployment/kangaroo-electron/pouch/
   ```

2. **Version Synchronization**:
   - Main `package.json` version must match Kangaroo `package.json`
   - Kangaroo `kangaroo.config.ts` version must match both
   - All three must be updated for consistent release

3. **Cross-Repository Linking**:
   - Main release notes link to Kangaroo release assets
   - Kangaroo release links back to main repository
   - Both repositories should reference each other
   - **Release Notes Template**: Use `.claude/skills/deployment/release-notes-generator.md` for consistent formatting
   - **Link Verification**: Test all generated download links before finalizing release

### **Common Failure Points**

❌ **Missing WebHapp in Pouch**
- **Symptom**: CI/CD runs but produces empty/broken builds
- **Fix**: Ensure fresh webhapp is copied to `deployment/kangaroo-electron/pouch/`

❌ **Version Mismatch**
- **Symptom**: Builds tagged with wrong version number
- **Fix**: Synchronize all version files before triggering builds

❌ **No GitHub Actions Triggered**
- **Symptom**: Push to release branch but no CI/CD runs
- **Fix**: Ensure proper commit with webhapp changes exists

## 📱 Cross-Platform Asset Verification

### **Expected File Structure**
For each release, Kangaroo repository should generate:
```
Requests-and-Offers-{version}-arm64-mac.dmg    # macOS Apple Silicon
Requests-and-Offers-{version}-x64-mac.dmg     # macOS Intel
Requests-and-Offers-{version}-x64-win.exe      # Windows
Requests-and-Offers-{version}-x64-linux.deb    # Linux (Debian/Ubuntu)
Requests-and-Offers-{version}.AppImage          # Linux (Universal portable)
checksums.txt                               # SHA256 checksums for all files
```

### **Download Link Format**
Standard GitHub release download URLs:
```
https://github.com/happenings-community/kangaroo-electron/releases/download/v{version}/Requests-and-Offers-{version}-{platform}.{extension}

# Platform Examples:
# macOS ARM64: Requests-and-Offers-0.1.9-arm64-mac.dmg
# macOS x64:  Requests-and-Offers-0.1.9-x64-mac.dmg
# Windows:   Requests-and-Offers-0.1.9-x64-win.exe
# Linux DEB: Requests-and-Offers-0.1.9-x64-linux.deb
# Linux AppImage: Requests-and-Offers-0.1.9.AppImage
```

### **Asset Size Expectations**
- **macOS DMG**: ~85MB (includes bundled webhapp)
- **Windows EXE**: ~90MB (includes bundled webhapp)
- **Linux DEB**: ~80MB (includes bundled webhapp)
- **Linux AppImage**: ~85MB (portable universal format)
- **Total Release**: ~440MB across all platforms
