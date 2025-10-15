# Testing Standards Overview

This document provides the overall testing architecture and guidelines for the requests-and-offers project. For detailed implementation patterns, see:

- **Frontend Testing**: See [frontend-testing.md](./frontend-testing.md)
- **Backend Testing**: See [backend-testing.md](./backend-testing.md)

## Testing Architecture

### Multi-Layer Testing Strategy

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 7: E2E Testing (Playwright)                          │
│   - Complete user workflows                               │
│   - Cross-browser compatibility                           │
│   - Visual regression testing                             │
├─────────────────────────────────────────────────────────────┤
│ Layer 6: Integration Testing (Tryorama + Vitest)           │
│   - Frontend-Backend Integration                          │
│   - Component Integration                                 │
│   - API Contract Testing                                  │
├─────────────────────────────────────────────────────────────┤
│ Layer 5: Frontend Unit Testing (Vitest)                   │
│   - Component Testing                                     │
│   - Store Testing (Effect-TS + Svelte 5)                 │
│   - Service Testing                                       │
│   - Composable Testing                                    │
├─────────────────────────────────────────────────────────────┤
│ Layer 4: Backend Integration Testing (Tryorama)           │
│   - Multi-Agent Scenarios                                │
│   - Holochain DNA Testing                                │
│   - Cross-Validation Testing                             │
├─────────────────────────────────────────────────────────────┤
│ Layer 3: Business Logic Testing                           │
│   - Domain Rules Testing                                 │
│   - Status Transition Testing                            │
│   - Permission Testing                                   │
├─────────────────────────────────────────────────────────────┤
│ Layer 2: API Testing                                      │
│   - Zome Function Testing                                │
│   - Validation Testing                                   │
│   - Error Handling Testing                               │
├─────────────────────────────────────────────────────────────┤
│ Layer 1: Unit Testing (Utility Functions)                 │
│   - Pure Function Testing                                │
│   - Schema Validation Testing                            │
│   - Helper Function Testing                             │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend Testing
- **Vitest**: Fast unit test framework with TypeScript support
- **Svelte Testing Library**: Component testing utilities
- **Effect-TS**: Functional testing with effect composition
- **Svelte 5 Runes**: Reactive state testing
- **jsdom**: DOM environment for component tests

### Backend Testing
- **Tryorama**: Multi-agent Holochain testing framework
- **Vitest**: Test runner and assertion library
- **@holochain/client**: Mock utilities for testing
- **Holochain**: Peer-to-peer application framework

## Test Coverage Guidelines

### ✅ **DO:**
- **Test Core User Flows**: Focus on critical paths and primary workflows
- **Test Business Rules**: Validate status transitions, permissions, and constraints
- **Test Error Boundaries**: Ensure graceful error handling and recovery
- **Test Integration Points**: Verify frontend-backend communication
- **Test Permission Boundaries**: Validate authorization and access control
- **Use Descriptive Test Names**: Explain what is being tested and expected outcome
- **Mock External Dependencies**: Isolate units from databases, APIs, file systems
- **Keep Tests Fast**: Unit tests should execute in milliseconds

### ❌ **DON'T:**
- **Test Implementation Details**: Focus on behavior, not internal workings
- **Test Non-Critical Utilities**: Skip secondary workflows unless business-critical
- **Write Tests for Every Change**: Test at logical completion points
- **Test Edge Cases Prematurely**: Defer until dedicated testing phases
- **Create Brittle Tests**: Avoid over-specifying implementation details
- **Ignore Test Organization**: Maintain clear test structure and naming

## Test Organization

### Directory Structure
```
tests/
├── src/
│   ├── requests_and_offers/
│   │   ├── requests-tests/
│   │   │   ├── requests.test.ts
│   │   │   ├── requests-archive.test.ts
│   │   │   └── common.ts
│   │   ├── service-types-tests/
│   │   │   ├── status/
│   │   │   └── linking/
│   │   └── utils/
│   └── common/
├── utils.ts
└── fixtures/
    ├── sample-data.ts
    └── mock-responses.ts
```

### Test Naming Conventions
- **Unit Tests**: `should[expectedBehavior]when[condition]`
- **Integration Tests**: `test[featureName]with[scenario]`
- **E2E Tests**: `test[userStory]from[userPerspective]`

## CI/CD Integration

### Test Execution Commands
```bash
# Run all tests
bun test

# Frontend unit tests only
cd ui && bun test:unit

# Backend integration tests
bun test:service-types
bun test:requests
bun test:offers

# E2E tests
bun test:e2e

# Test with coverage
bun test --coverage

# Test specific patterns
bun test --grep "basic operations"
```

### Coverage Requirements
- **Unit Tests**: ≥80% line coverage for critical paths
- **Integration Tests**: ≥70% line coverage for business logic
- **E2E Tests**: 100% coverage for primary user workflows

## Test Data Management

### Factory Pattern Implementation
```typescript
// factories/sample-data.ts
export const sampleUser = (overrides = {}) => ({
  name: "Test User",
  email: "test@example.com",
  avatar_url: "https://example.com/avatar.png",
  ...overrides
});

export const sampleRequest = (overrides = {}) => ({
  title: "Test Request",
  description: "Test request description",
  contact_preference: "Email",
  time_preference: "Morning",
  time_zone: "UTC",
  interaction_type: "Virtual" as const,
  links: [],
  service_type_hashes: [],
  medium_of_exchange_hashes: [],
  ...overrides
});
```

This comprehensive testing strategy ensures robust, maintainable code while focusing development effort on the most critical aspects of the application.