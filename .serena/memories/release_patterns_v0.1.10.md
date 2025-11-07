# Release Management Patterns - v0.1.10 Success

## Proven CI/CD Patterns
### Windows Asset Upload Fix
**Issue**: Windows asset uploads failing due to filename variations
**Solution**: Apply wildcard pattern following v0.1.9 success
```yaml
# Windows upload pattern (from .github/workflows/release.yaml)
find dist -name "*.exe" -exec gh release upload "v${{ steps.kangarooConfig.outputs.APP_VERSION }}" {} \;
```
**Result**: 100% Windows upload success rate in v0.1.10

### Manual Upload Strategy
**Pattern**: Manual upload strategy provides maximum reliability
- Create GitHub release first, then trigger CI/CD builds
- Use wildcard file discovery for consistent uploads
- Apply proven success patterns from previous releases

## Repository Configuration Patterns
### Kangaroo Repository Structure
**Working Repository**: `happenings-community/requests-and-offers-kangaroo-electron`
**Asset Naming**: `requests-and-offers.happenings-community.kangaroo-electron-{version}-{platform}.{ext}`
**Download URLs**: `https://github.com/happenings-community/requests-and-offers-kangaroo-electron/releases/download/v0.1.10/{filename}`

### Homebrew Formula Patterns
**Repository Reference**: happenings-community/homebrew-requests-and-offers
**URL Template**: Uses version interpolation for automatic updates
```ruby
url "https://github.com/happenings-community/requests-and-offers-kangaroo-electron/releases/download/v#{version}/requests-and-offers.happenings-community.kangaroo-electron-#{version}-arm64.dmg"
```

## Bootstrap Configuration Patterns
### Development Network Configuration
**Bootstrap Server**: `https://holostrap.elohim.host/` (CONFIRMED CORRECT)
**Signal Server**: `wss://holostrap.elohim.host/`
**Network Seed**: `alpha-test-2025`
**ICE Servers**: 
- `stun:stun.cloudflare.com:3478`
- `stun:stun.l.google.com:19302`

**Decision Point**: User confirmed Holostrap servers are correct - do not change to dev-test-bootstrap servers

## Release Documentation Patterns
### Professional Release Notes Structure
1. **Clear Title**: Include version number and release type
2. **What's New Section**: Categorized by feature/fix type
3. **Installation Section**: Platform-specific with working direct links
4. **Checksum Section**: Verified SHA256 for all assets
5. **Network Configuration**: Clear development network setup
6. **Upgrade Instructions**: Both manual and Homebrew methods
7. **Documentation Links**: Comprehensive reference section
8. **Support Links**: Issues, discussions, community resources

### Direct Download Link Pattern
**Format**: [Platform Name] (File Size): [Direct Link](URL)
**Examples**:
- **🍎 Apple Silicon (M1/M2/M3)**: [Download ARM64 DMG (152 MB)](URL)
- **🐧 Linux AppImage**: [Download AppImage (165 MB)](URL)

## Quality Assurance Patterns
### Asset Verification
1. **URL Testing**: Verify all download links are accessible
2. **Checksum Calculation**: Generate SHA256 for each platform
3. **File Size Reporting**: Display file sizes in release notes
4. **Repository Verification**: Confirm correct repository references

### Homebrew Integration Testing
1. **URL Validation**: Ensure formula URLs match actual asset locations
2. **Checksum Verification**: Validate Homebrew checksums match downloads
3. **Installation Testing**: Verify brew install commands work
4. **Upgrade Testing**: Confirm brew upgrade process functions

## Problem-Solving Patterns
### Debugging Repository URL Issues
1. **Check redirects**: Use `curl -I` to identify URL redirects
2. **Repository discovery**: Use `gh release view` to identify correct repository
3. **Asset listing**: Use `gh release view --json assets` to get exact filenames
4. **URL pattern validation**: Confirm correct repository and file naming conventions

### Bootstrap Configuration Validation
1. **User Confirmation**: Always confirm with user before changing network configuration
2. **Pattern Recognition**: Look for existing successful patterns in previous releases
3. **Network Testing**: Verify connectivity to bootstrap servers
4. **Configuration Audit**: Ensure consistency across all deployment files

## Session Management Patterns
### Progressive Task Organization
1. **Version Updates**: Main repository → Kangaroo submodule → Release creation
2. **Build Management**: Trigger builds → Monitor progress → Verify assets
3. **Documentation**: Release notes → Homebrew formula → Final verification
4. **Quality Assurance**: Download testing → Checksum verification → Link validation

### Error Recovery Patterns
1. **CI/CD Failures**: Diagnose root cause → Apply proven patterns → Rebuild if needed
2. **URL Issues**: Test redirects → Verify repositories → Update configurations
3. **Documentation Problems**: Gather user feedback → Apply consistent formatting → Re-publish
4. **Checksum Mismatches**: Recalculate from working assets → Update formulas → Re-verify

## Success Metrics
### Release Quality Indicators
- **Platform Coverage**: 100% (5/5 platforms)
- **Asset Accessibility**: 100% working download links  
- **Documentation Quality**: Professional with clear instructions
- **Homebrew Integration**: Fully functional with verified checksums
- **Bootstrap Configuration**: Correct development network setup

### Time Efficiency Patterns
- **Parallel Operations**: Download testing across platforms simultaneously
- **Asset Verification**: Batch checksum calculations for efficiency
- **Documentation Updates**: Apply consistent formatting templates
- **Repository Operations**: Batch git commits and pushes for coordinated updates