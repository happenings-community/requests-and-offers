# Platform-Specific Configuration Examples

> **Production-ready configuration examples for different deployment scenarios**

This guide provides complete configuration examples for various deployment scenarios, including development, staging, and production environments.

## 🏗️ Architecture Overview

### **Multi-Repository Structure**
```
Main Repository (requests-and-offers)
├── WebHapp build and packaging
├── Release coordination
├── Version management
└── Submodule links

Kangaroo Submodule (deployment/kangaroo-electron)
├── Desktop app builds (Windows/macOS/Linux)
├── GitHub Actions CI/CD
├── Code signing configuration
└── Platform-specific builds

Homebrew Repository (deployment/homebrew)
├── macOS formula management
├── Checksum updates
└── Distribution configuration
```

## 🍎 macOS Configuration Examples

### **Development Environment Setup**

#### **Kangaroo Configuration (Development)**
```typescript
// deployment/kangaroo-electron/kangaroo.config.ts
import { defineConfig } from './src/main/defineConfig';

export default defineConfig({
  appId: 'requests-and-offers.happenings-community.kangaroo-electron',
  productName: 'Requests and Offers',
  version: '0.1.9-dev',

  // Development signing settings
  macOSCodeSigning: false,
  windowsEVCodeSigning: false,

  // Development features
  fallbackToIndexHtml: true,
  autoUpdates: false,  // Disabled in development
  systray: true,
  passwordMode: 'password-optional',

  // Development network
  networkSeed: 'development-seed-2025',
  bootstrapUrl: 'ws://localhost:8888',
  signalUrl: 'ws://localhost:9000',

  // Development ICE servers
  iceUrls: [
    'stun:stun.cloudflare.com:3478',
    'stun:stun.l.google.com:19302',
    'stun:stun.l.google.com:19302?transport=udp'
  ],

  // Development binaries (latest)
  bins: {
    holochain: {
      version: '0.5.5',
      sha256: {
        'x86_64-apple-darwin': '430bc76fa9561461cf038f9ce4939171712ba02ce6eefc4a0aa43ac3496e498c',
        'aarch64-apple-darwin': 'c7535f3ce81cb6a72397d5942da6bb4a16d9eb9afc78af7ce0b861ca237d51f7',
      },
    },
    lair: {
      version: '0.6.2',
      sha256: {
        'x86_64-apple-darwin': '746403e5d1655ecf14d95bccaeef11ad1abfc923e428c2f3d87c683edb6fdcdc',
        'aarch64-apple-darwin': '05c7270749bb1a5cf61b0eb344a7d7a562da34090d5ea81b4c5b6cf040dd32e8',
      },
    },
  },
});
```

#### **GitHub Actions Workflow (Development)**
```yaml
# .github/workflows/build-macos-dev.yml
name: 'macOS Development Build'

on:
  push:
    branches: [develop]
  pull_request:
    branches: [develop]

jobs:
  build-macos:
    strategy:
      matrix:
        platform: [macos-13, macos-latest]

    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'yarn'

      - name: Install dependencies
        run: |
          corepack enable
          yarn install --frozen-lockfile

      - name: Read kangaroo config
        id: kangarooConfig
        run: |
          echo "APP_VERSION=$(node -p -e "require('./package.json').version")" >> $GITHUB_OUTPUT
          echo "MACOS_CODE_SIGNING=false" >> $GITHUB_OUTPUT

      - name: Check webhapp
        run: |
          if ! ls ./pouch/*.webhapp 1>/dev/null 2>&1; then
            echo "Error: No .webhapp file found"
            exit 1
          fi

      # macOS ARM64 build (no signing)
      - name: Build macOS ARM64
        if: matrix.platform == 'macos-latest'
        run: |
          yarn build:mac-arm64
          ls dist
          echo "Development build completed for ARM64"

      # macOS x64 build (no signing)
      - name: Build macOS x64
        if: matrix.platform == 'macos-13'
        run: |
          yarn build:mac-x64
          ls dist
          echo "Development build completed for x64"

      - name: Upload development artifacts
    if: github.ref == 'refs/heads/develop'
    uses: actions/upload-artifact@v3
    with:
      name: macos-dev-${{ matrix.platform }}
      path: dist/
      retention-days: 7
```

### **Production Environment Setup**

#### **Kangaroo Configuration (Production)**
```typescript
// deployment/kangaroo-electron/kangaroo.config.ts
import { defineConfig } from './src/main/defineConfig';

export default defineConfig({
  appId: 'requests-and-offers.happenings-community.kangaroo-electron',
  productName: 'Requests and Offers',
  version: '0.1.9',

  // Production signing settings
  macOSCodeSigning: true,  // Enabled for production
  windowsEVCodeSigning: true,  // Enabled for production

  // Production features
  fallbackToIndexHtml: true,
  autoUpdates: true,  // Enabled in production
  systray: true,
  passwordMode: 'password-optional',

  // Production network
  networkSeed: 'alpha-test-2025',
  bootstrapUrl: 'https://holostrap.elohim.host/',
  signalUrl: 'wss://holostrap.elohim.host/',

  // Production ICE servers
  iceUrls: [
    'stun:stun.cloudflare.com:3478',
    'stun:stun.l.google.com:19302'
  ],

  // Production binaries (verified checksums)
  bins: {
    holochain: {
      version: '0.5.5',
      sha256: {
        'x86_64-apple-darwin': '430bc76fa9561461cf038f9ce4939171712ba02ce6eefc4a0aa43ac3496e498c',
        'aarch64-apple-darwin': 'c7535f3ce81cb6a72397d5942da6bb4a16d9eb9afc78af7ce0b861ca237d51f7',
      },
    },
    lair: {
      version: '0.6.2',
      sha256: {
        'x86_64-apple-darwin': '746403e5d1655ecf14d95bccaeef11ad1abfc923e428c2f3d87c683edb6fdcdc',
        'aarch64-apple-darwin': '05c7270749bb1a5cf61b0eb344a7d7a562da34090d5ea81b4c5b6cf040dd32e8',
      },
    },
  },
});
```

#### **GitHub Actions Workflow (Production)**
```yaml
# .github/workflows/release.yaml
name: 'publish'

on:
  push:
    branches:
      - release

jobs:
  publish:
    strategy:
      fail-fast: false
      matrix:
        platform: [macos-13, macos-latest]

    permissions:
      contents: write

    runs-on: ${{ matrix.platform }}
    env:
      MACOSX_DEPLOYMENT_TARGET: 10.13

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'yarn'

      - name: Install dependencies
        run: |
          corepack enable
          yarn install --frozen-lockfile

      - name: Read kangaroo config
        id: kangarooConfig
        run: |
          echo "APP_VERSION=$(node -p -e "require('./package.json').version")" >> $GITHUB_OUTPUT
          echo "MACOS_CODE_SIGNING=$(node ./scripts/read-macos-code-signing.js)" >> $GITHUB_OUTPUT

      - name: Check webhapp
        run: |
          if ! ls ./pouch/*.webhapp 1>/dev/null 2>&1; then
            echo "Error: No .webhapp file found"
            exit 1
          fi

      # macOS code signing setup
      - name: Setup macOS code signing
        if: steps.kangarooConfig.outputs.MACOS_CODE_SIGNING == 'true'
        uses: matthme/import-codesign-certs@5565bb656f60c98c8fc515f3444dd8db73545dc2
        with:
          p12-file-base64: ${{ secrets.APPLE_CERTIFICATE }}
          p12-password: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}

      # macOS ARM64 with code signing
      - name: Build and upload (macOS ARM64)
        if: matrix.platform == 'macos-latest' && steps.kangarooConfig.outputs.MACOS_CODE_SIGNING == 'true'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          APPLE_DEV_IDENTITY: ${{ secrets.APPLE_DEV_IDENTITY }}
          APPLE_ID_EMAIL: ${{ secrets.APPLE_ID_EMAIL }}
          APPLE_ID_PASSWORD: ${{ secrets.APPLE_ID_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
        run: |
          yarn build:mac-arm64
          ls dist
          # Use wildcard to handle filename variations
          find dist -name "*.dmg" -exec gh release upload "v${{ steps.kangarooConfig.outputs.APP_VERSION }}" {} \;

      # macOS ARM64 without code signing
      - name: Build and upload (macOS ARM64)
        if: matrix.platform == 'macos-latest' && steps.kangarooConfig.outputs.MACOS_CODE_SIGNING == 'false'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          yarn build:mac-arm64
          ls dist
          find dist -name "*.dmg" -exec gh release upload "v${{ steps.kangarooConfig.outputs.APP_VERSION }}" {} \;

      # Similar patterns for macOS x64...

      - name: Validate asset upload
        if: always()
        run: |
          asset_count=$(gh release view "v${{ steps.kangarooConfig.outputs.APP_VERSION }}" --json assets | jq '.assets | length')
          echo "Total assets: $asset_count"

          # Check for macOS assets
          if [[ "$asset_count" -ge 5 ]]; then
            echo "✅ Expected number of assets found"
          else
            echo "⚠️ Expected more assets, checking individual platforms..."
          fi
```

#### **Code Signing Configuration**
```bash
# scripts/setup-macos-codesigning.sh

#!/bin/bash

echo "Setting up macOS code signing..."

# Check for required certificates
if security find-identity -v -p codesigning | grep -q "Apple Distribution"; then
  echo "✅ Apple Distribution certificate found"
else
  echo "❌ Apple Distribution certificate not found"
  echo "Please install your Apple Developer certificate"
  exit 1
fi

# Verify certificate details
CERT_INFO=$(security find-identity -v -p codesigning | grep "Apple Distribution")
echo "Certificate Info: $CERT_INFO"

# Check for Developer ID application certificate
if security find-identity -v -p codesigning | grep -q "Developer ID Application"; then
  echo "✅ Developer ID Application certificate found"
else
  echo "❌ Developer ID Application certificate not found"
  exit 1
fi

echo "✅ macOS code signing setup complete"
```

## 🪟 Windows Configuration Examples

### **Development Environment Setup**

#### **Package.json Scripts (Windows Development)**
```json
{
  "scripts": {
    "build:win": "electron-builder --win",
    "build:win-dev": "electron-builder --win --config.nsis.oneClick=false",
    "dist:win": "electron-builder --win --publish=never",
    "test:win": "electron-builder --win --config.directories.output=dist-test"
  }
}
```

#### **Electron Builder Configuration (Development)**
```javascript
// electron-builder.json (Development)
{
  "build": {
    "appId": "requests-and-offers.happenings-community.kangaroo-electron",
    "productName": "Requests and Offers",
    "directories": {
      "output": "dist",
      "buildResources": "build"
    },
    "files": [
      "src/**/*",
      "pouch/**/*",
      "node_modules/**/*"
    ],
    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": ["x64"]
        }
      ],
      "publisherName": "Happenings Community",
      "verifyUpdateCodeSignature": false
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "installerIcon": "build/icon.ico",
      "uninstallerIcon": "build/icon.ico",
      "installerHeaderIcon": "build/icon.ico",
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true
    },
    "publish": {
      "provider": "github",
      "owner": "happenings-community",
      "repo": "kangaroo-electron"
    }
  }
}
```

### **Production Environment Setup**

#### **Electron Builder Configuration (Production)**
```javascript
// electron-builder.json (Production)
{
  "build": {
    "appId": "requests-and-offers.happenings-community.kangaroo-electron",
    "productName": "Requests and Offers",
    "directories": {
      "output": "dist",
      "buildResources": "build"
    },
    "files": [
      "src/**/*",
      "pouch/**/*",
      "node_modules/**/*"
    ],
    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": ["x64"]
        }
      ],
      "publisherName": "Happenings Community",
      "publisherUrl": "https://github.com/happenings-community",
      "verifyUpdateCodeSignature": true
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "installerIcon": "build/icon.ico",
      "uninstallerIcon": "build/icon.ico",
      "installerHeaderIcon": "build/icon.ico",
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "perMachine": false,
      "artifactName": "${productName}-${version}-${arch}.${ext}"
    },
    "publish": {
      "provider": "github",
      "owner": "happenings-community",
      "repo": "kangaroo-electron"
    }
  }
}
```

#### **GitHub Actions Workflow (Windows Production)**
```yaml
# Windows build job in release.yaml
- name: build and upload the app (Windows)
  if: matrix.platform == 'windows-2022'
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: |
    yarn build:win
    ls dist
    # Use wildcard to handle filename variations
    find dist -name "*.exe" -exec gh release upload "v${{ steps.kangarooConfig.outputs.APP_VERSION }}" {} \;
```

## 🐧 Linux Configuration Examples

### **Development Environment Setup**

#### **Build Scripts (Development)**
```bash
#!/bin/bash
# scripts/build-linux-dev.sh

echo "Building Linux development version..."

# Set environment
export VITE_APP_ENV=development
export VITE_DEV_FEATURES_ENABLED=true

# Install system dependencies
sudo apt-get update
sudo apt-get install -y libgtk-3-dev libnotify-dev libnss3-dev libxss1-dev libxtst6-dev xdg-utils libatspi2.0-0 libdrm2 libxcomposite-dev libxdamage-dev libxrandr2-dev libgbm-dev libxkbcommon-dev libasound2-dev

# Build application
yarn build:linux

echo "Linux development build completed"
ls dist/
```

#### **AppImage Configuration**
```javascript
// electron-builder.json (Linux Development)
{
  "build": {
    "linux": {
      "target": [
        {
          "target": "AppImage",
          "arch": ["x64"]
        },
        {
          "target": "deb",
          "arch": ["x64"]
        }
      ],
      "category": "Network",
      "desktop": {
        "Name": "Requests and Offers",
        "Comment": "Peer-to-peer requests and offers platform",
        "Keywords": "holochain;requests;offers;networking;"
      }
    },
    "deb": {
      "depends": [
        "libgtk-3-0",
        "libnotify4",
        "libnss3",
        "libxss1",
        "libxtst6",
        "xdg-utils",
        "libatspi2.0-0",
        "libdrm2",
        "libxcomposite1",
        "libxdamage1",
        "libxrandr2",
        "libgbm1",
        "libxkbcommon0",
        "libasound2"
      ]
    }
  }
}
```

### **Production Environment Setup**

#### **Build Scripts (Production)**
```bash
#!/bin/bash
# scripts/build-linux-prod.sh

echo "Building Linux production version..."

# Clean previous builds
rm -rf dist/

# Set production environment
export VITE_APP_ENV=production
export VITE_DEV_FEATURES_ENABLED=false
export VITE_MOCK_BUTTONS_ENABLED=false

# Build with production optimizations
yarn build:linux

# Verify build artifacts
echo "Build artifacts:"
find dist -type f -exec ls -lh {} \;

# Calculate checksums
echo "Checksums:"
cd dist
sha256sum * > checksums.txt
cat checksums.txt

echo "Linux production build completed"
```

#### **GitHub Actions Workflow (Linux Production)**
```yaml
# Linux build job in release.yaml
- name: build and upload the app (Linux)
  if: matrix.platform == 'ubuntu-22.04'
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: |
    yarn build:linux
    ls dist
    # Upload DEB package
    find dist -name "*.deb" -exec gh release upload "v${{ steps.kangarooConfig.outputs.APP_VERSION }}" {} \;
    # Upload AppImage
    find dist -name "*.AppImage" -exec gh release upload "v${{ steps.kangarooConfig.outputs.APP_VERSION }}" {} \;
```

## 📱 Mobile Configuration Examples

### **Android Setup (Future Enhancement)**
```typescript
// Future Android configuration
export default defineConfig({
  appId: 'requests-and-offers.happenings-community.kangaroo-mobile',
  productName: 'Requests and Offers Mobile',
  version: '0.1.9',

  // Mobile-specific settings
  mobile: {
    platform: 'android',
    packageType: 'apk',
    signingConfig: 'release'
  },

  // Android network configuration
  networkSeed: 'alpha-test-2025',
  bootstrapUrl: 'https://holostrap.elohim.host/',
  signalUrl: 'wss://holostrap.elohim.host/',
});
```

### **iOS Setup (Future Enhancement)**
```typescript
// Future iOS configuration
export default defineConfig({
  appId: 'com.happenings-community.requests-and-offers',
  productName: 'Requests and Offers',
  version: '0.1.9',

  // iOS-specific settings
  ios: {
    bundleId: 'com.happenings-community.requests-and-offers',
    teamId: 'YOUR_TEAM_ID',
    provisioningProfile: 'path/to/profile.mobileprovision'
  },

  // iOS network configuration
  networkSeed: 'alpha-test-2025',
  bootstrapUrl: 'https://holostrap.elohim.host/',
  signalUrl: 'wss://holostrap.elohim.host/',
});
```

## 🔧 Environment-Specific Configurations

### **Development Environment Variables**
```bash
# .env.development
VITE_APP_ENV=development
VITE_DEV_FEATURES_ENABLED=true
VITE_MOCK_BUTTONS_ENABLED=true
VITE_LOG_LEVEL=debug
VITE_HOT_RELOAD=true

# Network settings for development
VITE_BOOTSTRAP_URL=ws://localhost:8888
VITE_SIGNAL_URL=ws://localhost:9000
VITE_NETWORK_SEED=development-seed-2025
```

### **Test Environment Variables**
```bash
# .env.test
VITE_APP_ENV=test
VITE_DEV_FEATURES_ENABLED=false
VITE_MOCK_BUTTONS_ENABLED=false
VITE_LOG_LEVEL=info
VITE_HOT_RELOAD=false

# Production network settings for testing
VITE_BOOTSTRAP_URL=https://holostrap.elohim.host/
VITE_SIGNAL_URL=wss://holostrap.elohim.host/
VITE_NETWORK_SEED=alpha-test-2025
```

### **Production Environment Variables**
```bash
# .env.production
VITE_APP_ENV=production
VITE_DEV_FEATURES_ENABLED=false
VITE_MOCK_BUTTONS_ENABLED=false
VITE_LOG_LEVEL=error
VITE_HOT_RELOAD=false

# Production network settings
VITE_BOOTSTRAP_URL=https://holostrap.elohim.host/
VITE_SIGNAL_URL=wss://holostrap.elohim.host/
VITE_NETWORK_SEED=alpha-test-2025
```

## 🚀 Deployment Automation Examples

### **Multi-Platform Deployment Script**
```bash
#!/bin/bash
# scripts/deploy-multi-platform.sh

VERSION=${1:-"$(node -p -e "require('./package.json').version")"}
PLATFORMS=${2:-"macos-arm64,macos-x64,windows-x64,linux-deb,linux-appimage"}

echo "Deploying version $VERSION to platforms: $PLATFORMS"

# Read kangaroo config
APP_VERSION=$(node -p -e "require('./package.json').version")

# Build and upload for each platform
IFS=',' read -ra PLATFORM_ARRAY <<< "$PLATFORMS"
for platform in "${PLATFORM_ARRAY[@]}"; do
  platform=$(echo "$platform" | xargs)  # Trim whitespace

  echo "Building for platform: $platform"

  case "$platform" in
    "macos-arm64")
      yarn build:mac-arm64
      find dist -name "*.dmg" -exec gh release upload "v$APP_VERSION" {} \;
      ;;
    "macos-x64")
      yarn build:mac-x64
      find dist -name "*.dmg" -exec gh release upload "v$APP_VERSION" {} \;
      ;;
    "windows-x64")
      yarn build:win
      find dist -name "*.exe" -exec gh release upload "v$APP_VERSION" {} \;
      ;;
    "linux-deb")
      yarn build:linux
      find dist -name "*.deb" -exec gh release upload "v$APP_VERSION" {} \;
      ;;
    "linux-appimage")
      yarn build:linux
      find dist -name "*.AppImage" -exec gh release upload "v$APP_VERSION" {} \;
      ;;
    *)
      echo "Unknown platform: $platform"
      ;;
  esac

  echo "✅ Platform $platform deployment completed"
done

echo "🎉 Multi-platform deployment completed for version $VERSION"
```

### **Rollback Automation Script**
```bash
#!/bin/bash
# scripts/rollback-deployment.sh

FROM_VERSION=${1:-""}
TO_VERSION=${2:-"$(git tag --sort=-version:refname | grep "^v[0-9]" | sed -n '2p' | cut -c2-)"}

echo "Rolling back from v$FROM_VERSION to v$TO_VERSION"

# Delete problematic release
gh release delete "v$FROM_VERSION" --yes 2>/dev/null || echo "Release v$FROM_VERSION not found"

# Delete tag
git tag -d "v$FROM_VERSION" 2>/dev/null || echo "Local tag v$FROM_VERSION not found"
git push origin ":refs/tags/v$FROM_VERSION" 2>/dev/null || echo "Remote tag v$FROM_VERSION not found"

# Reset to previous version
git checkout main
git reset --hard "v$TO_VERSION"
git push --force-with-lease origin main

# Reset kangaroo
cd deployment/kangaroo-electron
git checkout main
git reset --hard "v$TO_VERSION"
git push --force-with-lease origin main

git checkout release
git reset --hard "v$TO_VERSION"
git push --force-with-lease origin release

cd ../..
git add deployment/kangaroo-electron
git commit -m "rollback: reset to v$TO_VERSION"
git push origin main

echo "✅ Rollback completed to v$TO_VERSION"
```

## 📊 Configuration Validation

### **Configuration Validation Script**
```bash
#!/bin/bash
# scripts/validate-config.sh

echo "=== Configuration Validation ==="

# Validate kangaroo config
echo "1. Kangaroo Configuration:"
cd deployment/kangaroo-electron

APP_ID=$(node -p -e "require('./kangaroo.config.ts').appId")
PRODUCT_NAME=$(node -p -e "require('./kangaroo.config.ts').productName")
VERSION=$(node -p -e "require('./kangaroo.config.ts').version")

echo "App ID: $APP_ID"
echo "Product Name: $PRODUCT_NAME"
echo "Version: $VERSION"

# Validate version consistency
cd ../..
MAIN_VERSION=$(node -p -e "require('./package.json').version")

if [[ "$VERSION" == "$MAIN_VERSION" ]]; then
  echo "✅ Version consistency: PASS"
else
  echo "❌ Version consistency: FAIL (main: $MAIN_VERSION, kangaroo: $VERSION)"
fi

# Validate network configuration
BOOTSTRAP_URL=$(cd deployment/kangaroo-electron && node -p -e "require('./kangaroo.config.ts').bootstrapUrl")
SIGNAL_URL=$(cd deployment/kangaroo-electron && node -p -e "require('./kangaroo.config.ts').signalUrl")

echo "Bootstrap URL: $BOOTSTRAP_URL"
echo "Signal URL: $SIGNAL_URL"

# Validate URLs are accessible
if curl -s --head "$BOOTSTRAP_URL" | grep -q "200\|302"; then
  echo "✅ Bootstrap URL accessible: PASS"
else
  echo "⚠️ Bootstrap URL not accessible: WARNING"
fi

if curl -s --head "$SIGNAL_URL" | grep -q "200\|302"; then
  echo "✅ Signal URL accessible: PASS"
else
  echo "⚠️ Signal URL not accessible: WARNING"
fi

echo "=== Configuration Validation Complete ==="
```

---

**Implementation Note**: Use these configuration examples as templates for your specific deployment needs. Always validate configurations in development before applying to production environments.