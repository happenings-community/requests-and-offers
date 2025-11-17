---
name: Release Notes Template
description: Comprehensive release notes template for Requests and Offers hApp releases
category: deployment
---

# Release Notes Template

This template provides a standardized structure for creating professional release notes for the Requests and Offers hApp.

## Template Structure

Tile : 🚀 Requests and Offers v{VERSION}

```markdown

[Short, compelling description of the release theme and main value proposition]

## 📱 Desktop Applications

### macOS
- **Homebrew Installation (Easiest)**:
  ```bash
  # Add the tap
  brew tap happenings-community/homebrew-requests-and-offers

  # Install the application
  brew install --cask requests-and-offers

  # Upgrade existing installation
  brew upgrade --cask requests-and-offers
  ```
- **Apple Silicon**: [Download .dmg](https://github.com/happenings-community/requests-and-offers-kangaroo-electron/releases/download/v{VERSION}/requests-and-offers.happenings-community.kangaroo-electron-{VERSION}-arm64.dmg)
- **Intel**: [Download .dmg](https://github.com/happenings-community/requests-and/offers-kangaroo-electron/releases/download/v{VERSION}/requests-and-offers.happenings-community.kangaroo-electron-{VERSION}-x64.dmg)

### Windows
- [Download Setup .exe](https://github.com/happenings-community/requests-and-offers-kangaroo-electron/releases/download/v{VERSION}/requests-and-offers.happenings-community.kangaroo-electron-{VERSION}-setup.exe)

### Linux
- **Debian/Ubuntu**: [Download .deb](https://github.com/happenings-community/requests-and-offers-kangaroo-electron/releases/download/v{VERSION}/requests-and-offers.happenings-community.kangaroo-electron_{VERSION}_amd64.deb)
- **Universal Portable**: [Download AppImage](https://github.com/happenings-community/requests-and-offers-kangaroo-electron/releases/download/v{VERSION}/requests-and-offers.happenings-community.kangaroo-electron-{VERSION}.AppImage)

## 🎯 Installation Instructions

### Desktop Applications
1. Download the appropriate installer for your platform from the links above
2. Run the installer and follow the setup wizard
3. The application will automatically configure the production network settings

### WebApp (Alternative)
1. Download the webhapp file below
2. Use with Holochain launcher or compatible browser
3. [WebHapp Download](https://github.com/happenings-community/requests-and-offers/releases/download/v{VERSION}/requests_and_offers.webhapp)

## ✨ What's New

### 🚀 New Features
- **[Feature Name]**: [Brief description of feature and user benefit] (`commit-hash`)
- **[Feature Name]**: [Brief description of feature and user benefit] (`commit-hash`)
- **[Feature Name]**: [Brief description of feature and user benefit] (`commit-hash`)

### 🐛 Bug Fixes & Improvements
- **[Fix Category]**: [Brief description of problem and solution] (`commit-hash`)
- **[Fix Category]**: [Brief description of problem and solution] (`commit-hash`)
- **[Fix Category]**: [Brief description of problem and solution] (`commit-hash`)

### ⚙️ Architecture & Performance
- **[Improvement Category]**: [Brief description of improvement and impact] (`commit-hash`)
- **[Improvement Category]**: [Brief description of improvement and impact] (`commit-hash`)

## 🔧 Technical Specifications

- **Network**: Holostrap alpha network (holostrap.elohim.host)
- **Holochain Version**: 0.5.5
- **UI Framework**: SvelteKit + Svelte 5 Runes
- **Architecture**: 7-Layer Effect-TS
- **Network Seed**: alpha-test-2025
- **Version**: {VERSION}

## 📋 Complete Changes

[Comprehensive list of all changes since last release, organized by category with commit hashes]

## 🔧 Development Resources

- **Main Repository**: https://github.com/happenings-community/requests-and-offers
- **Desktop App Repository**: https://github.com/happenings-community/requests-and-offers-kangaroo-electron
- **Documentation**: https://github.com/happenings-community/requests-and-offers/tree/main/documentation
- **Installation Guide**: https://github.com/happenings-community/requests-and-offers/blob/main/documentation/guides/getting-started.md

## 🌐 Network Information

- **Bootstrap URL**: https://holostrap.elohim.host/
- **Signal URL**: wss://holostrap.elohim.host/
- **Network Seed**: alpha-test-2025
- **Network Type**: Holostrap Alpha Test Network

## 🚀 Getting Started

1. **Choose Your Installation Method**: Download desktop app or webhapp
2. **Install & Launch**: Follow platform-specific installation instructions
3. **Network Setup**: The app automatically connects to the Holostrap alpha network
4. **Create Profile**: Set up your user profile to start making requests and offers
5. **Explore Features**: Browse existing requests/offers or create your own

### For Developers
- See `./documentation/` for development setup and API documentation
- Join our development community for questions and contributions
- Check out the source code on GitHub for technical details

---

*This release follows the established patterns from the Requests and Offers project's release management system. For detailed technical changes, see the [CHANGELOG.md](https://github.com/happenings-community/requests-and-offers/blob/main/CHANGELOG.md) file.*
```

## Usage Instructions

### Template Variables

Replace these placeholders in the template:

- `{VERSION}`: Version number (e.g., "0.2.0")
- `[Release Theme]`: Main focus of the release (e.g., "UI/UX Enhancement")
- `[Feature Name]`: Feature descriptions from CHANGELOG.md
- `[Fix Category]`: Bug fix categories with user benefits
- `[Improvement Category]`: Architecture/performance improvements
- `commit-hash`: 7-character commit hashes from git history

### Download Link Patterns

**Standard URLs** (use exact format):
```bash
# macOS ARM64
https://github.com/happenings-community/requests-and-offers-kangaroo-electron/releases/download/v{VERSION}/requests-and-offers.happenings-community.kangaroo-electron-{VERSION}-arm64.dmg

# macOS Intel
https://github.com/happenings-community/requests-and-offers-kangaroo-electron/releases/download/v{VERSION}/requests-and-offers.happenings-community.kangaroo-electron-{VERSION}-x64.dmg

# Windows Setup
https://github.com/happenings-community/requests-and-offers-kangaroo-electron/releases/download/v{VERSION}/requests-and-offers.happenings-community.kangaroo-electron-{VERSION}-setup.exe

# Linux DEB
https://github.com/happenings-community/requests-and-offers-kangaroo-electron/releases/download/v{VERSION}/requests-and-offers.happenings-community.kangaroo-electron_{VERSION}_amd64.deb

# Linux AppImage
https://github.com/happenings-community/requests-and-offers-kangaroo-electron/releases/download/v{VERSION}/requests-and-offers.happenings-community.kangaroo-electron-{VERSION}.AppImage
```

### Content Sources

Extract information from these sources:

1. **CHANGELOG.md**: Main source of features, fixes, and improvements
2. **Git History**: Commit messages and hashes for traceability
3. **Previous Releases**: Maintain consistent formatting and structure
4. **Documentation**: Technical specifications and getting started guides

## Integration with Deployment Process

This template integrates with the RELEASE_CHECKLIST.md at these steps:

- **Step 7**: Release Notes Finalization - Use template for consistent formatting
- **Link Verification**: Test all download links before finalizing release
- **Cross-Repository Coordination**: Ensure main and kangaroo repositories reference each other

## Quality Checklist

Before finalizing release notes:

- [ ] All significant commits since last version are included
- [ ] Changes categorized correctly (Features, Bug Fixes, Architecture)
- [ ] Download links follow expected URL patterns
- [ ] Technical specifications are accurate and current
- [ ] Installation instructions are clear and actionable
- [ ] Related links are working and relevant
- [ ] Grammar and spelling are correct
- [ ] Release theme is compelling and user-focused

## Examples

### Minor Release Example
```markdown
# 🚀 Requests and Offers v0.2.0

Enhanced user experience with improved UI responsiveness and new administrative capabilities.

### 🚀 New Features
- **Connection Status Display**: Enhanced connection status with interactive popup for better user feedback (`9224cb1`)
- **Modal Layering System**: Improved UI modal layering and reorganized user components (`66957b1`)
```

### Patch Release Example
```markdown
# 🚀 Requests and Offers v0.1.11

Critical bug fixes and stability improvements for reliable operation.

### 🐛 Bug Fixes & Improvements
- **ActionBar Reactivity**: Resolved ActionBar reactivity issues with event-driven status updates (`03ecd28`)
- **User Profile Updates**: Fixed user profile update deserialization error (`a0f601c`)
```

---

This template ensures consistent, professional release notes that serve both technical and user audiences while maintaining comprehensive traceability and automation.
