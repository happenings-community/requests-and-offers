# Repository Synchronization Issues - Troubleshooting Guide

> **Complete guide to resolving git submodule and multi-repository synchronization problems**

This guide addresses synchronization issues across the main repository, Kangaroo submodule, and Homebrew repository that can break the deployment process.

## 🔍 Understanding the Repository Architecture

### **Multi-Repository Structure**
```
Main Repository (requests-and-offers)
├── WebHapp builds
├── Version management
├── Release coordination
└── Submodule management
    └── deployment/kangaroo-electron → Kangaroo Repository

Kangaroo Repository (deployment/kangaroo-electron)
├── Desktop app builds
├── CI/CD workflows
├── Cross-platform compilation
└── Branch coordination
    ├── main branch (development)
    └── release branch (CI/CD trigger)

Homebrew Repository (deployment/homebrew)
├── Formula management
├── Checksum updates
└── macOS distribution
```

### **Synchronization Dependencies**
1. **Main → Kangaroo**: WebHapp transfer, version sync
2. **Kangaroo → Main**: Build status, asset links
3. **Kangaroo → Homebrew**: Binary checksums, version info
4. **Branch Coordination**: main ↔ release across repositories

## 🚨 Common Synchronization Issues

### **Issue 1: Submodule Out of Sync**

#### **Symptoms**
- Kangaroo submodule shows old commits
- WebHapp in pouch doesn't match main repo build
- Version mismatches between repositories

#### **Diagnosis**
```bash
# Check submodule status
git submodule status
git submodule foreach 'echo $path: $(git rev-parse --short HEAD)'

# Check for new commits in Kangaroo
cd deployment/kangaroo-electron
git log --oneline origin/main --not HEAD | head -5

# Compare versions across repos
echo "Main repo version: $(node -p -e "require('../package.json').version")"
echo "Kangaroo version: $(node -p -e "require('./package.json').version")"
```

#### **Solutions**

**Basic Sync Fix**
```bash
# Update submodule to latest
git submodule update --remote deployment/kangaroo-electron

# Stage and commit the update
git add deployment/kangaroo-electron
git commit -m "sync: update kangaroo submodule to latest"
git push origin main
```

**Complete Submodule Reset**
```bash
# Remove and reinitialize submodule
git submodule deinit -f deployment/kangaroo-electron
rm -rf .git/modules/deployment/kangaroo-electron
git submodule update --init --recursive deployment/kangaroo-electron

# Verify sync
git status
git submodule status
```

**Advanced Sync with Specific Commit**
```bash
# Update to specific commit
cd deployment/kangaroo-electron
git fetch origin
git checkout main
git pull origin main
git checkout [specific-commit-hash]

# Return to main repo and stage
cd ../..
git add deployment/kangaroo-electron
git commit -m "sync: kangaroo updated to commit [hash]"
```

### **Issue 2: Branch Divergence**

#### **Symptoms**
- Main and release branches have diverged
- Release branch missing commits from main
- Push conflicts when trying to sync

#### **Diagnosis**
```bash
# Check branch status
cd deployment/kangaroo-electron
git branch -a
git log --oneline main..release | wc -l
git log --oneline release..main | wc -l

# Find common ancestor
git merge-base main release
git log --oneline --graph main release | head -10
```

#### **Solutions**

**Standard Sync (main → release)**
```bash
cd deployment/kangaroo-electron

# Checkout and update release branch
git checkout release
git fetch origin
git pull origin release

# Merge latest from main
git merge main --no-edit

# Resolve conflicts if any
if [[ -n $(git status --porcelain) ]]; then
  echo "Conflicts detected - resolve manually"
  git status
  # Manual conflict resolution needed
fi

# Push synced release branch
git push origin release
```

**Force Sync (Emergency)**
```bash
# WARNING: This will overwrite release branch
cd deployment/kangaroo-electron

# Reset release to match main
git checkout release
git reset --hard main
git push --force-with-lease origin release
```

**Two-Way Sync (when both have changes)**
```bash
cd deployment/kangaroo-electron

# Create backup branch
git branch release-backup

# Merge release into main first
git checkout main
git merge release --no-edit

# Then merge main into release
git checkout release
git merge main --no-edit

# Push both branches
git push origin main
git push origin release
```

### **Issue 3: Version Mismatches**

#### **Symptoms**
- package.json versions don't match
- kangaroo.config.ts has different version
- Build artifacts tagged with wrong version

#### **Diagnosis**
```bash
# Check all version files
echo "Main package.json: $(node -p -e "require('./package.json').version")"
echo "Kangaroo package.json: $(cd deployment/kangaroo-electron && node -p -e "require('./package.json').version")"
echo "Kangaroo config: $(grep 'version:' deployment/kangaroo-electron/kangaroo.config.ts | head -1 | sed "s/.*version: '//; s/'.*//")"
echo "DNA version: $(grep 'version:' dnas/requests_and_offers/dna.yaml | awk '{print $2}')"

# Check for mismatches
main_version=$(node -p -e "require('./package.json').version")
kangaroo_version=$(cd deployment/kangaroo-electron && node -p -e "require('./package.json').version")

if [[ "$main_version" != "$kangaroo_version" ]]; then
  echo "VERSION MISMATCH DETECTED"
  echo "Main: $main_version"
  echo "Kangaroo: $kangaroo_version"
fi
```

#### **Solutions**

**Standard Version Synchronization**
```bash
# Set target version
TARGET_VERSION="0.1.X"

# Update main repository
echo "Updating main repository to $TARGET_VERSION"
npm version "$TARGET_VERSION" --no-git-tag-version

# Update Kangaroo package.json
cd deployment/kangaroo-electron
npm version "$TARGET_VERSION" --no-git-tag-version

# Update Kangaroo config
sed -i '' "s/version: .*/version: '$TARGET_VERSION',/" kangaroo.config.ts

# Update DNA if needed
cd ../..
# Edit dnas/requests_and_offers/dna.yaml to update version

# Commit all version changes
git add .
git commit -m "version: sync all repositories to v$TARGET_VERSION"
git push origin main

# Update Kangaroo release branch
cd deployment/kangaroo-electron
git checkout release
git merge main --no-edit
git push origin release
```

### **Issue 4: Git Submodule Path Issues**

#### **Symptoms**
- Submodule shows as modified but no changes
- Git cannot find submodule path
- Submodule initialization fails

#### **Diagnosis**
```bash
# Check submodule configuration
cat .gitmodules

# Check git index
git ls-files --stage | grep kangaroo

# Check for untracked files in submodule
cd deployment/kangaroo-electron
git status --porcelain
cd ../..
```

#### **Solutions**

**Fix Submodule Path**
```bash
# Remove broken submodule reference
git rm --cached deployment/kangaroo-electron

# Re-add submodule with correct path
git submodule add https://github.com/happenings-community/kangaroo-electron deployment/kangaroo-electron

# Update .gitmodules if needed
git add .gitmodules
git commit -m "fix: repair kangaroo submodule path"
```

**Reset Submodule Index**
```bash
# Remove from git index but keep files
git rm --cached deployment/kangaroo-electron

# Re-add to git index
git add deployment/kangaroo-electron

# Commit the fix
git commit -m "fix: reset kangaroo submodule index"
```

## 🔧 Preventive Synchronization Procedures

### **Daily Sync Health Check**

```bash
#!/bin/bash
# sync-health-check.sh

echo "=== Repository Synchronization Health Check ==="

# Check submodule status
echo "1. Submodule Status:"
git submodule status

# Check version consistency
echo "2. Version Consistency:"
main_version=$(node -p -e "require('./package.json').version")
kangaroo_version=$(cd deployment/kangaroo-electron && node -p -e "require('./package.json').version" 2>/dev/null || echo "ERROR")

echo "Main repo: $main_version"
echo "Kangaroo: $kangaroo_version"

if [[ "$main_version" != "$kangaroo_version" ]]; then
  echo "⚠️ VERSION MISMATCH DETECTED"
else
  echo "✅ Versions are consistent"
fi

# Check branch sync
echo "3. Branch Synchronization:"
cd deployment/kangaroo-electron
main_commit=$(git rev-parse main)
release_commit=$(git rev-parse release)

if [[ "$main_commit" == "$release_commit" ]]; then
  echo "✅ Branches are synchronized"
else
  echo "⚠️ Branches are out of sync"
  echo "Main: $main_commit"
  echo "Release: $release_commit"
  echo "Commits ahead: $(git log --oneline main..release | wc -l)"
  echo "Commits behind: $(git log --oneline release..main | wc -l)"
fi

cd ../..
echo "=== Health Check Complete ==="
```

### **Pre-Release Sync Validation**

```bash
#!/bin/bash
# pre-release-sync-validation.sh

echo "=== Pre-Release Synchronization Validation ==="

# Ensure clean working directories
echo "1. Working Directory Status:"
if [[ -n $(git status --porcelain) ]]; then
  echo "❌ Main repository has uncommitted changes"
  git status --short
  exit 1
else
  echo "✅ Main repository is clean"
fi

cd deployment/kangaroo-electron
if [[ -n $(git status --porcelain) ]]; then
  echo "❌ Kangaroo repository has uncommitted changes"
  git status --short
  exit 1
else
  echo "✅ Kangaroo repository is clean"
fi
cd ../..

# Verify submodule is up to date
echo "2. Submodule Update Status:"
git submodule update --remote --quiet
if [[ -n $(git status --porcelain | grep kangaroo) ]]; then
  echo "⚠️ Kangaroo submodule has updates"
  echo "Consider running: git add deployment/kangaroo-electron && git commit -m 'sync: update kangaroo'"
else
  echo "✅ Kangaroo submodule is up to date"
fi

# Check branch sync
echo "3. Branch Synchronization:"
cd deployment/kangaroo-electron
git fetch origin main release >/dev/null 2>&1

if git merge-base --is-ancestor origin/main origin/release; then
  echo "✅ Release branch is up to date with main"
else
  echo "⚠️ Release branch needs sync with main"
  echo "Run: git checkout release && git merge main --no-edit && git push origin release"
  exit 1
fi

cd ../..
echo "=== Pre-Release Validation Complete ==="
```

## 🚨 Emergency Recovery Procedures

### **Complete Repository Reset**

```bash
#!/bin/bash
# emergency-repository-reset.sh

echo "🚨 EMERGENCY REPOSITORY RESET"
echo "This will reset all repositories to last known good state"

# Backup current state
BACKUP_DIR=".emergency-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "Creating backup in: $BACKUP_DIR"

# Backup main repository state
git log --oneline -10 > "$BACKUP_DIR/main-log.txt"
git status > "$BACKUP_DIR/main-status.txt"
cp package.json "$BACKUP_DIR/package-main.json"

# Backup Kangaroo state
cd deployment/kangaroo-electron
git log --oneline -10 > "../../$BACKUP_DIR/kangaroo-log.txt"
git status > "../../$BACKUP_DIR/kangaroo-status.txt"
cp package.json "../../$BACKUP_DIR/package-kangaroo.json"
cp kangaroo.config.ts "../../$BACKUP_DIR/kangaroo-config.ts"
cd ../..

echo "Backup completed"
echo ""

# Confirm reset
echo "⚠️ This will:"
echo "  - Reset main repository to last tag"
echo "  - Reset Kangaroo to last tag"
echo "  - Clean all working directories"
echo "  - Remove all uncommitted changes"
echo ""
read -p "Are you sure? (type 'emergency-reset-confirm'): " confirm

if [[ "$confirm" != "emergency-reset-confirm" ]]; then
  echo "Reset cancelled"
  exit 1
fi

# Reset main repository
echo "Resetting main repository..."
git clean -fd
git reset --hard HEAD
git checkout main

# Find last good tag
LAST_TAG=$(git tag --sort=-version:refname | grep "^v[0-9]" | head -1)
echo "Resetting to tag: $LAST_TAG"
git reset --hard "$LAST_TAG"

# Reset Kangaroo submodule
echo "Resetting Kangaroo submodule..."
git submodule update --init --recursive
cd deployment/kangaroo-electron

git clean -fd
git reset --hard HEAD
git checkout main

# Find last good tag in Kangaroo
KANGAROO_LAST_TAG=$(git tag --sort=-version:refname | grep "^v[0-9]" | head -1)
echo "Resetting Kangaroo to tag: $KANGAROO_LAST_TAG"
git reset --hard "$KANGAROO_LAST_TAG"

# Sync release branch
git checkout release
git reset --hard "$KANGAROO_LAST_TAG"

cd ../..
git add deployment/kangaroo-electron
git commit -m "emergency: reset repositories to stable state"

echo ""
echo "✅ Emergency reset completed"
echo "Backup available at: $BACKUP_DIR"
echo "System is now at stable state: $LAST_TAG"
```

### **Selective Sync Recovery**

```bash
#!/bin/bash
# selective-sync-recovery.sh

# Recover specific synchronization issues without full reset

echo "=== Selective Sync Recovery ==="

# Recover version consistency
echo "1. Recovering version consistency..."
TARGET_VERSION="${1:-$(node -p -e "require('./package.json').version")}"

echo "Synchronizing all repositories to version: $TARGET_VERSION"

# Update main repository
npm version "$TARGET_VERSION" --no-git-tag-version --force

# Update Kangaroo
cd deployment/kangaroo-electron
npm version "$TARGET_VERSION" --no-git-tag-version --force
sed -i '' "s/version: .*/version: '$TARGET_VERSION',/" kangaroo.config.ts

cd ../..
git add .
git commit -m "recovery: sync all repositories to v$TARGET_VERSION"

# Recover branch sync
echo "2. Recovering branch synchronization..."
cd deployment/kangaroo-electron

git fetch origin main release
git checkout release
git merge main --no-edit
git push origin release

cd ../..
git add deployment/kangaroo-electron
git commit -m "recovery: sync kangaroo release branch"
git push origin main

echo "✅ Selective sync recovery completed"
```

## 📊 Monitoring and Alerting

### **Sync Status Dashboard**

```bash
#!/bin/bash
# sync-status-dashboard.sh

clear
echo "=== Repository Synchronization Status ==="
echo "Updated: $(date)"
echo ""

# Repository Status
echo "📊 Repository Status:"
echo "Main Repository: $(git rev-parse --abbrev-ref HEAD) @ $(git rev-parse --short HEAD)"
echo "Kangaroo: $(cd deployment/kangaroo-electron && git rev-parse --abbrev-ref HEAD) @ $(cd deployment/kangaroo-electron && git rev-parse --short HEAD)"
echo ""

# Version Status
echo "🔢 Version Status:"
main_version=$(node -p -e "require('./package.json').version")
kangaroo_version=$(cd deployment/kangaroo-electron && node -p -e "require('./package.json').version")
config_version=$(grep 'version:' deployment/kangaroo-electron/kangaroo.config.ts | head -1 | sed "s/.*version: '//; s/'.*//")

echo "Main package.json: $main_version"
echo "Kangaroo package.json: $kangaroo_version"
echo "Kangaroo config: $config_version"

if [[ "$main_version" == "$kangaroo_version" && "$kangaroo_version" == "$config_version" ]]; then
  echo "✅ All versions are synchronized"
else
  echo "❌ Version mismatch detected"
fi
echo ""

# Submodule Status
echo "🔗 Submodule Status:"
git submodule status
echo ""

# Branch Sync Status
echo "🌿 Branch Sync Status:"
cd deployment/kangaroo-electron

main_commit=$(git rev-parse main)
release_commit=$(git rev-parse release)

if [[ "$main_commit" == "$release_commit" ]]; then
  echo "✅ Main and Release branches are synchronized"
else
  echo "⚠️ Branches are out of sync"
  echo "Main: $main_commit"
  echo "Release: $release_commit"

  ahead_behind=$(git rev-list --count --left-right $main_commit...$release_commit)
  if [[ "$ahead_behind" == "0" ]]; then
    echo "Release is $(git rev-list --count $release_commit..main) commits behind main"
  elif [[ "$ahead_behind" == *"0" ]]; then
    echo "Release is $(echo "$ahead_behind" | cut -f1) commits ahead of main"
  else
    echo "Branches have diverged"
  fi
fi

cd ../..
echo ""

# Recent Activity
echo "📈 Recent Activity:"
echo "Main repository (last 3 commits):"
git log --oneline -3
echo ""
echo "Kangaroo repository (last 3 commits):"
cd deployment/kangaroo-electron
git log --oneline -3
cd ../..
```

## 📋 Synchronization Checklist

### **Pre-Deployment Checklist**
- [ ] Main repository working directory is clean
- [ ] Kangaroo submodule working directory is clean
- [ ] All repository versions are synchronized
- [ ] Kangaroo release branch is up to date with main
- [ ] Submodule is properly initialized and updated
- [ ] No merge conflicts exist in any repository
- [ ] All repositories can push to their remotes

### **Post-Deployment Verification**
- [ ] Main repository tag created successfully
- [ ] Kangaroo submodule updated with new WebHapp
- [ ] Kangaroo release branch triggered CI/CD
- [ ] Version consistency maintained across all repositories
- [ ] Homebrew repository updated with new checksums
- [ ] All repository links are working correctly

### **Health Monitoring**
- [ ] Daily sync health check passes
- [ ] No uncommitted changes in any repository
- [ ] All repository branches are synchronized
- [ ] Version consistency maintained
- [ ] Submodule status is clean
- [ ] Remote push operations succeed

---

**Implementation Note**: Repository synchronization is critical for deployment success. Establish regular health checks and preventive procedures to avoid synchronization issues during releases.