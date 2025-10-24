# CI/CD Debugging Guide

> **Comprehensive guide to diagnosing and resolving GitHub Actions build failures**

This guide covers systematic debugging approaches for CI/CD issues in the deployment pipeline, based on real troubleshooting experience from production deployments.

## 🔍 Systematic Debugging Framework

### **Phase 1: Issue Classification**

#### **A. Build Failures**
- Compilation errors
- Dependency resolution failures
- Environment setup issues
- Resource allocation problems

#### **B. Test Failures**
- Unit test failures
- Integration test errors
- Test environment issues
- Timeout problems

#### **C. Upload Failures**
- Asset upload errors
- Permission issues
- Network connectivity problems
- GitHub API rate limiting

#### **D. Configuration Issues**
- Workflow syntax errors
- Environment variable problems
- Secret management issues
- Platform-specific failures

## 🛠️ Debugging Tools and Techniques

### **1. GitHub Actions Interface Debugging**

#### **Workflow Run Analysis**
```bash
# Get recent workflow runs
gh run list --limit=10

# Get specific run details
gh run view [RUN_ID]

# Get failed job logs
gh run view [RUN_ID] --log-failed

# Get all logs for specific job
gh run view [RUN_ID] --job [JOB_ID] --log
```

#### **Step-by-Step Debugging**
```bash
# Re-run failed workflow with debug logging
gh run rerun [RUN_ID] --debug

# Re-run specific failed jobs
gh run rerun [RUN_ID] --failed

# Download workflow artifacts
gh run download [RUN_ID]
```

### **2. Local Reproduction**

#### **Environment Replication**
```bash
# Create similar environment locally
docker run -it ubuntu:22.04

# Install same dependencies
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# Clone repository and test
git clone [REPO_URL]
cd [REPO_NAME]
npm install
npm run build
```

#### **Step Isolation Testing**
```bash
# Test individual build steps
yarn build:mac-arm64
yarn build:mac-x64
yarn build:win
yarn build:linux

# Check intermediate outputs
ls dist/
find dist -name "*.dmg"
```

### **3. Logging and Monitoring**

#### **Enhanced Logging Strategy**
```yaml
# Add debug logging to workflow
- name: Debug Environment
  run: |
    echo "Node version: $(node --version)"
    echo "NPM version: $(npm --version)"
    echo "Yarn version: $(yarn --version)"
    echo "Working directory: $(pwd)"
    echo "Environment variables:"
    env | sort

- name: Debug Build Process
  run: |
    echo "Before build:"
    ls -la
    echo "Build command: yarn build:${{ matrix.platform }}"
    set -x  # Enable command tracing
    yarn build:${{ matrix.platform }}
    set +x
    echo "After build:"
    ls -la dist/
```

#### **Real-time Monitoring**
```bash
# Monitor workflow in real-time
gh run list --limit=1 --json status,conclusion,createdAt | jq -r '.'

# Watch specific workflow
watch -n 5 "gh run view [RUN_ID] --json status,jobs"
```

## 🐛 Common Issues and Solutions

### **Issue 1: Environment Setup Failures**

#### **Symptoms**
- Node.js installation failures
- Package manager errors
- Dependency resolution timeouts

#### **Diagnosis**
```yaml
# Add environment debugging
- name: Debug Environment Setup
  run: |
    echo "=== Node.js Information ==="
    which node
    node --version
    echo "=== Package Manager ==="
    which yarn
    yarn --version
    echo "=== System Information ==="
    uname -a
    df -h
    free -h
    echo "=== Network Test ==="
    curl -I https://github.com
```

#### **Solutions**
```yaml
# Use explicit Node.js setup
- name: setup node
  uses: actions/setup-node@v4
  with:
    node-version: '22'
    cache: 'yarn'

# Add dependency cache
- name: Cache dependencies
  uses: actions/cache@v3
  with:
    path: |
      ~/.yarn
      node_modules
    key: ${{ runner.os }}-yarn-${{ hashFiles('**/yarn.lock') }}
    restore-keys: |
      ${{ runner.os }}-yarn-

# Use explicit yarn installation
- name: Install dependencies
  run: |
    corepack enable
    yarn install --frozen-lockfile
```

### **Issue 2: Build Failures**

#### **Symptoms**
- Compilation errors
- Memory exhaustion
- Timeout during build
- Missing build tools

#### **Diagnosis**
```yaml
# Add build debugging
- name: Debug Build Process
  run: |
    echo "=== Build Environment ==="
    echo "Available memory:"
    free -h
    echo "Disk space:"
    df -h
    echo "Build command: yarn build:${{ matrix.platform }}"

    # Set resource limits if needed
    export NODE_OPTIONS="--max-old-space-size=4096"

    # Enable verbose output
    set -x
    yarn build:${{ matrix.platform}} 2>&1 | tee build.log
    set +x

    echo "=== Build Output Analysis ==="
    echo "Build log size: $(wc -l build.log)"
    echo "Error patterns:"
    grep -i error build.log | head -10 || echo "No errors found in log"
```

#### **Solutions**
```yaml
# Increase memory allocation
- name: Build with increased memory
  env:
    NODE_OPTIONS: '--max-old-space-size=4096'
  run: yarn build:${{ matrix.platform }}

# Add build timeout handling
- name: Build with timeout
  timeout-minutes: 30
  run: |
    timeout 1800 yarn build:${{ matrix.platform }}

# Use explicit build steps
- name: Pre-build verification
  run: |
    yarn --version
    node --version
    ls -la
    cat package.json | jq '.scripts'

- name: Build application
  run: |
    yarn build:${{ matrix.platform }}

- name: Post-build verification
  run: |
    echo "Build artifacts:"
    find dist -type f -exec ls -lh {} \;
```

### **Issue 3: Permission and Access Issues**

#### **Symptoms**
- GitHub API permission errors
- Secret access failures
- Repository write access denied

#### **Diagnosis**
```yaml
# Debug permissions
- name: Debug GitHub Permissions
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: |
    echo "=== GitHub Token Test ==="
    gh auth status
    echo "=== Repository Access ==="
    gh repo view ${{ github.repository }}
    echo "=== Release Permissions ==="
    gh release list --limit 1 || echo "No releases found"
```

#### **Solutions**
```yaml
# Ensure proper permissions
permissions:
  contents: write
  actions: read
  checks: read

# Use explicit token for GitHub operations
- name: Upload to GitHub
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: |
    gh release upload "v${VERSION}" "dist/asset.file"
```

### **Issue 4: Platform-Specific Failures**

#### **macOS Build Failures**
```yaml
# macOS-specific debugging
- name: Debug macOS Build
  if: matrix.platform == 'macos-latest'
  run: |
    echo "=== macOS Information ==="
    sw_vers
    xcodebuild -version
    echo "=== Code Signing Setup ==="
    security find-identity -v -p codesigning
    echo "=== Notarization Setup ==="
    echo "Apple ID configured: ${{ env.APPLE_ID_EMAIL }}"
```

#### **Windows Build Failures**
```yaml
# Windows-specific debugging
- name: Debug Windows Build
  if: matrix.platform == 'windows-2022'
  run: |
    echo "=== Windows Information ==="
    systeminfo | findstr /B /C:"OS Name"
    echo "=== Visual Studio Setup ==="
    where cl
    echo "=== Certificate Setup ==="
    certmgr /list | findstr -i "requests and offers" || echo "No certificates found"
```

#### **Linux Build Failures**
```yaml
# Linux-specific debugging
- name: Debug Linux Build
  if: matrix.platform == 'ubuntu-22.04'
  run: |
    echo "=== Linux Information ==="
    lsb_release -a
    echo "=== Package Information ==="
    dpkg -l | grep -E "(nodejs|yarn)"
    echo "=== Display Information ==="
    echo $DISPLAY
    xvfb-run --help || echo "xvfb not available"
```

## 🔧 Advanced Debugging Techniques

### **1. Workflow Matrix Debugging**

#### **Isolate Platform-Specific Issues**
```yaml
# Test platforms individually
strategy:
  matrix:
    platform: [ubuntu-22.04]
    include:
      - platform: ubuntu-22.04
        test-name: "linux-only"
      # Add other platforms one at a time for debugging
```

#### **Conditional Debugging**
```yaml
# Enable debugging only for specific conditions
- name: Debug Build
  if: failure() && matrix.platform == 'macos-latest'
  run: |
    echo "=== Debugging macOS Failure ==="
    # Additional debugging steps
```

### **2. Artifact Collection**

#### **Comprehensive Artifact Collection**
```yaml
# Collect all possible debugging artifacts
- name: Collect Debug Artifacts
  if: failure()
  run: |
    mkdir -p debug-artifacts

    # Collect logs
    find . -name "*.log" -exec cp {} debug-artifacts/ \;

    # Collect configuration
    cp package.json debug-artifacts/
    cp yarn.lock debug-artifacts/

    # Collect build artifacts (if any)
    if [ -d "dist" ]; then
      cp -r dist debug-artifacts/build-output
    fi

    # Collect environment info
    env > debug-artifacts/environment.txt
    node --version > debug-artifacts/node-version.txt
    yarn --version > debug-artifacts/yarn-version.txt

- name: Upload Debug Artifacts
  if: failure()
  uses: actions/upload-artifact@v3
  with:
    name: debug-artifacts-${{ matrix.platform }}
    path: debug-artifacts/
```

### **3. Remote Debugging**

#### **SSH Debugging Setup**
```yaml
# Enable SSH debugging (for critical issues)
- name: Setup tmate session
  if: failure() && github.event_name == 'workflow_dispatch'
  uses: mxschmitt/action-tmate@v3
  with:
    limit-access-to-actor: true
```

## 📊 Performance Debugging

### **Build Time Analysis**

#### **Timing Analysis**
```yaml
# Add timing to build steps
- name: Build with timing
  run: |
    echo "Build started at: $(date)"
    start_time=$(date +%s)

    yarn build:${{ matrix.platform }}

    end_time=$(date +%s)
    duration=$((end_time - start_time))
    echo "Build completed at: $(date)"
    echo "Build duration: ${duration} seconds"
```

#### **Resource Usage Monitoring**
```yaml
# Monitor resource usage during build
- name: Monitor Resource Usage
  run: |
    # Start monitoring in background
    (
      while true; do
        echo "$(date): Memory usage: $(free -h | grep Mem)"
        echo "$(date): Disk usage: $(df -h .)"
        sleep 30
      done
    ) &
    monitor_pid=$!

    # Run build
    yarn build:${{ matrix.platform}}

    # Stop monitoring
    kill $monitor_pid
```

## 🚨 Emergency Procedures

### **Immediate Fix Deployment**

#### **Hotfix Workflow**
```yaml
# Emergency hotfix workflow
name: Emergency Hotfix

on:
  workflow_dispatch:
    inputs:
      fix_description:
        description: 'Description of the hotfix'
        required: true

jobs:
  hotfix:
    runs-on: ubuntu-latest
    steps:
      - name: Emergency Fix
        run: |
          echo "Applying emergency fix: ${{ github.event.inputs.fix_description }}"
          # Emergency fix commands
```

### **Rollback Triggers**

#### **Automatic Rollback on Failure**
```yaml
# Auto-rollback on critical failures
- name: Deploy
  run: ./deploy.sh

- name: Health Check
  run: ./health-check.sh

- name: Rollback on Failure
  if: failure()
  run: |
    echo "Deployment failed, initiating rollback"
    ./rollback.sh
```

## 📋 Debugging Checklist

### **Pre-Debugging Preparation**
- [ ] Identify the exact failure point
- [ ] Collect relevant logs and artifacts
- [ ] Reproduce the issue locally if possible
- [ ] Document the expected vs actual behavior

### **Systematic Debugging Process**
1. **Environment Analysis**
   - [ ] Check system resources and dependencies
   - [ ] Verify permissions and access
   - [ ] Examine environment variables

2. **Build Process Analysis**
   - [ ] Review build logs for errors
   - [ ] Check build outputs and artifacts
   - [ ] Validate build configuration

3. **Upload Process Analysis**
   - [ ] Verify GitHub API access
   - [ ] Check asset availability
   - [ ] Test upload permissions

4. **Post-Build Validation**
   - [ ] Verify release creation
   - [ ] Check asset availability
   - [ ] Test download links

### **Documentation Requirements**
- [ ] Document the root cause
- [ ] Record the solution implemented
- [ ] Note any side effects or trade-offs
- [ ] Update prevention strategies

---

**Implementation Note**: This debugging framework has been proven effective in resolving complex CI/CD issues. Use systematic approach rather than random troubleshooting to ensure consistent results.