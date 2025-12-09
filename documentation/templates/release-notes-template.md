# 🚀 Requests and Offers v{VERSION}

{RELEASE_SUMMARY}

## 📱 Desktop Applications

### macOS
- **Homebrew Installation (Easiest)**
- **🍎 Apple Silicon (M1/M2/M3)**: [Download .dmg ({MAC_ARM_SIZE} MB)]({MAC_ARM_URL})
- **🖥️ Intel**: [Download .dmg ({MAC_INTEL_SIZE} MB)]({MAC_INTEL_URL})

### Windows
- **🪟 Windows x64**: [Download Setup .exe ({WINDOWS_SIZE} MB)]({WINDOWS_URL})

### Linux
- **🐧 Debian/Ubuntu**: [Download .deb ({LINUX_DEB_SIZE} MB)]({LINUX_DEB_URL})
- **🐧 Universal Portable**: [Download AppImage ({LINUX_APPIMAGE_SIZE} MB)]({LINUX_APPIMAGE_URL})

## 🎯 Installation Instructions

### Desktop Applications
1. Download the appropriate installer for your platform from the links above
2. Run the installer and follow the setup wizard
3. The application will automatically configure the production network settings

#### macOS Installation Details
1. **DMG Installation**:
   - Download the .dmg file for your Mac architecture (Apple Silicon or Intel)
   - Double-click the downloaded file to mount the disk image
   - Drag "Requests and Offers.app" to your Applications folder
   - Launch from Applications or Launchpad

2. **Homebrew Installation**:
   ```bash
   # Add our tap (if not already added)
   brew tap happenings-community/homebrew-requests-and-offers

   # Install the application
   brew install --cask requests-and-offers

   # Launch the application
   open "Requests and Offers"
   ```

#### Windows Installation Details
1. Download the Setup .exe file
2. Right-click the downloaded file and select "Run as administrator"
3. Follow the installation wizard prompts
4. Choose installation location (default recommended)
5. Select "Create desktop shortcut" for easy access
6. Launch from Start Menu or desktop shortcut

#### Linux Installation Details

**Debian/Ubuntu (.deb package)**:
```bash
# Download the .deb package
wget {LINUX_DEB_URL}

# Install the package
sudo dpkg -i requests-and-offers.happenings-community.kangaroo-electron_{VERSION}_amd64.deb

# Install dependencies if needed
sudo apt-get install -f

# Launch the application
requests-and-offers
```

**AppImage (Universal Portable)**:
```bash
# Download the AppImage
wget {LINUX_APPIMAGE_URL}

# Make it executable
chmod +x requests-and-offers.happenings-community.kangaroo-electron-{VERSION}.AppImage

# Run the application
./requests-and-offers.happenings-community.kangaroo-electron-{VERSION}.AppImage
```

### WebApp (Alternative)
1. Download the webhapp file below
2. Use with Holochain launcher or compatible browser
3. [WebHapp Download ({WEBHAPP_SIZE} MB)]({WEBHAPP_URL})

#### WebApp Installation Details
1. **Holochain Launcher Method**:
   - Install the [Holochain Launcher](https://github.com/holochain/holochain-launcher)
   - Download the webhapp file ({WEBHAPP_SIZE} MB)
   - Open the launcher and drag the webhapp file into it
   - Launch from the launcher interface

2. **Browser Method (Advanced Users)**:
   - Use a browser that supports WebHapp files
   - Open the downloaded .webhapp file directly
   - Ensure proper Holochain browser extension is installed

## 🚀 First-Time Setup

### After Installation
1. **Launch the Application**: Start "Requests and Offers" from your applications menu
2. **Network Connection**: The app automatically connects to the production Holostrap network
3. **Create Your Profile**:
   - Click on "Create Profile"
   - Enter your desired username
   - Add an optional profile picture
   - Set your location (optional but recommended)
4. **Profile Verification**: Wait for profile creation to complete on the network
5. **Explore the Interface**: Browse existing requests and offers or create your first entry

### Troubleshooting Installation Issues

**macOS Issues**:
- **"Cannot verify developer"**: Right-click app → Open → Confirm "Open anyway"
- **"App is damaged"**: Run `xattr -cr "/Applications/Requests and Offers.app"` in Terminal

**Windows Issues**:
- **"Windows Defender blocked": Click "More info" → "Run anyway"**
- **"Missing DLLs": Install Microsoft Visual C++ Redistributable

**Linux Issues**:
- **"Permission denied": Run `chmod +x` on AppImage before executing**
- **"Missing dependencies": Install required libraries with your package manager**

## ✨ What's New

{FEATURES_SECTION}

### 🔧 Build Infrastructure
{BUILD_INFRA_SECTION}

### 🎨 UI/UX Improvements
{UI_UX_SECTION}

### ⚙️ Architecture & Performance
{ARCHITECTURE_SECTION}

## 🔧 Technical Specifications

- **Network**: Production-grade bootstrap.holo.host infrastructure
- **Holochain Version**: {HOLOCHAIN_VERSION}
- **UI Framework**: SvelteKit + Svelte 5 Runes
- **Architecture**: 7-Layer Effect-TS
- **Network Seed**: alpha-test-2025
- **Version**: {VERSION}

## 🌐 Network Information

- **Bootstrap URL**: https://bootstrap.holo.host/
- **Signal URL**: wss://signal.holo.host/
- **Network Seed**: Requests and Offers-{SERIES_VERSION}
- **Network Type**: Production-grade Holostrap Network

## 🚀 Getting Started

1. **Choose Your Installation Method**: Download desktop app (recommended) or webhapp
2. **Install & Launch**: Follow platform-specific installation instructions
3. **Network Setup**: The app automatically connects to the production bootstrap network
4. **Create Profile**: Set up your user profile to start making requests and offers
5. **Explore Features**: Browse existing requests/offers or create your own

### For Developers
- See `./documentation/` for development setup and API documentation
- Join our development community for questions and contributions
- Check out the source code on GitHub for technical details

## 🔧 Development Resources

- **Main Repository**: https://github.com/happenings-community/requests-and-offers
- **Desktop App Repository**: https://github.com/happenings-community/requests-and-offers-kangaroo-electron
- **Documentation**: https://github.com/happenings-community/requests-and-offers/tree/main/documentation
- **Installation Guide**: https://github.com/happenings-community/requests-and-offers/blob/main/documentation/guides/getting-started.md

---

{KNOWN_ISSUES_NOTE}

*This release follows the established patterns from the Requests and Offers project's release management system. For detailed technical changes, see the [CHANGELOG.md](https://github.com/happenings-community/requests-and-offers/blob/main/CHANGELOG.md) file.*

---
## Template Variables

Replace these placeholders when using this template:

- `{VERSION}` - Semantic version number (e.g., "0.2.2")
- `{RELEASE_SUMMARY}` - Brief one-sentence description of the release
- `{MAC_ARM_SIZE}` - File size in MB for macOS ARM64 DMG
- `{MAC_ARM_URL}` - Download URL for macOS ARM64 DMG
- `{MAC_INTEL_SIZE}` - File size in MB for macOS Intel DMG
- `{MAC_INTEL_URL}` - Download URL for macOS Intel DMG
- `{WINDOWS_SIZE}` - File size in MB for Windows EXE
- `{WINDOWS_URL}` - Download URL for Windows EXE
- `{LINUX_DEB_SIZE}` - File size in MB for Linux DEB
- `{LINUX_DEB_URL}` - Download URL for Linux DEB
- `{LINUX_APPIMAGE_SIZE}` - File size in MB for Linux AppImage
- `{LINUX_APPIMAGE_URL}` - Download URL for Linux AppImage
- `{WEBHAPP_SIZE}` - File size in MB for WebHapp
- `{WEBHAPP_URL}` - Download URL for WebHapp
- `{HOLOCHAIN_VERSION}` - Holochain framework version (e.g., "0.6.0")
- `{SERIES_VERSION}` - Series version for network seed (e.g., "0.2.x")
- `{FEATURES_SECTION}` - Detailed new features section
- `{BUILD_INFRA_SECTION}` - Build infrastructure improvements
- `{UI_UX_SECTION}` - UI/UX improvements
- `{ARCHITECTURE_SECTION}` - Architecture and performance changes
- `{KNOWN_ISSUES_NOTE}` - Known issues disclaimer (optional)

## Section Templates

### Features Section Template:
```markdown
### 🚀 Major Features
- **Feature Name**: Brief description of the feature
- **Another Feature**: Description with technical details
- **Third Feature**: Description highlighting user benefits
```

### Build Infrastructure Template:
```markdown
### 🔧 Build Infrastructure
- **CI/CD Improvements**: Description of build pipeline enhancements
- **Tooling Updates**: Updated build tools and processes
- **Deployment**: Enhanced deployment automation
```

### UI/UX Improvements Template:
```markdown
### 🎨 UI/UX Improvements
- **Component Updates**: Description of UI component improvements
- **User Experience**: Enhanced user flow and interactions
- **Performance**: Frontend performance optimizations
```

### Architecture Section Template:
```markdown
### ⚙️ Architecture & Performance
- **Backend Architecture**: Changes to system architecture
- **Database**: Database schema or performance improvements
- **API Updates**: API enhancements or changes
```

### Known Issues Template:
```markdown
⚠️ **Known Quality Issues**: This release acknowledges existing quality issues. Core functionality has been verified and is stable.
```

OR

```markdown
✅ **High Quality Release**: All tests passing, no known issues detected.
```
