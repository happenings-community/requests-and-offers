# Automated Deployment System

**Comprehensive deployment automation for Requests and Offers across all platforms and repositories**

---

## Overview

The automated deployment system consolidates the entire release process into a single, reliable command. It coordinates deployment across three repositories (main, Kangaroo Electron, Homebrew) with comprehensive validation, error handling, and rollback capabilities.

### Key Benefits

- **Single Command Deployment**: Complete deployment with one command
- **Cross-Repository Coordination**: Automatic synchronization across all repositories
- **Risk Mitigation**: Comprehensive validation, backups, and rollback capabilities
- **Time Savings**: 2-hour manual process reduced to ~15 minutes automated
- **Error Reduction**: Eliminates manual version mismatches and forgotten steps
- **AI-Friendly**: Structured output and non-interactive modes for AI usage

---

## Architecture

### Component Overview

```
scripts/deployment/
├── deploy.sh                 # Main orchestrator
├── config/
│   └── deployment.json       # Configuration
└── lib/
    ├── validation.sh         # Health checks & validation
    ├── version-manager.sh    # Version synchronization
    ├── webapp-builder.sh     # WebApp build & release
    ├── kangaroo-deployer.sh  # Kangaroo automation
    └── homebrew-updater.sh   # Formula updates
```

### Deployment Flow

```
1. Pre-validation → 2. Version Sync → 3. WebApp Build →
4. Kangaroo Deploy → 5. Homebrew Update → 6. Post-validation →
7. Git Tags → 8. Cleanup
```

### Repository Coordination

- **Main Repository**: `happenings-community/requests-and-offers`
  - WebApp build and packaging
  - Main GitHub release with download links
  - Version source of truth

- **Kangaroo Repository**: `happenings-community/requests-and-offers-kangaroo-electron`
  - Cross-platform desktop application builds
  - Automated asset generation and upload
  - Build monitoring and validation

- **Homebrew Repository**: `happenings-community/homebrew-requests-and-offers`
  - Automatic formula updates
  - SHA256 checksum calculation
  - Installation testing

---

## Installation & Setup

### Prerequisites

Ensure these tools are installed and configured:

```bash
# Required tools
git --version
gh --version        # GitHub CLI (authenticated)
jq --version
curl --version
bun --version
cargo --version

# Authentication check
gh auth status
```

### Repository Setup

All three repositories must be cloned and accessible:

```bash
# Main repository
git clone https://github.com/happenings-community/requests-and-offers.git
cd requests-and-offers

# Kangaroo repository (parallel directory)
cd ../
git clone https://github.com/happenings-community/requests-and-offers-kangaroo-electron.git

# Homebrew repository (parallel directory)
git clone https://github.com/happenings-community/homebrew-requests-and-offers.git
```

### Configuration Verification

The deployment system automatically configures itself based on the repository structure:

```bash
# Verify configuration
cat scripts/deployment/config/deployment.json

# Test environment
./scripts/deployment/lib/validation.sh environment
```

---

## Usage Guide

### Basic Deployment

**Full deployment** (recommended):

```bash
# Interactive deployment with confirmation
bun run deploy 0.1.0-alpha.7

# Or using the script directly
./scripts/deployment/deploy.sh deploy 0.1.0-alpha.7
```

### Advanced Options

**Dry run** to preview actions:

```bash
bun run deploy:dry-run 0.1.0-alpha.7
# Shows exactly what would be done without executing
```

**Component-specific deployment**:

```bash
# Deploy only webapp and Kangaroo (skip Homebrew)
./scripts/deployment/deploy.sh deploy 0.1.0-alpha.7 --components webapp,kangaroo

# Deploy only Homebrew update
./scripts/deployment/deploy.sh deploy 0.1.0-alpha.7 --components homebrew
```

**Automated deployment** (no prompts):

```bash
# Auto-confirm all prompts
./scripts/deployment/deploy.sh deploy 0.1.0-alpha.7 --yes

# Skip tests for faster deployment
./scripts/deployment/deploy.sh deploy 0.1.0-alpha.7 --skip-tests --yes

# Extended timeout for slow builds
./scripts/deployment/deploy.sh deploy 0.1.0-alpha.7 --timeout 30 --yes
```

**JSON output mode** (AI-friendly):

```bash
# Structured output for automation
JSON_OUTPUT=true ./scripts/deployment/deploy.sh deploy 0.1.0-alpha.7 --yes
```

### Status and Validation

**Check deployment status**:

```bash
bun run deploy:status
# Shows current versions and build status across repositories
```

**Validate completed deployment**:

```bash
bun run deploy:validate 0.1.0-alpha.7
# Comprehensive validation of release assets and download links
```

### Rollback and Recovery

**Rollback deployment** (if something goes wrong):

```bash
bun run deploy:rollback 0.1.0-alpha.7
# Restores previous versions from automatic backup
```

**Clean up old deployments**:

```bash
bun run deploy:clean
# Removes old backups and log files
```

---

## Component Details

### 1. Version Management (`version-manager.sh`)

Centralized version control across all repositories:

```bash
# Get current version
./scripts/deployment/lib/version-manager.sh get

# Sync version across repositories
./scripts/deployment/lib/version-manager.sh sync 0.1.0-alpha.7

# Create git tags
./scripts/deployment/lib/version-manager.sh tag 0.1.0-alpha.7

# Validate version consistency
./scripts/deployment/lib/version-manager.sh validate
```

**Features**:

- Automatic package.json updates
- Kangaroo config synchronization
- Homebrew formula version updates
- Git tag creation and management

### 2. WebApp Builder (`webapp-builder.sh`)

Holochain application build and release:

```bash
# Full build and release process
./scripts/deployment/lib/webapp-builder.sh full 0.1.0-alpha.7

# Individual steps
./scripts/deployment/lib/webapp-builder.sh build       # Build only
./scripts/deployment/lib/webapp-builder.sh test        # Test only
./scripts/deployment/lib/webapp-builder.sh release 0.1.0-alpha.7  # Release only
```

**Features**:

- Automated hApp building (`build:zomes`, `build:happ`, `package`)
- Comprehensive test execution (optional)
- GitHub release creation with generated notes
- WebApp asset upload
- Build validation

### 3. Kangaroo Deployer (`kangaroo-deployer.sh`)

Cross-platform desktop application deployment:

```bash
# Full Kangaroo deployment
./scripts/deployment/lib/kangaroo-deployer.sh deploy 0.1.0-alpha.7

# Individual steps
./scripts/deployment/lib/kangaroo-deployer.sh branch     # Switch to release branch
./scripts/deployment/lib/kangaroo-deployer.sh webhapp 0.1.0-alpha.7  # Update config
./scripts/deployment/lib/kangaroo-deployer.sh build 0.1.0-alpha.7    # Trigger build
./scripts/deployment/lib/kangaroo-deployer.sh monitor 0.1.0-alpha.7  # Monitor progress
./scripts/deployment/lib/kangaroo-deployer.sh validate 0.1.0-alpha.7 # Validate assets
```

**Features**:

- Automatic release branch management
- WebHapp URL configuration
- Cross-platform build coordination (Windows, macOS, Linux)
- Build progress monitoring
- Asset validation for all platforms
- Release publishing

### 4. Homebrew Updater (`homebrew-updater.sh`)

Automated Homebrew formula maintenance:

```bash
# Full Homebrew update
./scripts/deployment/lib/homebrew-updater.sh update 0.1.0-alpha.7

# Individual steps
./scripts/deployment/lib/homebrew-updater.sh checksums 0.1.0-alpha.7  # Calculate SHA256
./scripts/deployment/lib/homebrew-updater.sh formula 0.1.0-alpha.7 <arm64_sha> <x64_sha>
./scripts/deployment/lib/homebrew-updater.sh test      # Test installation
./scripts/deployment/lib/homebrew-updater.sh commit 0.1.0-alpha.7   # Commit changes
```

**Features**:

- Automatic SHA256 checksum calculation
- Formula file updates (version, checksums, URLs)
- Formula syntax validation
- Local installation testing (optional)
- Git commit and push automation

### 5. Validation System (`validation.sh`)

Comprehensive health checks and validation:

```bash
# Environment validation
./scripts/deployment/lib/validation.sh environment

# Version format validation
./scripts/deployment/lib/validation.sh version 0.1.0-alpha.7

# Build validation
./scripts/deployment/lib/validation.sh webapp
./scripts/deployment/lib/validation.sh assets 0.1.0-alpha.7 owner repo

# Download testing
./scripts/deployment/lib/validation.sh downloads 0.1.0-alpha.7 owner repo

# Build monitoring
./scripts/deployment/lib/validation.sh build owner repo 15
```

**Features**:

- Pre-deployment environment checks
- Version format validation
- Build artifact validation
- Download link testing
- GitHub Actions monitoring
- Backup and restore capabilities

---

## Configuration

### Primary Configuration (`deployment.json`)

```json
{
  "repositories": {
    "main": {
      "owner": "happenings-community",
      "repo": "requests-and-offers",
      "path": "/home/user/requests-and-offers"
    },
    "kangaroo": {
      "owner": "happenings-community",
      "repo": "requests-and-offers-kangaroo-electron",
      "path": "/home/user/requests-and-offers-kangaroo-electron"
    },
    "homebrew": {
      "owner": "happenings-community",
      "repo": "homebrew-requests-and-offers",
      "path": "/home/user/homebrew-requests-and-offers"
    }
  },
  "build": {
    "webapp_filename": "requests_and_offers.webhapp",
    "app_id": "requests-and-offers.happenings-community.kangaroo-electron",
    "platforms": ["windows-2022", "macos-13", "macos-latest", "ubuntu-22.04"],
    "timeout_minutes": 15
  },
  "validation": {
    "required_assets": [
      "requests-and-offers.happenings-community.kangaroo-electron-{version}-setup.exe",
      "requests-and-offers.happenings-community.kangaroo-electron-{version}-x64.dmg",
      "requests-and-offers.happenings-community.kangaroo-electron-{version}-arm64.dmg",
      "requests-and-offers.happenings-community.kangaroo-electron-{version}.AppImage",
      "requests-and-offers.happenings-community.kangaroo-electron_{version}_amd64.deb"
    ]
  }
}
```

### Environment Variables

```bash
# Enable JSON output mode for automation
export JSON_OUTPUT=true

# Custom config file location
export DEPLOYMENT_CONFIG=/path/to/custom/deployment.json
```

---

## AI Usage Guide

The deployment system is designed to be AI-friendly with structured output and non-interactive modes.

### AI-Optimized Commands

```bash
# Fully automated deployment with JSON output
JSON_OUTPUT=true ./scripts/deployment/deploy.sh deploy 0.1.0-alpha.7 --yes

# Dry run with structured output
JSON_OUTPUT=true ./scripts/deployment/deploy.sh deploy 0.1.0-alpha.7 --dry-run

# Status check with structured data
JSON_OUTPUT=true ./scripts/deployment/deploy.sh status

# Validation with detailed results
JSON_OUTPUT=true ./scripts/deployment/deploy.sh validate 0.1.0-alpha.7
```

### JSON Output Format

All operations output structured JSON when `JSON_OUTPUT=true`:

```json
{
  "status": "success|error|warning|info",
  "message": "Human-readable description",
  "data": {
    /* Operation-specific data */
  },
  "timestamp": "2025-01-01T12:00:00Z"
}
```

### AI Integration Examples

**Python Integration**:

```python
import subprocess
import json

def deploy_version(version):
    result = subprocess.run([
        'scripts/deployment/deploy.sh', 'deploy', version, '--yes'
    ], env={'JSON_OUTPUT': 'true'}, capture_output=True, text=True)

    return json.loads(result.stdout)
```

**Shell Integration**:

```bash
# Parse JSON output
deploy_result=$(JSON_OUTPUT=true ./scripts/deployment/deploy.sh deploy 0.1.0-alpha.7 --yes)
status=$(echo "$deploy_result" | jq -r '.status')

if [[ "$status" == "success" ]]; then
    echo "Deployment successful"
else
    echo "Deployment failed: $(echo "$deploy_result" | jq -r '.message')"
fi
```

---

## Error Handling & Recovery

### Automatic Error Recovery

The system includes comprehensive error handling:

1. **Pre-validation**: Checks environment and prerequisites before starting
2. **Atomic Operations**: Each step either fully succeeds or rolls back
3. **Automatic Backups**: Creates restore points before making changes
4. **Health Checks**: Validates each component before proceeding
5. **Rollback Capability**: One-command rollback to previous state

### Common Issues & Solutions

#### Build Failures

**Problem**: Platform-specific build failures

```bash
# Check build status
./scripts/deployment/lib/kangaroo-deployer.sh status

# View detailed logs
gh run view <run-id> --log --repo happenings-community/requests-and-offers-kangaroo-electron
```

**Solution**: Re-trigger build or investigate platform-specific errors

#### Missing Assets

**Problem**: Some platform assets not uploaded

```bash
# Validate assets
./scripts/deployment/lib/validation.sh assets 0.1.0-alpha.7 happenings-community requests-and-offers-kangaroo-electron
```

**Solution**: Check build completion and re-run if needed

#### Version Inconsistencies

**Problem**: Version mismatch between repositories

```bash
# Check version consistency
./scripts/deployment/lib/version-manager.sh validate
```

**Solution**: Re-sync versions or restore from backup

#### Network/API Issues

**Problem**: GitHub API rate limits or network issues

```bash
# Check GitHub CLI authentication
gh auth status

# Verify API access
gh api rate_limit
```

**Solution**: Wait for rate limit reset or use different authentication

### Manual Recovery Procedures

If automatic recovery fails:

1. **Restore from backup**:

   ```bash
   ./scripts/deployment/lib/validation.sh restore
   ```

2. **Manual cleanup**:

   ```bash
   # Remove failed releases
   gh release delete v0.1.0-alpha.7 --yes

   # Reset git state
   git reset --hard HEAD~1
   ```

3. **Verify repository states**:
   ```bash
   ./scripts/deployment/deploy.sh status
   ```

---

## Performance & Optimization

### Deployment Timeline

**Full Deployment Process**:

- Pre-validation: ~30 seconds
- WebApp build: ~2 minutes
- Kangaroo build: ~10-15 minutes (parallel across 4 platforms)
- Homebrew update: ~1 minute
- Post-validation: ~30 seconds
- **Total: ~15-18 minutes** (vs. 2+ hours manual)

### Performance Optimizations

1. **Parallel Operations**: Platform builds run simultaneously
2. **Caching**: Build artifacts cached between steps
3. **Validation Caching**: Results cached for session duration
4. **Selective Deployment**: Deploy only changed components
5. **Background Monitoring**: Non-blocking build monitoring

### Resource Management

```bash
# Monitor resource usage
./scripts/deployment/deploy.sh status

# Clean up resources
./scripts/deployment/deploy.sh clean

# Extended timeout for complex builds
./scripts/deployment/deploy.sh deploy 0.1.0-alpha.7 --timeout 30
```

---

## Security Considerations

### Authentication Requirements

- **GitHub CLI**: Authenticated with appropriate repository permissions
- **Git Access**: SSH or HTTPS access to all three repositories
- **Local Permissions**: Read/write access to repository directories

### Security Features

1. **Backup Creation**: Automatic backups before modifications
2. **Validation Checks**: Pre and post-deployment validation
3. **Atomic Operations**: All-or-nothing deployment strategy
4. **Access Control**: Respects existing Git and GitHub permissions
5. **Audit Trail**: Comprehensive logging of all operations

### Best Practices

- Use dedicated deployment environment
- Regular backup of important branches
- Monitor deployment logs for suspicious activity
- Keep GitHub tokens secure and rotate regularly
- Verify checksums match expected values

---

## Monitoring & Logging

### Log Files

All deployment operations are logged:

```bash
# View latest deployment log
ls -la /tmp/deployment-*.log | tail -1

# Follow deployment in real-time
tail -f /tmp/deployment-0.1.0-alpha.7-*.log
```

### Monitoring Commands

```bash
# Check deployment status
bun run deploy:status

# Monitor Kangaroo build progress
./scripts/deployment/lib/kangaroo-deployer.sh monitor 0.1.0-alpha.7

# Validate deployment health
bun run deploy:validate 0.1.0-alpha.7
```

### Success Metrics

A successful deployment includes:

- ✅ All tests pass (if not skipped)
- ✅ WebApp builds and packages correctly
- ✅ GitHub release created with assets
- ✅ All platform builds complete (Windows, macOS x64/ARM64, Linux)
- ✅ All assets uploaded and accessible
- ✅ Homebrew formula updated with correct checksums
- ✅ Download links verified
- ✅ Git tags created across repositories

---

## Troubleshooting Guide

### Diagnostic Commands

```bash
# Environment check
./scripts/deployment/lib/validation.sh environment

# Version consistency check
./scripts/deployment/lib/version-manager.sh validate

# Build status
./scripts/deployment/lib/kangaroo-deployer.sh status

# Asset validation
./scripts/deployment/lib/validation.sh assets 0.1.0-alpha.7 owner repo
```

### Common Error Patterns

#### "Release not found" errors

- Release creation may have failed
- Check GitHub permissions
- Verify repository access

#### "Build timeout" errors

- Increase timeout with `--timeout` flag
- Check GitHub Actions status
- Verify build infrastructure

#### "Checksum mismatch" errors

- DMG files may still be building
- Wait for complete build before running Homebrew update
- Manually verify asset availability

#### "Permission denied" errors

- Check GitHub CLI authentication
- Verify repository write permissions
- Ensure Git remote access

### Debug Mode

Enable detailed debug output:

```bash
# Enable bash debug mode
set -x

# Run with maximum verbosity
JSON_OUTPUT=true ./scripts/deployment/deploy.sh deploy 0.1.0-alpha.7 --yes 2>&1 | tee deployment-debug.log
```

---

## Migration Guide

### Migrating from Manual Process

To transition from the previous manual deployment process:

1. **Verify Repository Structure**: Ensure all three repositories are cloned in parallel directories
2. **Test Environment**: Run environment validation
3. **Backup Current State**: Create manual backups of current releases
4. **Dry Run**: Test the automated process with `--dry-run` flag
5. **Gradual Adoption**: Start with single-component deployments
6. **Full Automation**: Move to complete automated deployments

### Configuration Updates

If repository locations or names change, update `config/deployment.json`:

```json
{
  "repositories": {
    "main": {
      "owner": "new-owner",
      "repo": "new-repo-name",
      "path": "/new/path/to/repo"
    }
  }
}
```

---

## Maintenance

### Regular Maintenance Tasks

1. **Weekly**: Clean up old backups and logs

   ```bash
   bun run deploy:clean
   ```

2. **Monthly**: Verify all dependencies are up to date

   ```bash
   ./scripts/deployment/lib/validation.sh environment
   ```

3. **Per Release**: Test dry-run before important releases
   ```bash
   bun run deploy:dry-run x.y.z
   ```

### Updates and Improvements

The deployment system is designed to be maintainable:

- **Modular Design**: Each component can be updated independently
- **Configuration-Driven**: Behavior controlled through JSON config
- **Comprehensive Testing**: All components include validation
- **Documentation**: All scripts are self-documenting with help commands

---

## Support & Resources

### Help Commands

Every script includes comprehensive help:

```bash
# Main deployment help
./scripts/deployment/deploy.sh help

# Component-specific help
./scripts/deployment/lib/validation.sh help
./scripts/deployment/lib/version-manager.sh help
./scripts/deployment/lib/webapp-builder.sh help
./scripts/deployment/lib/kangaroo-deployer.sh help
./scripts/deployment/lib/homebrew-updater.sh help
```

### Related Documentation

- **[Original Manual Process](kangaroo-deployment-process.md)**: Detailed background and manual procedures
- **[Project Documentation](../DOCUMENTATION_INDEX.md)**: Complete project documentation index
- **[Troubleshooting Guide](../TROUBLESHOOTING.md)**: General project troubleshooting

### Getting Help

For issues with the automated deployment system:

1. Check the troubleshooting section above
2. Review deployment logs in `/tmp/deployment-*.log`
3. Run diagnostic commands to identify issues
4. Create GitHub issue with logs and error details

---

_This automated deployment system significantly reduces deployment complexity while improving reliability and consistency. The time investment in automation pays off immediately with faster, safer deployments._
