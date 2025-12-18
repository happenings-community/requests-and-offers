# DevFeatures Service Context Analysis

## Overview
The DevFeatures Service provides centralized atomic control over development-only features through environment variables, following the 7-layer Effect-TS architecture pattern.

## Service Implementation

**File**: `ui/src/lib/services/devFeatures.service.ts`

### Key Features
1. **Mock Buttons Control** - Controls mock data buttons in forms via `VITE_MOCK_BUTTONS_ENABLED`
2. **Peers Display Control** - Shows network peers in test mode via `VITE_PEERS_DISPLAY_ENABLED`
3. **Environment Awareness** - Tracks current environment (development/test/production)
4. **Atomic Feature Flags** - Each feature independently controlled

### Architecture Pattern
- **Effect-TS Service**: Context.Tag-based dependency injection
- **Live Implementation**: Reads from Vite environment variables
- **Convenience Functions**: Direct access without Effect context
- **Production Safe**: Features stripped via Vite tree-shaking

### Environment Variables
```typescript
// Atomic feature flags
VITE_MOCK_BUTTONS_ENABLED=false    // Mock data buttons in forms
VITE_PEERS_DISPLAY_ENABLED=false   // Network peers display in test mode
VITE_APP_ENV=development           // Environment identifier
```

## Integration Points

### Schema Validation
**File**: `ui/src/lib/schemas/devFeatures.schemas.ts`
- Effect Schema definitions for type safety
- Environment variable validation
- Feature name validation
- Configuration schema validation

### Component Usage
Used across all form components for mock button visibility:
- UserForm.svelte
- RequestForm.svelte
- OfferForm.svelte
- OrganizationForm.svelte
- ServiceTypeForm.svelte
- MediumOfExchangeForm.svelte

### Environment Configuration
- `.env.example` provides template with atomic feature control
- Vite config looks for env files in project root (`envDir: '../'`)
- No master switch - each feature independently controlled

## Key Benefits

1. **Atomic Control**: Fine-grained feature control without master switch
2. **Production Safe**: Tree-shaking removes dev code from production builds
3. **Type Safety**: Effect Schema validation for configuration
4. **Consistent Pattern**: Follows established 7-layer architecture
5. **Developer Experience**: Easy toggling of testing features

## Current State
- Service fully implemented and integrated
- Used across all major form components
- Environment configuration template provided
- No breaking changes or issues identified

## Architecture Compliance
✅ Follows 7-layer Effect-TS pattern perfectly
✅ Implements proper dependency injection with Context.Tag
✅ Provides both Effect and non-Effect interfaces
✅ Includes comprehensive schema validation
✅ Maintains atomic feature control philosophy