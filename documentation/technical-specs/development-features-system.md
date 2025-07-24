# Development Features System

A centralized system for managing development-only features and mock data in the requests-and-offers application.

## Overview

The Development Features System provides a unified approach to controlling development tools, mock data, and debugging features across different deployment environments. It ensures production builds are clean while enhancing the developer experience during development and testing.

## Architecture

### 7-Layer Effect-TS Integration

The system follows the established 7-layer Effect-TS architecture pattern:

1. **Service Layer**: `DevFeaturesService` with Context.Tag dependency injection
2. **Environment Configuration**: Vite environment variables for build-time optimization
3. **Component Integration**: Conditional rendering using `shouldShowMockButtons()`
4. **Build-Time Tree-Shaking**: Automatic removal of dev features in production
5. **Mock Data Layer**: Enhanced mock utilities for realistic testing data
6. **Testing Strategy**: Different modes for development, testing, and production
7. **Documentation**: Comprehensive usage guidelines and examples

## Core Components

### DevFeaturesService

**Location**: `ui/src/lib/services/devFeatures.service.ts`

```typescript
export class DevFeaturesServiceTag extends Context.Tag('DevFeaturesService')<
  DevFeaturesServiceTag,
  DevFeaturesService
>() {}

export const shouldShowMockButtons = (): boolean => {
  return import.meta.env.VITE_MOCK_BUTTONS_ENABLED === 'true' && 
         import.meta.env.VITE_DEV_FEATURES_ENABLED === 'true';
};
```

**Key Features**:
- Effect-TS Context.Tag pattern for dependency injection
- Build-time evaluation using Vite environment variables
- Tree-shaking optimization for production builds
- Type-safe feature flag management

### Environment Configuration

**Development Mode** (`.env.development`):
```env
VITE_APP_ENV=development
VITE_DEV_FEATURES_ENABLED=true
VITE_MOCK_BUTTONS_ENABLED=true
```

**Test Mode** (`.env.test`):
```env
VITE_APP_ENV=test
VITE_DEV_FEATURES_ENABLED=true
VITE_MOCK_BUTTONS_ENABLED=false
```

**Production Mode** (`.env.production`):
```env
VITE_APP_ENV=production
# All development features are disabled in production
```

## Usage

### Component Integration

All form components use the service for conditional mock button rendering:

```svelte
<script lang="ts">
  import { shouldShowMockButtons } from '$lib/services/devFeatures.service';
  // ... other imports
</script>

<!-- Form content -->

{#if mode === 'create' && shouldShowMockButtons()}
  <button
    type="button"
    class="variant-soft-secondary btn"
    onclick={handleMockSubmit}
    disabled={isSubmitting}
  >
    Create Mock Data
  </button>
{/if}
```

### Enhanced Mock Functions

**Location**: `ui/src/lib/utils/mocks.ts`

New mock functions for comprehensive testing:

```typescript
// Medium of Exchange mocks
export const createMockedMediumOfExchange = (): MediumOfExchangeInDHT => ({
  code: faker.finance.currencyCode(),
  name: faker.finance.currencyName(),
  description: faker.lorem.sentence(),
  resource_spec_hrea_id: faker.string.uuid()
});

export const createSuggestedMockedMediumOfExchange = (): MediumOfExchangeInDHT => ({
  code: `${faker.finance.currencyCode()}_SUGGESTED`,
  name: `${faker.finance.currencyName()} (Suggested)`,
  description: faker.lorem.sentence(),
  resource_spec_hrea_id: faker.string.uuid()
});
```

## Deployment Modes

### Development Mode
- **Purpose**: Full development experience with all features enabled
- **Features**: Mock buttons, debug tools, development utilities
- **Command**: `bun start` or `bun run start:test`
- **Environment**: `VITE_APP_ENV=development`

### Test Mode (Alpha)
- **Purpose**: Alpha testing environment with limited dev features
- **Features**: Development features enabled, mock buttons disabled
- **Command**: `bun run start:test`
- **Environment**: `VITE_APP_ENV=test`

### Production Mode
- **Purpose**: Clean production deployment
- **Features**: All development features disabled and tree-shaken
- **Command**: `bun run prod`
- **Environment**: `VITE_APP_ENV=production`

## Build Scripts

### UI Scripts (ui/package.json)

```json
{
  "scripts": {
    "start": "vite --clearScreen false --port $UI_PORT --mode development",
    "start:test": "vite --clearScreen false --port $UI_PORT --mode test", 
    "start:prod": "vite --clearScreen false --port $UI_PORT --mode production",
    "build": "bun run check && vite build --mode production",
    "build:test": "bun run check && vite build --mode test"
  }
}
```

### Root Scripts (package.json)

```json
{
  "scripts": {
    "start": "AGENTS=${AGENTS:-2} BOOTSTRAP_PORT=$(get-port) bun run network",
    "start:test": "AGENTS=${AGENTS:-2} BOOTSTRAP_PORT=$(get-port) bun run network:test",
    "prod": "AGENTS=${AGENTS:-2} BOOTSTRAP_PORT=$(get-port) bun run network:start:prod"
  }
}
```

## Tree-Shaking Verification

The system implements build-time optimization that completely removes development features from production builds:

**Development Build**:
```javascript
const shouldShowMockButtons = () => true;
```

**Production Build**:
```javascript
const shouldShowMockButtons = () => false; // or minified as ()=>!1
```

**Verification Command**:
```bash
bun run build && grep -r "shouldShowMockButtons" .svelte-kit/output/client/
```

## Integrated Forms

The following forms have been integrated with the development features system:

1. **RequestForm.svelte** - Request creation with mock data
2. **OfferForm.svelte** - Offer creation with mock data  
3. **OrganizationForm.svelte** - Organization creation with mock data
4. **UserForm.svelte** - User creation with mock data
5. **ServiceTypeForm.svelte** - Service type creation with mock data
6. **ServiceTypeSuggestionForm.svelte** - Service type suggestions
7. **MediumOfExchangeForm.svelte** - Currency/payment method creation
8. **MediumOfExchangeSuggestionForm.svelte** - Currency suggestions

## Benefits

### Developer Experience
- **Rapid Prototyping**: Instant mock data generation for testing workflows
- **Consistent Testing**: Realistic data across all forms and components
- **Flexible Development**: Easy switching between development modes
- **Debugging Support**: Development-only features for troubleshooting

### Production Safety
- **Zero Overhead**: Complete removal of dev code in production builds
- **Security**: No development utilities exposed in production
- **Performance**: Optimized builds without development features
- **Clean Deployment**: Professional appearance without debug tools

### Testing Efficiency  
- **Multi-Environment**: Test different deployment scenarios
- **Alpha Testing**: Test mode simulates production with dev features
- **Integration Testing**: Verify tree-shaking and build optimization
- **Quality Assurance**: Consistent testing data across environments

## Implementation Guidelines

### Adding New Development Features

1. **Environment Variable**: Add feature flag to environment files
2. **Service Integration**: Extend DevFeaturesService with new feature checks
3. **Component Usage**: Use service functions for conditional rendering
4. **Testing**: Verify tree-shaking removes feature in production builds

### Best Practices

- **Build-Time Evaluation**: Use `import.meta.env` for compile-time optimization  
- **Conditional Rendering**: Wrap dev features in conditional blocks
- **Descriptive Naming**: Use clear, descriptive variable names
- **Documentation**: Document all new dev features and their purpose
- **Testing**: Always test production builds to verify clean removal

## Troubleshooting

### Common Issues

**Mock Buttons Not Appearing**:
- Verify `VITE_DEV_FEATURES_ENABLED=true` in environment file
- Check `VITE_MOCK_BUTTONS_ENABLED=true` for mock button visibility
- Ensure running in development or test mode

**Production Build Contains Dev Code**:
- Verify environment variables are not set in `.env.production`
- Check Vite build mode is set to `production`
- Test tree-shaking with build verification commands

**Environment Not Loading**:
- Ensure environment files are in correct location (`ui/` directory)
- Verify Vite mode flags are correctly set in package.json scripts
- Check file naming convention (`.env.development`, `.env.test`, `.env.production`)

## Future Enhancements

### Planned Features
- **Feature Toggles**: Runtime feature toggling for specific development tools
- **Debug Panels**: Development-only debug information displays
- **Performance Monitoring**: Development-mode performance metrics
- **Test Data Management**: Advanced mock data scenarios and fixtures

### Architecture Improvements
- **Service Extensions**: Additional dev services for specific domains
- **Configuration Management**: Centralized configuration for complex dev features  
- **Plugin System**: Modular development feature plugins
- **Integration Testing**: Automated testing of tree-shaking effectiveness

## Related Documentation

- [Architecture Overview](../CLAUDE.md#architectural-patterns)
- [Effect-TS Guidelines](../CLAUDE.md#effect-ts-guidelines)
- [Testing Strategy](../CLAUDE.md#testing-strategy)
- [Build System](../CLAUDE.md#building)