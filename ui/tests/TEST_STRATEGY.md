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

``` text
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

``` text
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

## Tryorama Integration for E2E Testing

To provide a complete end-to-end testing experience that covers both the UI and Holochain DNA layers, we have integrated Tryorama with our Playwright E2E tests.

### Key Improvements in Tryorama Testing Approach

1. **Real Holochain Conductor Integration**
   - Introduced `HolochainClientMock` that supports real Holochain conductor interactions
   - Enables testing with actual DNA conductors instead of static mocks

2. **Flexible Test Setup Utility**
   - Added `setupTryoramaTest` function for standardized test environment creation
   - Supports dynamic conductor and player configuration
   - Provides automatic cleanup of test resources

### Testing Workflow

1. **Conductor Initialization**
   - Create a new Holochain conductor
   - Set up test players with predefined configurations
   - Initialize Holochain clients for each player

2. **Test Execution**
   - Use Playwright for UI interactions
   - Leverage Tryorama for backend (DNA) state verification
   - Ensure complete end-to-end test coverage

### Implementation Details

- **HolochainClientMock**
  - Supports real Holochain conductor interactions
  - Configurable per test agent
  - Provides a consistent interface for UI and DNA testing

- **setupTryoramaTest Utility**
  - Automates conductor and player setup
  - Returns players, clients, and a cleanup function
  - Ensures clean test isolation and resource management

### Test Scenarios

1. **UI Interaction Tests**
   - Verify UI actions trigger correct DNA state changes
   - Test user workflows across UI and backend

2. **State Synchronization**
   - Validate DHT updates after UI interactions
   - Ensure consistency between UI state and Holochain state

### Future Improvements

- Expand test coverage for complex user interactions
- Develop more sophisticated test scenarios
- Implement performance and stress testing utilities

### Running Tryorama Tests

```bash
# Run Tryorama E2E tests
nix develop --command bun test:tryorama
```

This approach provides a robust, comprehensive testing strategy that bridges UI and DNA layer testing.

## Test Implementation Progress

### Completed Tests

- [x] Set up first unit test (eventBus.test.ts)
- [x] Implement requests store unit tests
- [x] Implement requests store-service integration tests
- [x] Create type-safe testing utilities
- [x] Implement test mocks for Holochain services
- [ ] Implement end-to-end tests for request creation and management

### Requests Module Testing

The Requests module has been thoroughly tested with both unit and integration tests:

#### Unit Tests (Store)

- `requests.store.test.ts`: Tests the store functionality in isolation with mocked services
  - Create request
  - Get all requests
  - Get user requests
  - Get organization requests
  - Get latest request
  - Update request
  - Error handling

#### Integration Tests (Store-Service)

- `requests.test.ts`: Tests the integration between the store and service
  - Create request and update store
  - Get all requests and update store
  - Error handling

#### Test Helpers

- `test-helpers.ts`: Provides utilities for creating test data
  - `createTestRequest()`: Creates a test request object
  - `createMockRecord()`: Creates a mock Holochain record with proper encoding
  - `actionHashToString()`: Converts action hash to string for comparison
  - `compareActionHashes()`: Compares two action hashes

### Verifying Test Effectiveness

To verify that our tests are effective at catching issues, we can intentionally break the code and confirm that tests fail as expected. Here are examples of how to do this:

#### 1. Break Event Emission

```typescript
// In requests.store.svelte.ts
// Change:
eventBus.emit('request:created', { request: newRequest });
// To:
eventBus.emit('request:created:wrong', { request: newRequest });
```

This will cause tests that verify event emissions to fail.

#### 2. Break Store Updates

```typescript
// In requests.store.svelte.ts
// Change:
requests.push(newRequest);
// To:
// requests.push(newRequest);
```

This will cause tests that verify store state updates to fail.

#### 3. Break Action Hash Assignment

```typescript
// In requests.store.svelte.ts
// Change:
original_action_hash: record.signed_action.hashed.hash,
// To:
original_action_hash: undefined as any,
```

This will cause tests that verify the presence of action hashes to fail.

#### 4. Break Update Request Method

```typescript
// In requests.store.svelte.ts
// Change:
const index = requests.findIndex(
  (request) => request.original_action_hash === originalActionHash
);
// To:
const index = -1; // Always fail to find the request
```

This will cause update request tests to fail.

#### 5. Break Error Handling

```typescript
// In requests.store.svelte.ts
// Change:
error = err instanceof Error ? err.message : String(err);
throw err;
// To:
error = "Fixed error message";
// Don't rethrow the error
```

This will cause error handling tests to fail.

#### 6. Break Mock Record Creation

```typescript
// In test-helpers.ts
// Change:
const entry = encode(request);
// To:
const entry = new Uint8Array(); // Empty entry
```

This will cause tests to fail due to invalid mock data.

### Testing Best Practices

1. **Use Real Event Bus with Mock Handlers**: This approach provides a good balance between realism and testability.
2. **Properly Mock Holochain Records**: Ensure mock records match the structure expected by the application.
3. **Test All Three Aspects**: Always verify service calls, store state updates, and event emissions.
4. **Test Error Handling**: Include tests for error scenarios to ensure graceful failure.
5. **Use Realistic Test Data**: Use Holochain utilities like `fakeActionHash()` to create realistic test data.

## Test Implementation Checklist

### Unit Testing Setup

- [x] Initialize Vitest
- [x] Set up first unit test (eventBus.test.ts)
- [x] Create initial type-safe testing utilities
- [x] Implement basic mocks for Holochain services
- [ ] Complete comprehensive type-safe testing utilities
- [ ] Develop advanced mock generators for complex scenarios

### Integration Testing Setup

- [x] Set up integration test environment structure
- [x] Create integration test directory layout
- [x] Implement initial store-service test helpers
- [x] Configure mock Holochain client environment
- [ ] Develop advanced integration test patterns
- [ ] Create comprehensive test data generators
- [ ] Implement cross-module integration tests

### E2E Testing Setup

- [x] Initialize Playwright
- [x] Configure TypeScript for E2E tests
- [x] Set up E2E test environment
- [x] Create E2E directory structure
- [x] Add E2E test scripts to package.json
- [x] Configure Playwright for desktop testing
- [x] Add basic desktop test suite
- [x] Configure .gitignore for test artifacts
- [x] Integrate Tryorama for DNA-level testing
- [x] Implement `HolochainClientMock` for real conductor interactions
- [ ] Develop comprehensive Tryorama test scenarios
- [ ] Create advanced Playwright-Tryorama integration tests

### Fixtures and Mocks

- [x] Create basic user fixtures
- [x] Create basic organization fixtures
- [x] Implement Holochain client mock
- [x] Develop `setupTryoramaTest` utility
- [ ] Expand test data fixtures with more complex scenarios
- [ ] Implement zome-specific comprehensive mocks
- [ ] Create dynamic test data generators
- [ ] Develop advanced mock configuration utilities

### Tryorama Integration Progress

- [x] Initial Tryorama integration design
- [x] Implement `HolochainClientMock` with real conductor support
- [x] Create `setupTryoramaTest` utility for test environment management
- [ ] Develop first set of Tryorama-based end-to-end tests
- [ ] Implement DNA state verification tests
- [ ] Create test scenarios covering complex user interactions
- [ ] Develop performance and stress testing utilities

### Testing Coverage Goals

- [ ] Achieve 80% unit test coverage
- [ ] Achieve 70% integration test coverage
- [ ] Develop comprehensive E2E test suite
- [ ] Implement full DNA layer test coverage
- [ ] Create performance benchmark tests
- [ ] Develop accessibility and UI consistency tests

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
