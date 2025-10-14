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
- [ ] **Build WebHapp**: `bun build:happ` (creates `workdir/requests_and_offers.webhapp`)
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

### ✅ **Automated Deployment (Recommended)**

The project now includes a comprehensive automated deployment system that handles all release steps:

```bash
# Full automated deployment
./deployment/scripts/deploy.sh deploy 0.1.X

# Dry run to preview actions
./deployment/scripts/deploy.sh deploy 0.1.X --dry-run

# Check deployment status
./deployment/scripts/deploy.sh status
```

**Automated System Handles**:
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
  - ✅ Linux
- [ ] **Asset Upload Confirmation**: Check all expected assets are uploaded
  ```bash
  gh release view v0.1.X  # Should show 12+ assets
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
```bash
# Re-trigger builds with clean release
gh release delete v0.1.X --yes
gh release create v0.1.X --title "Title" --notes "Notes"
# Push trigger commit to restart builds
```

## 📊 Release Metrics

Track these metrics for release process improvement:

- **⏱️ Total Release Time**: Target <30 minutes end-to-end
- **🔄 Build Retry Count**: Target 0 retries needed
- **✅ Success Rate**: Target 100% successful releases
- **🐛 Issues Found**: Track common failure modes for process improvement

## 🎯 Success Criteria

A successful release includes:

- ✅ All 4 platform builds complete successfully
- ✅ All assets uploaded and downloadable
- ✅ Release notes complete and accurate
- ✅ Download links tested and working
- ✅ Branches synchronized between repositories
- ✅ Basic functionality verified in released app

---

**Next:** Use this checklist for every release to ensure consistency and reliability. Update the checklist based on lessons learned from each release.
