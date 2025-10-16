# Minimal Configuration Mockup

## Target kangaroo.config.ts Structure

```typescript
import { defineConfig } from './src/main/defineConfig';

const config = defineConfig({
  // Essential App Identity
  appId: 'requests-and-offers.happenings-community.kangaroo-electron',
  productName: 'Requests and Offers',
  version: '0.2.0',

  // Security (Disabled for Simplicity)
  macOSCodeSigning: false,
  windowsEVCodeSigning: false,
  autoUpdates: false,

  // Essential UI
  fallbackToIndexHtml: true,
  systray: true,
  passwordMode: 'no-password',

  // Network Configuration
  networkSeed: 'requests-and-offers-2025',
  bootstrapUrl: 'https://holostrap.elohim.host/',
  signalUrl: 'wss://holostrap.elohim.host/',
  iceUrls: [
    'stun:stun.cloudflare.com:3478',
    'stun:stun.l.google.com:19302'
  ],

  // Holochain Binary Versions
  bins: {
    holochain: { version: '0.5.5' },
    lair: { version: '0.6.2' }
  }
});

export default config;
```

## Simplified Package.json Scripts

```json
{
  "scripts": {
    "setup": "bun install && bun run fetch:binaries && bun run fetch:webhapp",
    "dev": "bun run setup && electron-vite dev",
    "build": "bun run setup && electron-vite build",
    "build:all": "bun run build && electron-builder --mac --win --linux",
    "lint": "eslint --ext .ts,.tsx .",
    "typecheck": "tsc --noEmit"
  }
}
```

## Simplified electron-builder.yml

```yaml
appId: requests-and-offers.happenings-community.kangaroo-electron
productName: Requests and Offers
directories:
  output: release
files:
  - out
  - pouch
asarUnpack:
  - pouch
mac:
  category: public.app-category.productivity
  target:
    - target: universal
      arch:
        - arm64
        - x64
win:
  target:
    - target: nsis
      arch:
        - x64
linux:
  target:
    - target: AppImage
      arch:
        - x64
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

### Simplifications:
- Direct window loading (no splashscreen)
- Essential build targets only
- Minimal configuration validation
- Simple webhapp fetching