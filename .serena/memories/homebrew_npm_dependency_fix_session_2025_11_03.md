# Homebrew npm Dependency Fix Session - November 3, 2025

## Problem Summary
Users installing "requests-and-offers" via Homebrew were getting npm-related errors during installation because the postflight script required npm to be installed on user machines. End users should NOT need development environments.

## Root Cause Analysis
Through comprehensive git history analysis, discovered the issue was introduced on October 18, 2025 (commit `1e6ba68`) during a repository structure refresh that accidentally removed critical native module packaging configurations from electron-builder.yml.

### Timeline
- **August 25, 2025**: npm dependency originally added to Homebrew cask (v0.1.0-alpha.6)
- **October 18, 2025**: Breaking change - electron-builder configuration lost native module unpack settings
- **v0.1.8**: Working properly with correct native module bundling
- **v0.1.9**: Broken - native modules not properly bundled, requiring runtime npm installation

## Technical Investigation
- Analyzed git history of both Homebrew and Kangaroo repositories
- Identified specific configuration changes that caused the regression
- Discovered `@holochain/hc-spin-rust-utils` is a critical production component (not dev tool)
- Confirmed ZomeCallSigner handles cryptographic signing for all Holochain operations

## Solution Implemented

### 1. Fixed electron-builder Template
**File**: `deployment/kangaroo-electron/templates/electron-builder-template.yml`
```yaml
asarUnpack:
  - resources/**
  - node_modules/@holochain/hc-spin-rust-utils/**
  - node_modules/@holochain/hc-spin-rust-utils-*/**
  - '**/*.node'
npmRebuild: true
```

### 2. Regenerated Build Configuration
- Ran `node scripts/write-configs.js` to update electron-builder.yml
- Verified native module configuration is now active

### 3. Removed npm Dependency from Homebrew
**File**: `deployment/homebrew/Casks/requests-and-offers.rb`
- Removed entire npm installation postflight script (lines 26-41)
- Kept only quarantine removal for clean installation
- Updated comments to reflect native modules are now properly bundled

## Files Modified
1. `deployment/kangaroo-electron/templates/electron-builder-template.yml` - Restored native module asarUnpack configuration
2. `deployment/kangaroo-electron/electron-builder.yml` - Regenerated from fixed template
3. `deployment/homebrew/Casks/requests-and-offers.rb` - Removed npm dependency, simplified postflight script

## Key Technical Insights
- `@holochain/hc-spin-rust-utils` contains ZomeCallSigner for cryptographic operations
- Native modules are required for production, not development tools
- Electron asar archives cannot properly bundle native modules without asarUnpack configuration
- Proper bundling eliminates runtime npm dependencies completely

## Validation
- Configuration properly includes native module extraction paths
- npmRebuild setting restored to true for proper compilation
- Homebrew cask simplified to only quarantine removal
- Both build and deployment configurations aligned

## Next Steps Required
1. Build new release with fixed configuration
2. Test Homebrew installation on clean macOS without npm
3. Deploy updated Homebrew formula
4. Monitor user feedback for installation success

## Lessons Learned
- Git history analysis essential for regression diagnosis
- Native module handling critical for Electron apps with cryptographic components
- Homebrew installations must work on clean systems without development dependencies
- asarUnpack configuration is standard Electron pattern for native modules

## Impact Assessment
- Resolves installation blocker for users without npm/Node.js
- Maintains full application functionality and security
- Follows Electron best practices
- Provides professional installation experience