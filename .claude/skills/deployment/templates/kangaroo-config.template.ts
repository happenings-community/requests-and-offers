import { defineConfig } from './src/main/defineConfig';

export default defineConfig({
  // Unique application identifier
  appId: 'your-app.happenings-community.kangaroo-electron',

  // User-facing application name
  productName: 'Your App Name',

  // Version (should match package.json)
  version: '0.1.X',

  // Code signing configuration
  macOSCodeSigning: false,  // Set to 'true' for production releases
  windowsEVCodeSigning: false,  // Set to 'true' for production releases

  // Application behavior
  fallbackToIndexHtml: true,
  autoUpdates: true,
  systray: true,

  // Password protection: 'password-optional' | 'password-required' | 'no-password'
  passwordMode: 'password-optional',

  // Network configuration
  networkSeed: 'your-network-seed',

  // Production Holochain network settings
  bootstrapUrl: 'https://holostrap.elohim.host/',
  signalUrl: 'wss://holostrap.elohim.host/',

  // ICE servers for WebRTC (can add more for better connectivity)
  iceUrls: [
    'stun:stun.cloudflare.com:3478',
    'stun:stun.l.google.com:19302'
  ],

  // Binary versions and checksums (keep updated)
  bins: {
    holochain: {
      version: '0.5.5',
      sha256: {
        'x86_64-unknown-linux-gnu': '8c1e0c6e72fb5dde157973ee280ee494bbbad1926820829339dc67b84bc86b6e',
        'x86_64-pc-windows-msvc.exe': 'cb62f336c1be9fbf8c4a823b4e6b0248903f8e07c881497c8590e923142bbdaf',
        'x86_64-apple-darwin': '430bc76fa9561461cf038f9ce4939171712ba02ce6eefc4a0aa43ac3496e498c',
        'aarch64-apple-darwin': 'c7535f3ce81cb6a72397d5942da6bb4a16d9eb9afc78af7ce0b861ca237d51f7',
      },
    },
    lair: {
      version: '0.6.2',
      sha256: {
        'x86_64-unknown-linux-gnu': '3c9ea3dbfc0853743dad3874856fdcfe391dca1769a6a81fc91b7578c73e92a7',
        'x86_64-pc-windows-msvc.exe': '6392ce85e985483d43fa01709bfd518f8f67aed8ddfa5950591b4ed51d226b8e',
        'x86_64-apple-darwin': '746403e5d1655ecf14d95bccaeef11ad1abfc923e428c2f3d87c683edb6fdcdc',
        'aarch64-apple-darwin': '05c7270749bb1a5cf61b0eb344a7d7a562da34090d5ea81b4c5b6cf040dd32e8',
      },
    },
  },
});

## Configuration Guide

### Development vs Production

**Development Environment:**
- `macOSCodeSigning: false`
- `windowsEVCodeSigning: false`
- Test network URLs
- Development bootstrap servers

**Production Environment:**
- `macOSCodeSigning: true` (if you have Apple Developer certificate)
- `windowsEVCodeSigning: true` (if you have EV certificate)
- Production network URLs as shown above
- Production bootstrap servers

### Version Management

1. Keep version in sync with `package.json`
2. Use semantic versioning (major.minor.patch)
3. Update version for every release

### Code Signing Setup

**macOS Code Signing:**
1. Get Apple Developer certificate
2. Add to GitHub repository secrets:
   - `APPLE_CERTIFICATE` (base64 encoded .p12 file)
   - `APPLE_CERTIFICATE_PASSWORD`
   - `APPLE_DEV_IDENTITY`
   - `APPLE_ID_EMAIL`
   - `APPLE_ID_PASSWORD`
   - `APPLE_TEAM_ID`

**Windows Code Signing:**
1. Get EV code signing certificate
2. Add to GitHub repository secrets:
   - `WINDOWS_CERTIFICATE_PASSWORD`

### Network Configuration

**Production (Holostrap):**
- `bootstrapUrl: 'https://holostrap.elohim.host/'`
- `signalUrl: 'wss://holostrap.elohim.host/'`

**Development/Testing:**
- Use local bootstrap servers
- Configure test network settings
- Adjust for your development environment

### Binary Updates

When updating Holochain or Lair versions:

1. Download new binaries
2. Calculate SHA256 checksums
3. Update version numbers
4. Update all platform checksums
5. Test builds before release

### Security Considerations

1. Never commit private keys or certificates
2. Use GitHub repository secrets for sensitive data
3. Keep checksums updated for security
4. Use HTTPS URLs for all network connections
5. Validate all downloaded binaries