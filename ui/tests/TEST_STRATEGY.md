# Comprehensive Test Plan for Requests and Offers UI

This document outlines the complete testing strategy for the Requests and Offers Holochain application UI, covering all testing levels from unit tests to end-to-end tests.

## Testing Levels

### 1. Unit Tests

Unit tests verify that individual units of code work as expected in isolation. We use Vitest for unit testing.

#### Unit Test Structure

``` text
ui/
├── src/
│   ├── tests/                 # Unit tests directory
│   │   ├── stores/            # Tests for store modules
│   │   │   ├── eventBus.test.ts
│   │   │   ├── administration.store.test.ts
│   │   │   ├── organizations.store.test.ts
│   │   │   └── users.store.test.ts
│   │   ├── services/          # Tests for service modules
│   │   │   ├── HolochainClientService.test.ts
│   │   │   └── zomes/
│   │   │       ├── administration.service.test.ts 
│   │   │       ├── organizations.service.test.ts
│   │   │       └── users.service.test.ts
│   │   ├── components/        # Tests for UI components
│   │   └── utils/             # Tests for utility functions
```

#### Unit Test Priorities

1. **Core Utilities**
   - Event Bus (`eventBus.test.ts`) - 
   - Holochain Client Service
   - Helper functions

2. **Stores**
   - Administration Store
   - Organizations Store
   - Users Store

3. **Services**
   - Zome services:
     - Administration Service
     - Organizations Service
     - Users Service
     - Projects Service

4. **Components**
   - Form validation
   - UI state management
   - Event handling

#### Running Unit Tests

```bash
# Run all unit tests
bun test

# Run specific unit tests using a pattern
bun test eventBus

# Run unit tests in watch mode
bun test --watch
```

### 2. Integration Tests

Integration tests verify that different parts of the application work together correctly.

#### Integration Test Structure

```
ui/
├── src/
│   ├── tests/
│   │   ├── integration/       # Integration tests directory
│   │   │   ├── store-service/ # Tests for store-service integration
│   │   │   │   ├── administration.test.ts
│   │   │   │   ├── organizations.test.ts
│   │   │   │   └── users.test.ts
│   │   │   └── ui-store/      # Tests for UI-store integration
```

#### Integration Test Priorities

1. **Store-Service Integration**
   - Administration Store with Administration Service
   - Organizations Store with Organizations Service
   - Users Store with Users Service

2. **UI-Store Integration**
   - Component interaction with stores
   - Route transitions with state changes
   - Form submissions updating stores

3. **Cross-Module Flows**
   - Organization creation and management workflow
   - User registration and profile management workflow

#### Running Integration Tests

```bash
# Run integration tests
bun test integration
```

### 3. End-to-End Tests

End-to-end tests verify that the entire application works correctly from a user's perspective. We use Playwright for E2E testing.

#### E2E Test Structure

``` bash
ui/
├── tests/
│   ├── e2e/
│   │   ├── desktop/          # Desktop-specific tests
│   │   ├── auth/             # Authentication tests
│   │   ├── organizations/    # Organization management tests
│   │   ├── requests/         # Request management tests
│   │   └── offers/           # Offer management tests
│   ├── fixtures/
│   │   ├── users.ts          # User test data
│   │   └── organizations.ts  # Organization test data
│   ├── mocks/
│   │   └── HolochainClientMock.ts
│   └── utils/
```

#### E2E Test Priorities

1. **User Management**
   - User registration
   - Profile creation/editing
   - Login/Authentication

2. **Organization Management**
   - Create organization
   - Edit organization details
   - Add/remove members
   - Add/remove coordinators

3. **Request/Offer Flow**
   - Create request
   - Create offer
   - View requests/offers list
   - Update request/offer status

4. **Admin Features**
   - User management
   - Organization management
   - System-wide requests/offers view

5. **Desktop Application Features**
   - Window management
   - Tauri/Electron integration
   - Native features

#### Running E2E Tests

```bash
# Run E2E tests in development mode
bunx cross-env UI_PORT=5173 TAURI_DEV=true playwright test

# Run E2E tests in production mode
bunx cross-env TAURI_DEV=false playwright test

# Run E2E tests with UI
bunx cross-env UI_PORT=5173 TAURI_DEV=true playwright test --ui
```

## Test Implementation Checklist

### Unit Testing Setup

- [x] Initialize Vitest
- [x] Set up first unit test (eventBus.test.ts)
- [ ] Create type-safe testing utilities
- [ ] Implement test mocks for Holochain services

### Integration Testing Setup

- [ ] Set up integration test environment
- [ ] Create integration test directory structure
- [ ] Implement store-service test helpers
- [ ] Configure mock Holochain environment

### E2E Testing Setup

- [x] Initialize Playwright
- [x] Configure TypeScript for E2E tests
- [x] Set up E2E test environment
- [x] Create E2E directory structure
- [x] Add E2E test scripts to package.json
- [x] Configure Playwright for desktop testing
- [x] Add basic desktop test suite
- [x] Configure .gitignore for test artifacts

### Fixtures and Mocks

- [x] Create basic user fixtures
- [x] Create basic organization fixtures
- [x] Implement Holochain client mock
- [ ] Expand test data fixtures
- [ ] Implement zome-specific mocks

## Testing Strategies

### Unit Testing Strategies

1. **Store Testing**
   - Test state initialization using `$state` and `$derived` runes
   - Test state mutations
   - Test event emission using the event bus
   - Test subscription and cleanup

2. **Service Testing**
   - Test zome call formatting
   - Test response parsing
   - Test error handling
   - Test retry logic

3. **Component Testing**
   - Test rendering
   - Test event handling with native HTML events
   - Test state management with Svelte 5 runes
   - Test lifecycle hooks

### Integration Testing Strategies

1. **Store-Service Integration**
   - Test data flow from service to store
   - Test command flow from store to service
   - Test error propagation

2. **UI-Store Integration**
   - Test UI updates when store changes
   - Test store updates when UI events occur
   - Test complex workflows

### E2E Testing Strategies

1. **User Flow Testing**
   - Test complete user journeys
   - Test error handling and recovery
   - Test performance and responsiveness

2. **Visual Testing**
   - Test UI appearance with Skeleton UI components
   - Test responsive design with TailwindCSS
   - Test accessibility

3. **Holochain-Specific Testing**
   - Test offline behavior
   - Test conductor connectivity
   - Test cell initialization

## Code Examples

### Unit Test Example (Event Bus)

```typescript
// src/tests/eventBus.test.ts
import { expect, test, describe, vi, beforeEach } from 'vitest';
import { createEventBus } from '../stores/eventBus';

interface TestEvents {
  'test:event': { data: string };
}

describe('Event Bus', () => {
  const eventBus = createEventBus<TestEvents>();
  
  let mockHandler: (payload: { data: string }) => void;
  
  beforeEach(() => {
    mockHandler = vi.fn();
  });
  
  test('should register an event handler and emit events to it', () => {
    eventBus.on('test:event', mockHandler);
    eventBus.emit('test:event', { data: 'test data' });
    expect(mockHandler).toHaveBeenCalledWith({ data: 'test data' });
  });
});
```

### Unit Test Example (Store)

```typescript
// Example of testing a SvelteKit store with $state rune
import { expect, test, describe, vi, beforeEach } from 'vitest';
import { createOrganizationsStore } from '../stores/organizations.store.svelte';

describe('Organizations Store', () => {
  // Mock the service
  const mockService = {
    createOrganization: vi.fn(),
    getAllOrganizations: vi.fn()
  };
  
  // Create the store with the mock service
  const organizationsStore = createOrganizationsStore({ 
    organizationsService: mockService,
    eventBus: mockEventBus
  });
  
  test('should initialize with empty organizations array', () => {
    expect(organizationsStore.organizations).toEqual([]);
    expect(organizationsStore.loading).toBe(false);
    expect(organizationsStore.error).toBeNull();
  });
});
```

### Integration Test Example

```typescript
// src/tests/integration/store-service/organizations.test.ts
import { expect, test, describe, vi, beforeEach } from 'vitest';
import { createOrganizationsStore } from '../../../stores/organizations.store.svelte';
import { OrganizationsService } from '../../../services/zomes/organizations.service';

describe('Organizations Store-Service Integration', () => {
  // Mock the service
  const mockService = {
    createOrganization: vi.fn(),
    getAllOrganizations: vi.fn()
  };
  
  // Create the store with the mock service
  const organizationsStore = createOrganizationsStore({ 
    organizationsService: mockService 
  });
  
  test('should call service when creating an organization', async () => {
    const orgInput = { name: 'Test Organization' };
    mockService.createOrganization.mockResolvedValue({ hash: 'test-hash' });
    
    await organizationsStore.createOrganization(orgInput);
    
    expect(mockService.createOrganization).toHaveBeenCalledWith(orgInput);
  });
});
```

### E2E Test Example

```typescript
// tests/e2e/organizations/create.spec.ts
import { test, expect } from '@playwright/test';
import { setupTest } from '../../utils/test-helpers';

test.describe('Organization Creation', () => {
  test.beforeEach(async ({ page }) => {
    await setupTest({ page });
    // Log in and navigate to organization creation page
  });

  test('should create a new organization', async ({ page }) => {
    // Fill out the organization form
    await page.fill('[data-testid="org-name"]', 'Test Organization');
    await page.fill('[data-testid="org-description"]', 'Test Description');
    
    // Submit the form
    await page.click('[data-testid="submit-org"]');
    
    // Verify the organization was created
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
  });
});
```

## CI/CD Integration

- [ ] Set up GitHub Actions workflow
- [ ] Configure test reporting
- [ ] Add error screenshots and videos
- [ ] Implement test result visualization
- [ ] Configure test coverage reporting

## Documentation

- [ ] Document test patterns and best practices
- [ ] Create testing guide for contributors
- [ ] Document test data and fixtures
- [ ] Create troubleshooting guide

## Conclusion

This comprehensive test plan provides a structured approach to testing the Requests and Offers UI at all levels. By implementing tests at the unit, integration, and end-to-end levels, we can ensure the application functions correctly and provides a good user experience.
