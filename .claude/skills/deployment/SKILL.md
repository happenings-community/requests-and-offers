---
name: Deployment Automation
description: Complete deployment system for Holochain hApps with multi-repository coordination, cross-platform builds, and CI/CD automation
---

# Deployment Automation Skill

**Complete deployment system for Holochain hApps with proven patterns from successful production releases**

## Overview

This skill provides the comprehensive deployment infrastructure used to successfully release Requests and Offers v0.1.9 with 100% cross-platform success rate. It orchestrates deployment across multiple repositories (main, Kangaroo Electron, Homebrew) with proven CI/CD patterns and automated release coordination.

## Capabilities

### **Multi-Repository Coordination**
- **Main Repository**: WebHapp build and release management
- **Kangaroo Submodule**: Cross-platform desktop applications
- **Homebrew Repository**: macOS distribution automation
- **Git Submodule Synchronization**: Automatic branch and version coordination
- **Cross-Repository Linking**: Seamless integration between all deployment targets

### **Cross-Platform Deployment**
- **macOS**: ARM64 (Apple Silicon) + x64 (Intel) with optional code signing
- **Windows**: x64 with EV code signing support
- **Linux**: DEB packages + AppImage (universal portable)
- **WebApp**: WebHapp packaging with test/production modes
- **Production Network**: Holostrap alpha network configuration

### **CI/CD Pipeline Management**
- **GitHub Actions Optimization**: Proven workflow patterns
- **Asset Upload Automation**: Manual GitHub CLI pattern (100% reliable)
- **Build Verification**: Cross-platform validation and testing
- **Environment Management**: Development, test, and production configurations

### **Release Process Automation**
- **7-Step Manual Process**: Proven 100% success rate from v0.1.9
- **Version Synchronization**: Automatic version management across repositories
- **Changelog Management**: Automated release notes and documentation
- **GitHub Release Creation**: Complete release asset management

## Quick Start

### **For New Release**
"Deploy version 0.2.0 with all platforms"

**Claude will:**
1. Run pre-flight validation checks
2. Execute the 7-step proven release process
3. Monitor cross-platform builds
4. Update all repositories with release assets
5. Generate comprehensive release notes

### **For Deployment Troubleshooting**
"The macOS build failed to upload assets"

**Claude will:**
1. Apply proven asset upload fixes
2. Use wildcard file discovery patterns
3. Implement manual GitHub CLI upload strategy
4. Verify cross-platform build success

### **For Environment Setup**
"Set up deployment environment for a new team member"

**Claude will:**
1. Validate GitHub CLI authentication
2. Configure git submodule access
3. Set up Nix environment for builds
4. Verify all deployment prerequisites

## Proven Patterns

### **CI/CD Asset Upload Fix**
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

### **7-Step Release Process**
Proven 100% success rate in production:

1. **Main Repository Updates** - Version bump + changelog
2. **WebHapp Build** - `bun package` in Nix environment
3. **GitHub Release Creation** - Manual release with webhapp upload
4. **Kangaroo Repository Update** - Copy webhapp + version sync
5. **CI/CD Trigger** - Push to release branch
6. **Build Monitoring** - Cross-platform build verification
7. **Release Notes Finalization** - Cross-link desktop app links

### **Cross-Platform Build Optimization**
Production benchmark performance from v0.1.9:
- **macOS ARM64**: 1m46s (fastest platform)
- **macOS x64**: 3m2s
- **Windows x64**: 2m54s
- **Linux x64**: ~4m (includes post-install scripts)

## Architecture Integration

### **Repository Structure**
```
Main Repository (requests-and-offers)
├── WebHapp build and packaging
├── Release coordination
├── Version management
└── Cross-repository linking

Kangaroo Submodule (deployment/kangaroo-electron)
├── Desktop app builds (Windows/macOS/Linux)
├── GitHub Actions CI/CD
├── Code signing configuration
└── Asset upload automation

Homebrew Repository (deployment/homebrew)
├── Formula management
├── Checksum updates
└── macOS distribution
```

### **Deployment Flow**
```
1. Pre-flight Validation → Environment checks, auth verification
2. Version Synchronization → All repositories aligned
3. WebHapp Build → Production-ready bundle
4. Release Creation → GitHub release with webhapp
5. Kangaroo Update → Copy webhapp, trigger CI/CD
6. Multi-Platform Builds → Parallel builds across platforms
7. Asset Verification → All binaries uploaded successfully
8. Cross-Repository Updates → Homebrew formula, documentation
9. Post-Release Validation → Downloads tested, links verified
```

## Templates and Automation

### **Release Templates**
- **GitHub Workflows**: Optimized CI/CD pipeline templates
- **Kangaroo Config**: Production-ready desktop app configuration
- **Deployment Config**: Multi-environment configuration management
- **Release Notes**: Structured documentation templates

### **Automation Scripts**
- **Pre-flight Checks**: Environment validation and prerequisites
- **Release Orchestrator**: Automated 7-step release execution
- **Build Verification**: Cross-platform build validation
- **Rollback Procedures**: Emergency recovery automation

### **Configuration Management**
- **Environment Variables**: Development, test, production configurations
- **Version Synchronization**: Automatic version management
- **Network Configuration**: Production Holostrap settings
- **Code Signing**: macOS and Windows certificate management

## Troubleshooting

### **Common Issues and Solutions**

#### **Asset Upload Failures**
**Symptoms**: Builds complete but assets don't appear in GitHub release
**Root Cause**: electron-builder auto-publishing fails for branch builds
**Solution**: Manual GitHub CLI uploads with wildcard patterns

#### **Build Failures**
**Symptoms**: CI/CD jobs fail during build process
**Common Fixes**:
- Verify webhapp exists in pouch directory
- Check version synchronization across repositories
- Ensure proper Nix environment setup
- Validate GitHub CLI authentication

#### **Repository Sync Issues**
**Symptoms**: Submodules out of sync, version mismatches
**Solution**: Proper git branch management and submodule updates

#### **Platform-Specific Issues**
- **macOS**: Code signing certificate management
- **Windows**: EV certificate configuration
- **Linux**: Post-install script permissions

### **Recovery Procedures**
- Emergency rollback automation
- Partial release recovery
- Asset re-upload procedures
- Repository resynchronization

## Performance Metrics

### **v0.1.9 Success Benchmarks**
- **Platform Success Rate**: 100% (5/5 platforms)
- **Total Release Time**: ~2.5 hours (including issue resolution)
- **Build Retry Count**: 1 retry (for macOS upload fixes)
- **Asset Upload Success**: 100% after implementing manual patterns

### **Target Performance**
- **Release Time**: <30 minutes (optimized process)
- **Success Rate**: 100% cross-platform availability
- **Automation Level**: 90% of process automated
- **Error Recovery**: <5 minutes for common issues

## Best Practices

### **Release Management**
1. **Use Proven Patterns**: Follow the 7-step process exactly
2. **Manual Upload Strategy**: More reliable than auto-publishing
3. **Wildcard File Discovery**: Eliminates filename mismatch failures
4. **Cross-Repository Coordination**: Ensure proper synchronization

### **Build Optimization**
1. **Parallel Builds**: Run all platform builds concurrently
2. **Asset Verification**: Validate all uploads before proceeding
3. **Environment Isolation**: Use Nix for consistent build environments
4. **Production Configuration**: Separate dev/test/prod configs

### **Error Prevention**
1. **Pre-flight Validation**: Check all prerequisites before starting
2. **Version Synchronization**: Automated version management
3. **Rollback Planning**: Have recovery procedures ready
4. **Documentation**: Maintain comprehensive release notes

## Integration with Existing Tools

### **Package.json Scripts**
```json
{
  "scripts": {
    "deploy:release": "./.claude/skills/deployment/scripts/release-orchestrator.sh",
    "deploy:validate": "./.claude/skills/deployment/scripts/build-verification.sh",
    "deploy:rollback": "./.claude/skills/deployment/scripts/rollback-procedures.sh"
  }
}
```

### **GitHub Actions Integration**
- Optimized workflow templates
- Automated build verification
- Cross-platform deployment orchestration
- Asset upload automation

### **Git Workflow Integration**
- Branch synchronization patterns
- Tag management automation
- Submodule coordination
- Release commit management

## Usage Examples

### **Example 1: Complete Release**
**User Request**: "Deploy v0.2.0 with all platforms and documentation"

**Claude's Response**:
1. Runs pre-flight validation
2. Executes 7-step release process
3. Monitors CI/CD builds across all platforms
4. Updates Homebrew formula with new checksums
5. Generates comprehensive release notes
6. Provides download statistics and validation

### **Example 2: Emergency Fix**
**User Request**: "Windows build failed, need to redeploy"

**Claude's Response**:
1. Identifies failure root cause
2. Applies proven troubleshooting patterns
3. Re-triggers specific platform build
4. Validates asset upload success
5. Updates release documentation

### **Example 3: Environment Setup**
**User Request**: "Set up deployment environment for new developer"

**Claude's Response**:
1. Validates all prerequisites
2. Configures GitHub CLI access
3. Sets up git submodules
4. Installs Nix environment
5. Provides test deployment scenario

## Customization

### **Adapting to Your Project**
1. **Repository Configuration**: Update repository URLs and paths
2. **Platform Targets**: Customize platform-specific configurations
3. **Build Settings**: Adapt to your project's build requirements
4. **Release Process**: Modify steps to match your workflow

### **Integration with CI/CD**
1. **GitHub Actions**: Use provided workflow templates
2. **Build Environment**: Configure for your tech stack
3. **Asset Management**: Customize upload patterns
4. **Notification Systems**: Add Slack/Discord integration

## Knowledge Preservation

This skill preserves critical deployment knowledge:
- **Proven Patterns**: Battle-tested from production releases
- **Troubleshooting**: Solutions to common deployment issues
- **Best Practices**: Evolution of deployment processes
- **Performance Benchmarks**: Real-world metrics and targets
- **Recovery Procedures**: Emergency response patterns

## Future Enhancements

### **Planned Improvements**
1. **Enhanced Automation**: Fully automated 7-step process
2. **Multi-Environment Support**: Staging and production pipelines
3. **Advanced Monitoring**: Build performance and success metrics
4. **Integration Tools**: IDE and CI/CD platform plugins
5. **Community Templates**: Contributed deployment patterns

### **Scalability Features**
- Multi-project deployment support
- Enterprise-grade security and compliance
- Advanced rollback and recovery procedures
- Performance optimization for large deployments

## Support and Troubleshooting

### **Getting Help**
1. **Documentation**: Comprehensive guides and examples
2. **Validation Tools**: Built-in environment and build checking
3. **Troubleshooting**: Common issues and proven solutions
4. **Templates**: Copy-paste ready configurations

### **Contributing**
- Share deployment patterns and improvements
- Contribute troubleshooting solutions
- Update templates and documentation
- Add platform-specific optimizations

---

**This deployment skill provides production-ready deployment infrastructure with proven reliability from successful Holochain application releases.**