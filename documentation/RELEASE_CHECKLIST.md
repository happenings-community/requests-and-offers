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

#### **GitHub CLI Authentication Setup**

**Prerequisites**: GitHub CLI requires proper authentication for release operations

**Step 1: Install GitHub CLI**
```bash
# macOS
brew install gh

# Ubuntu/Debian
sudo apt install gh

# Other platforms: https://github.com/cli/cli#installation
```

**Step 2: Authenticate with GitHub**
```bash
# Authenticate (will open browser for OAuth)
gh auth login

# Select scope:
# - What account do you want to log into? → GitHub.com
# - What is your preferred protocol for Git operations? → HTTPS
# - Authenticate Git with your GitHub credentials? → Yes
# - How would you like to authenticate GitHub CLI? → Login with a web browser

# Verify authentication
gh auth status
# Should show: "Logged in to github.com as username ✓"
```

**Step 3: Verify Repository Access**
```bash
# Test repository access
gh repo view happenings-community/requests-and-offers
gh repo view happenings-community/kangaroo-electron
gh repo view happenings-community/homebrew-requests-and-offers

# Test release permissions
gh release list --repo happenings-community/requests-and-offers --limit 1
```

**Step 4: Configure Git Credentials (if needed)**
```bash
# Configure git to use gh for authentication
git config --global credential.helper "!gh auth git-credential"

# Verify git authentication
git ls-remote https://github.com/happenings-community/requests-and-offers.git
```

#### **Multi-Repository Management**

**Repository Structure**:
```bash
# Main repository (primary working directory)
https://github.com/happenings-community/requests-and-offers

# Submodules (accessed via deployment/ directory)
https://github.com/happenings-community/kangaroo-electron    # deployment/kangaroo-electron
https://github.com/happenings-community/homebrew-requests-and-offers  # deployment/homebrew
```

**Submodule Workflow**:
```bash
# Initialize all submodules
git submodule update --init --recursive

# Navigate to specific submodule
cd deployment/kangaroo-electron

# Work in submodule (independent git operations)
git status
git checkout main
git pull origin main

# Return to main repository
cd ../..

# Update submodule reference in main repo
git add deployment/kangaroo-electron
git commit -m "submodule: Update kangaroo-electron to latest"
git push origin main
```

**Branch Management Strategy**:
```bash
# Main Repository: work on main branch
git checkout main
git pull origin main

# Kangaroo Submodule:
# - Development on main branch
# - Releases trigger from release branch
cd deployment/kangaroo-electron
git checkout main      # Development
git checkout release   # Release builds

# Homebrew Submodule: work on main branch only
cd deployment/homebrew
git checkout main
```

**Cross-Repository Operations**:
```bash
# Create coordinated releases across repositories
gh release create v0.2.3 --repo happenings-community/requests-and-offers
gh release create v0.2.3 --repo happenings-community/kangaroo-electron

# Copy assets between repositories
gh release download v0.2.3 --repo happenings-community/kangaroo-electron --pattern "*.dmg"

# Synchronize tags across repositories
git tag -a v0.2.3 -m "Coordinated release v0.2.3"
git push origin v0.2.3

# In each submodule:
cd deployment/kangaroo-electron
git tag -a v0.2.3 -m "Desktop apps v0.2.3"
git push origin v0.2.3
```

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

**Step 4: Update Kangaroo Repository**
```bash
# Navigate to kangaroo submodule
cd deployment/kangaroo-electron

# Copy the fresh webhapp to kangaroo pouch
cp ../../workdir/requests_and_offers.webhapp pouch/

# Update version in package.json (if needed)
# Edit package.json: "version": "0.1.X"

# Update version in kangaroo.config.ts (already at 0.1.9)
# Edit kangaroo.config.ts: version: '0.1.X'
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

**Step 7: Generate Release Notes from Template**
```bash
# Use the comprehensive release notes template
cp documentation/templates/release-notes-template.md /tmp/release-notes-v0.2.3.md

# Populate template variables (manual or script-based)
# Template variables to replace:
# {VERSION} → 0.2.3
# {RELEASE_DATE} → current date
# {MAC_ARM_SIZE} → 85 MB
# {MAC_ARM_URL} → kangaroo-electron/releases/download/v0.2.3/Requests-and-Offers-0.2.3-arm64-mac.dmg
# {MAC_ARM_SHA256} → calculated SHA256
# {MAC_X64_SIZE} → 85 MB
# {MAC_X64_URL} → kangaroo-electron/releases/download/v0.2.3/Requests-and-Offers-0.2.3-x64-mac.dmg
# {MAC_X64_SHA256} → calculated SHA256
# {WIN_SIZE} → 90 MB
# {WIN_URL} → kangaroo-electron/releases/download/v0.2.3/Requests-and-Offers-0.2.3-x64-win.exe
# {WIN_SHA256} → calculated SHA256
# {LINUX_DEB_SIZE} → 80 MB
# {LINUX_DEB_URL} → kangaroo-electron/releases/download/v0.2.3/Requests-and-Offers-0.2.3-x64-linux.deb
# {LINUX_DEB_SHA256} → calculated SHA256
# {LINUX_APPIMAGE_SIZE} → 85 MB
# {LINUX_APPIMAGE_URL} → kangaroo-electron/releases/download/v0.2.3/Requests-and-Offers-0.2.3.AppImage
# {LINUX_APPIMAGE_SHA256} → calculated SHA256
# {WEBHAPP_SIZE} → 12.1 MB
# {FEATURE_SUMMARY} → "Development Features Enhancement Release"
# {BREAKING_CHANGES} → migration guide content
# {WHATS_NEW} → features list from CHANGELOG.md
# {TECHNICAL_SPECS} → framework and network information

# After builds complete, update with actual URLs and checksums
gh release edit v0.2.3 --notes "$(cat /tmp/release-notes-v0.2.3.md)"
```

### ✅ **Template-Based Release Notes Process**

The project includes a comprehensive release notes template at `documentation/templates/release-notes-template.md` that ensures consistent, professional release communications.

**Template Features**:
- **Variable Placeholders**: All dynamic values use `{VARIABLE}` format for easy substitution
- **Platform-Specific Instructions**: Detailed installation guides for each platform
- **Technical Specifications**: Standardized technical information section
- **Breaking Changes Guide**: Structured migration instructions for developers
- **Professional Formatting**: Consistent structure with emojis and clear sections

**Template Variables**:
```markdown
# Version Information
{VERSION}           # Version number (e.g., 0.2.3)
{RELEASE_DATE}      # Release date (YYYY-MM-DD)
{FEATURE_SUMMARY}   # One-line feature summary

# Desktop Applications - macOS
{MAC_ARM_SIZE}      # File size for Apple Silicon (e.g., 85 MB)
{MAC_ARM_URL}       # Download URL for Apple Silicon
{MAC_ARM_SHA256}    # SHA256 checksum for Apple Silicon
{MAC_X64_SIZE}      # File size for Intel Mac (e.g., 85 MB)
{MAC_X64_URL}       # Download URL for Intel Mac
{MAC_X64_SHA256}    # SHA256 checksum for Intel Mac

# Desktop Applications - Windows
{WIN_SIZE}          # File size for Windows (e.g., 90 MB)
{WIN_URL}           # Download URL for Windows
{WIN_SHA256}        # SHA256 checksum for Windows

# Desktop Applications - Linux
{LINUX_DEB_SIZE}    # File size for Debian package (e.g., 80 MB)
{LINUX_DEB_URL}     # Download URL for Debian package
{LINUX_DEB_SHA256}  # SHA256 checksum for Debian package
{LINUX_APPIMAGE_SIZE} # File size for AppImage (e.g., 85 MB)
{LINUX_APPIMAGE_URL}  # Download URL for AppImage
{LINUX_APPIMAGE_SHA256} # SHA256 checksum for AppImage

# WebApp
{WEBHAPP_SIZE}      # File size for webhapp (e.g., 12.1 MB)

# Content Sections
{BREAKING_CHANGES}  # Migration guide for breaking changes
{WHATS_NEW}         # Feature highlights from CHANGELOG.md
{TECHNICAL_SPECS}   # Technical specifications section
```

**Using the Template**:
```bash
# 1. Copy template for version
cp documentation/templates/release-notes-template.md /tmp/release-notes-{VERSION}.md

# 2. Replace variables (sed or manual editing)
sed -i 's/{VERSION}/0.2.3/g' /tmp/release-notes-0.2.3.md
sed -i 's/{RELEASE_DATE}/$(date +%Y-%m-%d)/g' /tmp/release-notes-0.2.3.md
# ... continue for all variables

# 3. Apply to GitHub release
gh release edit v0.2.3 --notes "$(cat /tmp/release-notes-0.2.3.md)"
```

### ✅ **Automated Deployment (Available)**

✅ **Note**: The automated deployment system is fully functional using `bun deploy` commands. This provides streamlined release management with built-in validation and rollback capabilities.

**Available Automated Commands**:
```bash
# Full deployment pipeline (recommended)
bun deploy                    # Execute complete deployment pipeline

# Preview and validation options
bun deploy:dry-run            # Preview deployment without executing
bun deploy:status             # Check deployment status and progress
bun deploy:validate           # Validate completed deployment
bun deploy:rollback           # Rollback failed deployment
```

**Automated System Handles**:
- ✅ Environment validation (including submodules)
- ✅ WebApp build and GitHub release creation
- ✅ Kangaroo desktop app builds (all platforms)
- ✅ Homebrew formula updates with SHA256 checksums
- ✅ Cross-repository synchronization
- ✅ Comprehensive validation and rollback capabilities
- ✅ Template-based release notes generation

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

## 🍺 Homebrew Formula Management

### ✅ **Homebrew Integration Overview**

The Requests and Offers application is distributed via Homebrew using a custom formula that automatically downloads the correct platform-specific binaries from GitHub releases.

**Repository Structure**:
- **Main Repository**: `https://github.com/happenings-community/requests-and-offers`
- **Homebrew Repository**: `https://github.com/happenings-community/homebrew-requests-and-offers` (submodule)
- **Submodule Path**: `deployment/homebrew`

### ✅ **Formula Update Process**

**Prerequisites**:
- [ ] Desktop builds completed successfully
- [ ] All GitHub release assets uploaded and verified
- [ ] Homebrew submodule initialized and up to date

**Step 1: Navigate to Homebrew Repository**
```bash
cd deployment/homebrew
```

**Step 2: Calculate SHA256 Checksums**
```bash
# Download release assets to calculate checksums
wget https://github.com/happenings-community/kangaroo-electron/releases/download/v0.2.3/Requests-and-Offers-0.2.3-arm64-mac.dmg
wget https://github.com/happenings-community/kangaroo-electron/releases/download/v0.2.3/Requests-and-Offers-0.2.3-x64-mac.dmg
wget https://github.com/happenings-community/kangaroo-electron/releases/download/v0.2.3/Requests-and-Offers-0.2.3-x64-win.exe
wget https://github.com/happenings-community/kangaroo-electron/releases/download/v0.2.3/Requests-and-Offers-0.2.3-x64-linux.deb
wget https://github.com/happenings-community/kangaroo-electron/releases/download/v0.2.3/Requests-and-Offers-0.2.3.AppImage

# Calculate checksums for all binaries
sha256sum Requests-and-Offers-0.2.3-arm64-mac.dmg
sha256sum Requests-and-Offers-0.2.3-x64-mac.dmg
sha256sum Requests-and-Offers-0.2.3-x64-win.exe
sha256sum Requests-and-Offers-0.2.3-x64-linux.deb
sha256sum Requests-and-Offers-0.2.3.AppImage

# Clean up downloaded files
rm Requests-and-Offers-0.2.3-*
```

**Step 3: Update Formula Configuration**
```bash
# Edit the formula file
vim Casks/requests-and-offers.rb
```

**Required Updates**:
```ruby
cask "requests-and-offers" do
  # Update version number
  version "0.2.3"

  if Hardware::CPU.arm?
    # Update SHA256 for Apple Silicon
    sha256 "NEW_ARM64_SHA256_CHECKSUM"
    url "https://github.com/happenings-community/kangaroo-electron/releases/download/v#{version}/Requests-and-Offers-#{version}-arm64-mac.dmg"
  else
    # Update SHA256 for Intel
    sha256 "NEW_X64_SHA256_CHECKSUM"
    url "https://github.com/happenings-community/kangaroo-electron/releases/download/v#{version}/Requests-and-Offers-#{version}-x64-mac.dmg"
  end

  # No other changes needed - URLs are template-based
end
```

**Step 4: Test Formula Updates**
```bash
# Test installation from local formula
brew install --build-from-source ./Casks/requests-and-offers.rb

# Verify installation works
brew list requests-and-offers
ls /usr/local/Caskroom/requests-and-offers/*/Requests\ and\ Offers.app
```

**Step 5: Commit and Push Changes**
```bash
git add Casks/requests-and-offers.rb
git commit -m "v0.2.3: Update formula with new release checksums

- Update version to 0.2.3
- Update SHA256 checksums for all binaries
- Verified installation on both ARM64 and x64 macOS"
git push origin main

# Return to main repository
cd ../..
```

**Step 6: Update Submodule Reference**
```bash
# Update submodule reference in main repository
git add deployment/homebrew
git commit -m "submodule: Update homebrew formula for v0.2.3 release"
git push origin main
```

### ✅ **Homebrew User Installation**

**For End Users**:
```bash
# Add our tap (one-time setup)
brew tap happenings-community/homebrew-requests-and-offers

# Install the application
brew install --cask requests-and-offers

# Launch the application
open "Requests and Offers"

# Upgrade to new version
brew upgrade --cask requests-and-offers

# Uninstall (if needed)
brew uninstall --cask requests-and-offers
```

**Verification Commands**:
```bash
# Check installed version
brew info requests-and-offers

# Verify installation location
ls -la "$(brew --prefix)/Caskroom/requests-and-offers"

# Check application bundle
ls -la "/usr/local/Caskroom/requests-and-offers/*/Requests and Offers.app"
```

### ✅ **Common Homebrew Issues**

**Checksum Mismatch**:
```bash
# Error: SHA256 mismatch
# Solution: Recalculate checksums and update formula
sha256sum downloaded-file.dmg
# Update the sha256 value in Casks/requests-and-offers.rb
```

**Download URL Issues**:
```bash
# Error: No available file with URL
# Solution: Verify GitHub release assets exist
gh release view v0.2.3  # Check available assets
# Ensure URL pattern matches actual file names
```

**Permission Issues**:
```bash
# Error: Permission denied
# Solution: Use sudo or fix homebrew permissions
sudo chown -R $(whoami) /usr/local/Caskroom/
# Or use: brew install --cask requests-and-offers --force
```

**Architecture Detection**:
```bash
# Verify which architecture formula selects
uname -m  # Should show arm64 or x86_64
# Test formula logic:
if Hardware::CPU.arm?
  echo "Apple Silicon (M1/M2/M3)"
else
  echo "Intel Mac"
end
```

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

### **Authentication Issues**
```bash
# GitHub CLI authentication failures
gh auth login          # Re-authenticate
gh auth status         # Check current status
gh auth logout         # Logout and re-authenticate

# Git permission issues
git config --global credential.helper "!gh auth git-credential"
git config --global --unset credential.helper  # Reset if needed

# Repository access verification
gh repo view happenings-community/requests-and-offers
gh repo view happenings-community/kangaroo-electron
```

### **Submodule Issues**
```bash
# Submodule not initialized or out of sync
git submodule deinit -f deployment/kangaroo-electron
git submodule update --init --recursive

# Submodule in detached HEAD state
cd deployment/kangaroo-electron
git checkout main
cd ../..

# Submodule reference not updated
git add deployment/kangaroo-electron
git commit -m "submodule: Update reference"
git push origin main
```

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

# Submodule branch issues
cd deployment/kangaroo-electron
git checkout main
git pull origin main
git checkout release
git merge main --no-edit
git push origin release
cd ../..
```

### **Missing GitHub Release**
```bash
# Create missing release before builds
gh release create v0.2.3 --title "Release Title" --notes "Release notes"

# Check if release exists
gh release view v0.2.3

# List all releases
gh release list --limit 10
```

### **Build Failures**
```bash
# Check build logs
gh run list --limit 5
gh run view [RUN_ID] --log-failed

# Monitor running builds
gh run watch [RUN_ID]

# Common fixes:
# 1. Ensure release exists on GitHub
# 2. Check webhapp file is in pouch/ directory
# 3. Verify version consistency across files
# 4. Confirm submodule reference is updated
```

### **Asset Upload Issues**

#### **Checksum Calculation Errors**
```bash
# Recalculate checksums for Homebrew formula
cd deployment/homebrew

# Download assets to verify checksums
wget https://github.com/happenings-community/kangaroo-electron/releases/download/v0.2.3/Requests-and-Offers-0.2.3-arm64-mac.dmg

# Calculate correct checksums
sha256sum Requests-and-Offers-0.2.3-arm64-mac.dmg

# Update formula with correct checksums
vim Casks/requests-and-offers.rb
```

#### **Missing Release Assets**
```bash
# Check what assets are uploaded
gh release view v0.2.3 --json assets

# Expected assets for complete release:
# - requests_and_offers.webhapp (main repo)
# - Requests-and-Offers-0.2.3-arm64-mac.dmg
# - Requests-and-Offers-0.2.3-x64-mac.dmg
# - Requests-and-Offers-0.2.3-x64-win.exe
# - Requests-and-Offers-0.2.3-x64-linux.deb
# - Requests-and-Offers-0.2.3.AppImage

# Re-trigger builds if assets missing
cd deployment/kangaroo-electron
git commit --allow-empty -m "trigger: rebuild v0.2.3"
git push origin release
```

### **Template Population Issues**
```bash
# Release notes template variables not replaced
# Check template file exists
ls -la documentation/templates/release-notes-template.md

# Verify variable replacement
sed -n 's/{[^}]*}/VAR/gp' /tmp/release-notes-v0.2.3.md

# Manual template population example
cp documentation/templates/release-notes-template.md /tmp/release-notes-v0.2.3.md
sed -i 's/{VERSION}/0.2.3/g' /tmp/release-notes-v0.2.3.md
sed -i 's/{RELEASE_DATE}/2025-12-18/g' /tmp/release-notes-v0.2.3.md
```

### **Version Mismatch Issues**
```bash
# Check version consistency across files
grep -r "0.2.3" --include="*.json" --include="*.ts" --include="*.yaml" .

# Common version files to check:
# - package.json (root and ui/)
# - kangaroo.config.ts
# - dnas/requests_and_offers/dna.yaml
# - deployment/homebrew/Casks/requests-and-offers.rb

# Update inconsistent versions
find . -name "*.json" -exec sed -i 's/0.2.2/0.2.3/g' {} \;
find . -name "*.ts" -exec sed -i 's/0.2.2/0.2.3/g' {} \;
```

### **Network and Connectivity Issues**
```bash
# Test GitHub connectivity
gh auth status
curl -I https://api.github.com

# Test repository access
git ls-remote origin main
git fetch origin

# Submodule connectivity issues
git submodule sync
git submodule update --init --recursive
```

### **Environment Variable Issues**
```bash
# Check environment variables for build
echo $VITE_MOCK_BUTTONS_ENABLED
echo $VITE_PEERS_DISPLAY_ENABLED

# Verify .env file exists and is correct
cat .env

# Test environment affects build
bun package  # Should build without dev features in production mode
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
- **Expected Assets**: 5 files per release (4 binaries + checksums)

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
