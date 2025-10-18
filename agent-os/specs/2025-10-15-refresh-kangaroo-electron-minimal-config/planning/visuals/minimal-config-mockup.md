# Minimal Configuration Mockup

## Target kangaroo.config.ts Structure

```typescript
import { defineConfig } from './src/main/defineConfig';

export default defineConfig({
  // Essential App Identity (Following Holochain standards)
  appId: 'org.holochain.kangaroo-electron',
  productName: 'Requests and Offers',
  version: '1.0.9',

  // Security Settings (Following original patterns)
  macOSCodeSigning: false,
  windowsEVCodeSigning: false,
  fallbackToIndexHtml: true,
  autoUpdates: false,
  systray: true,
  passwordMode: 'password-optional', // Holochain standard

  // Network Configuration
  networkSeed: 'requests-and-offers-2025',
  bootstrapUrl: 'https://holostrap.elohim.host/',
  signalUrl: 'wss://holostrap.elohim.host/',
  iceUrls: [
    'stun:stun.cloudflare.com:3478',
    'stun:stun.l.google.com:19302'
  ],

  // Holochain Binary Versions (with SHA256 checksums for security)
  bins: {
    holochain: {
      version: '0.5.5',
      sha256: {
        "x86_64-unknown-linux-gnu": "PLACEHOLDER_LINUX_SHA256",
        "x86_64-pc-windows-msvc.exe": "PLACEHOLDER_WINDOWS_SHA256",
        "x86_64-apple-darwin": "PLACEHOLDER_MAC_INTEL_SHA256",
        "aarch64-apple-darwin": "PLACEHOLDER_MAC_ARM_SHA256"
      }
    },
    lair: {
      version: '0.6.2',
      sha256: {
        "x86_64-unknown-linux-gnu": "PLACEHOLDER_LAIR_LINUX_SHA256",
        "x86_64-pc-windows-msvc.exe": "PLACEHOLDER_LAIR_WINDOWS_SHA256",
        "x86_64-apple-darwin": "PLACEHOLDER_LAIR_MAC_INTEL_SHA256",
        "aarch64-apple-darwin": "PLACEHOLDER_LAIR_MAC_ARM_SHA256"
      }
    }
  }
});
```

## Package.json Structure (Following Holochain Standards)

```json
{
  "name": "org.holochain.kangaroo-electron",
  "version": "1.0.9",
  "license": "CAL-1.0",
  "main": "./out/main/index.js",
  "scripts": {
    "setup": "yarn && yarn fetch:binaries && yarn fetch:webhapp && yarn write:configs",
    "dev": "yarn write:configs && yarn pouch:unpack && yarn create:icons && electron-vite dev",
    "build": "yarn write:configs && yarn pouch:unpack && yarn create:icons && yarn typecheck && electron-vite build",
    "build:win": "yarn build && electron-builder --win --config",
    "build:mac-arm64": "yarn build && electron-builder --mac --arm64 --config",
    "build:mac-x64": "yarn build && electron-builder --mac --x64 --config",
    "build:linux": "yarn build && electron-builder --linux --config",
    "typecheck:node": "tsc --noEmit -p tsconfig.node.json --composite false",
    "typecheck:web": "tsc --noEmit -p tsconfig.web.json --composite false",
    "typecheck": "yarn typecheck:node && yarn typecheck:web",
    "fetch:binaries": "node ./scripts/fetch-binaries.js",
    "fetch:webhapp": "node ./scripts/fetch-webhapp.js",
    "pouch:unpack": "node ./scripts/unpack-pouch.js",
    "create:icons": "node ./scripts/create-icons.js",
    "write:configs": "node ./scripts/write-configs.js",
    "lint": "eslint --ext .ts,.tsx ."
  }
}
```

## Electron Builder Configuration (Following Holochain Template)

```yaml
appId: ____PLACEHOLDER____
productName: ____PLACEHOLDER____
directories:
  buildResources: build
  output: release
files:
  - resources
  - out
  - kangaroo.config.ts
asarUnpack:
  - resources/**

win:
  executableName: ____PLACEHOLDER____
nsis:
  artifactName: ${name}-${version}-setup.${ext}
  shortcutName: ${productName}
  uninstallDisplayName: ${productName}
  createDesktopShortcut: always

mac:
  entitlementsInherit: build/entitlements.mac.plist
  notarize: false
dmg:
  artifactName: ${name}-${version}-${arch}.${ext}

linux:
  target:
    - AppImage
    - deb
  maintainer: electronjs.org
  category: Utility
appImage:
  artifactName: ${name}-${version}.${ext}

npmRebuild: false
```

## Removed Components

### Scripts to Remove:
- `deploy.sh` - Complex deployment automation
- `monitor-builds.js` - Build monitoring
- `rollback.sh` - Rollback automation
- `pre-deploy-check.sh` - Pre-deployment validation

### Directories to Remove:
- `src/renderer/splashscreen/` - Splashscreen UI
- `assets/splashscreen/` - Splashscreen assets
- Complex validation logic in main process

### Simplifications (Following Holochain Standards):
- Direct window loading (no splashscreen)
- Essential build targets only (win, mac-arm64, mac-x64, linux)
- Template-based electron-builder configuration
- Minimal configuration validation
- SHA256 checksum security for binary verification
- Standard Holochain resource management patterns