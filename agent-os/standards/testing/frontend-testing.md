# Frontend Testing Standards

This document provides comprehensive guidelines for frontend testing in the requests-and-offers project using Vitest, Svelte 5, Effect-TS, and modern testing practices.

## Technology Stack

- **Vitest**: Fast unit test framework with TypeScript support
- **Svelte Testing Library**: Component testing utilities for Svelte
- **Effect-TS**: Functional programming testing patterns
- **Svelte 5 Runes**: Reactive state testing with `$state`, `$derived`, `$effect`
- **jsdom**: DOM environment for component tests
- **@testing-library/jest-dom**: Additional DOM matchers and assertions

## Testing Architecture

### Frontend Test Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│ Component Testing (Svelte Testing Library)                  │
│   - User interaction testing                                │
│   - Accessibility testing                                   │
│   - Visual regression testing                              │
├─────────────────────────────────────────────────────────────┤
│ Store Testing (Effect-TS + Svelte 5)                      │
│   - Reactive state testing                                 │
│   - Effect composition testing                             │
│   - Error boundary testing                                │
├─────────────────────────────────────────────────────────────┤
│ Service Testing (Effect-TS)                                │
│   - API integration testing                                │
│   - Error handling testing                                 │
│   - Data transformation testing                            │
├─────────────────────────────────────────────────────────────┤
│ Composable Testing                                          │
│   - Business logic testing                                 │
│   - Form validation testing                                │
│   - State management testing                              │
├─────────────────────────────────────────────────────────────┤
│ Integration Testing                                         │
│   - Component composition testing                          │
│   - Service integration testing                            │
│   - Store integration testing                              │
├─────────────────────────────────────────────────────────────┤
│ Unit Testing (Pure Functions)                              │
│   - Utility function testing                              │
│   - Schema validation testing                             │
│   - Helper function testing                              │
└─────────────────────────────────────────────────────────────┘
```

## Test Configuration

### Vitest Configuration
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/**'
      ]
    }
  }
});
```

### Test Setup File
```typescript
// tests/setup.ts
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Holochain client globally
vi.mock('@holochain/client', () => ({
  fakeActionHash: () => Promise.resolve(new Uint8Array(32)),
  fakeAgentPubKey: () => Promise.resolve(new Uint8Array(32)),
  fakeEntryHash: () => Promise.resolve(new Uint8Array(32)),
  ActionType: {
    Create: 'Create',
    Update: 'Update',
    Delete: 'Delete'
  }
}));

// Global test utilities
declare global {
  interface Window {
    testUtils: {
      createMockService: () => any;
      createMockUser: () => any;
    };
  }
}
```

## Component Testing Patterns

### Basic Component Test
```typescript
// tests/components/ServiceTypeCard.test.ts
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { tick } from 'svelte';
import ServiceTypeCard from '$lib/components/service-types/ServiceTypeCard.svelte';

describe('ServiceTypeCard', () => {
  const mockServiceType = {
    id: 'test-id',
    name: 'Web Development',
    description: 'Frontend and backend web development services',
    status: 'approved' as const,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01')
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render service type information correctly', () => {
    // Act
    render(ServiceTypeCard, {
      props: { serviceType: mockServiceType }
    });

    // Assert
    expect(screen.getByText('Web Development')).toBeInTheDocument();
    expect(screen.getByText('Frontend and backend web development services')).toBeInTheDocument();
    expect(screen.getByText('approved')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  it('should handle edit action', async () => {
    // Arrange
    const onEdit = vi.fn();
    render(ServiceTypeCard, {
      props: { serviceType: mockServiceType, onEdit }
    });

    // Act
    const editButton = screen.getByRole('button', { name: /edit/i });
    await fireEvent.click(editButton);

    // Assert
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(mockServiceType);
  });

  it('should handle delete action with confirmation', async () => {
    // Arrange
    const onDelete = vi.fn();
    render(ServiceTypeCard, {
      props: { serviceType: mockServiceType, onDelete }
    });

    // Mock window.confirm
    const originalConfirm = window.confirm;
    window.confirm = vi.fn(() => true);

    // Act
    const deleteButton = screen.getByRole('button', { name: /delete/i });
    await fireEvent.click(deleteButton);

    // Assert
    expect(window.confirm).toHaveBeenCalledWith(
      'Are you sure you want to delete this service type?'
    );
    expect(onDelete).toHaveBeenCalledWith(mockServiceType);

    // Cleanup
    window.confirm = originalConfirm;
  });

  it('should show loading state', () => {
    // Act
    render(ServiceTypeCard, {
      props: { serviceType: mockServiceType, loading: true }
    });

    // Assert
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /delete/i })).toBeDisabled();
  });

  it('should display error state', () => {
    // Act
    render(ServiceTypeCard, {
      props: {
        serviceType: mockServiceType,
        error: 'Failed to load service type'
      }
    });

    // Assert
    expect(screen.getByText('Failed to load service type')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('should format dates correctly', () => {
    // Act
    render(ServiceTypeCard, {
      props: { serviceType: mockServiceType }
    });

    // Assert
    expect(screen.getByText(/Created: Jan 1, 2023/)).toBeInTheDocument();
    expect(screen.getByText(/Updated: Jan 1, 2023/)).toBeInTheDocument();
  });
});
```

### Form Component Testing
```typescript
// tests/components/ServiceTypeForm.test.ts
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import ServiceTypeForm from '$lib/components/service-types/ServiceTypeForm.svelte';

describe('ServiceTypeForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render form fields correctly', () => {
    // Act
    render(ServiceTypeForm);

    // Assert
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('should validate required fields', async () => {
    // Arrange
    const user = userEvent.setup();
    render(ServiceTypeForm);

    // Act - Submit empty form
    const submitButton = screen.getByRole('button', { name: /submit/i });
    await user.click(submitButton);

    // Assert
    expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled();
  });

  it('should handle form submission with valid data', async () => {
    // Arrange
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(ServiceTypeForm, { props: { onSubmit } });

    // Act - Fill form
    const nameInput = screen.getByLabelText(/name/i);
    const descriptionInput = screen.getByLabelText(/description/i);

    await user.type(nameInput, 'Test Service Type');
    await user.type(descriptionInput, 'Test description');

    const submitButton = screen.getByRole('button', { name: /submit/i });
    await user.click(submitButton);

    // Assert
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'Test Service Type',
        description: 'Test description'
      });
    });
  });

  it('should handle form cancellation', async () => {
    // Arrange
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(ServiceTypeForm, { props: { onCancel } });

    // Act
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    // Assert
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('should populate form with initial data', () => {
    // Arrange
    const initialData = {
      name: 'Existing Service',
      description: 'Existing description'
    };

    // Act
    render(ServiceTypeForm, { props: { initialData } });

    // Assert
    const nameInput = screen.getByLabelText(/name/i) as HTMLInputElement;
    const descriptionInput = screen.getByLabelText(/description/i) as HTMLTextAreaElement;

    expect(nameInput.value).toBe('Existing Service');
    expect(descriptionInput.value).toBe('Existing description');
  });
});
```

### Accessibility Testing
```typescript
// tests/components/Accessibility.test.ts
import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import ServiceTypeCard from '$lib/components/service-types/ServiceTypeCard.svelte';

expect.extend(toHaveNoViolations);

describe('ServiceTypeCard Accessibility', () => {
  it('should have no accessibility violations', async () => {
    // Arrange
    const mockServiceType = {
      id: 'test-id',
      name: 'Web Development',
      description: 'Web development services',
      status: 'approved' as const,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Act
    const { container } = render(ServiceTypeCard, {
      props: { serviceType: mockServiceType }
    });

    // Assert
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper ARIA labels', () => {
    // Arrange
    const mockServiceType = {
      id: 'test-id',
      name: 'Web Development',
      description: 'Web development services',
      status: 'approved' as const,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Act
    render(ServiceTypeCard, { props: { serviceType: mockServiceType } });

    // Assert
    expect(screen.getByRole('button', { name: /edit service type/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete service type/i })).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
```

## Store Testing Patterns

### Store Testing with Effect-TS
```typescript
// tests/stores/serviceTypes.store.test.ts
import { expect, describe, it, beforeEach, vi } from 'vitest';
import { Effect as E } from 'effect';
import { createServiceTypesStore, type ServiceType } from '$lib/stores/serviceTypes.store';

// Mock dependencies
vi.mock('$lib/services/zomes/serviceTypes.service');
vi.mock('$lib/errors/error-context');

describe('ServiceTypesStore', () => {
  let store: ReturnType<typeof createServiceTypesStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    store = createServiceTypesStore();
  });

  describe('Initial State', () => {
    it('should initialize with empty state', () => {
      // Assert
      expect(store.serviceTypes).toEqual([]);
      expect(store.loading).toBe(false);
      expect(store.error).toBe(null);
    });
  });

  describe('Loading State Management', () => {
    it('should set loading state during operations', async () => {
      // Arrange
      const mockService = {
        getAllServiceTypes: vi.fn(() =>
          E.delay(100)(E.succeed([]))
        )
      };

      // Act
      const promise = store.loadServiceTypes();

      // Assert loading state is set
      expect(store.loading).toBe(true);
      expect(store.error).toBe(null);

      // Wait for completion
      await promise;

      // Assert final state
      expect(store.loading).toBe(false);
      expect(store.serviceTypes).toEqual([]);
    });

    it('should clear loading state on error', async () => {
      // Arrange
      const mockService = {
        getAllServiceTypes: vi.fn(() =>
          E.fail(new Error('Network error'))
        )
      };

      // Act
      await store.loadServiceTypes();

      // Assert
      expect(store.loading).toBe(false);
      expect(store.error).not.toBe(null);
      expect(store.error?.message).toContain('Network error');
    });
  });

  describe('Data Loading', () => {
    it('should load and transform service types correctly', async () => {
      // Arrange
      const mockRecords = [
        {
          signed_action: { hashed: { hash: new Uint8Array(32) } },
          entry: { name: 'Service 1', description: 'Description 1' },
          action: () => ({ timestamp: Date.now() * 1000 })
        },
        {
          signed_action: { hashed: { hash: new Uint8Array(32) } },
          entry: { name: 'Service 2', description: 'Description 2' },
          action: () => ({ timestamp: Date.now() * 1000 })
        }
      ];

      const mockService = {
        getAllServiceTypes: vi.fn(() => E.succeed({
          pending: [],
          approved: mockRecords,
          rejected: []
        }))
      };

      // Act
      await store.loadServiceTypes();

      // Assert
      expect(store.serviceTypes).toHaveLength(2);
      expect(store.serviceTypes[0].name).toBe('Service 1');
      expect(store.serviceTypes[1].name).toBe('Service 2');
      expect(store.serviceTypes[0].id).toBeDefined();
      expect(store.serviceTypes[0].createdAt).toBeInstanceOf(Date);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      // Arrange
      const mockService = {
        createServiceType: vi.fn(() =>
          E.fail(new Error('Service unavailable'))
        )
      };

      // Act
      await store.createServiceType({ name: '', description: undefined });

      // Assert
      expect(store.error).not.toBe(null);
      expect(store.error?.message).toContain('Service unavailable');
      expect(store.loading).toBe(false);
    });

    it('should clear errors on retry', () => {
      // Arrange
      store.error = new Error('Previous error');

      // Act
      store.clearError();

      // Assert
      expect(store.error).toBe(null);
    });
  });

  describe('Reactive Updates', () => {
    it('should update reactive state when data changes', () => {
      // Arrange
      const initialLength = store.serviceTypes.length;

      // Act
      store.serviceTypes = [
        ...store.serviceTypes,
        {
          id: 'new-id',
          name: 'New Service',
          description: 'New description',
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      // Assert
      expect(store.serviceTypes).toHaveLength(initialLength + 1);
      expect(store.serviceTypes[initialLength].name).toBe('New Service');
    });
  });
});
```

## Service Testing Patterns

### Effect-TS Service Testing
```typescript
// tests/services/serviceTypes.service.test.ts
import { expect, describe, it, beforeEach, vi } from 'vitest';
import { Effect as E, Layer } from 'effect';
import type { Record, ActionHash } from '@holochain/client';

import {
  ServiceTypesServiceLive,
  ServiceTypesServiceTag,
  ServiceTypeError
} from '$lib/services/zomes/serviceTypes.service';
import { HolochainClientServiceTag } from '$lib/services/HolochainClientService.svelte';
import { createMockRecord, createTestServiceType } from '../test-helpers';

describe('ServiceTypesService', () => {
  let mockHolochainClient: any;
  let mockRecord: Record;
  let testServiceType: any;
  let runServiceEffect: any;

  beforeEach(async () => {
    // Setup mocks
    mockHolochainClient = createMockHolochainClientService();
    mockRecord = await createMockRecord();
    testServiceType = createTestServiceType();
    runServiceEffect = createServiceTestRunner(mockHolochainClient);
  });

  describe('createServiceType', () => {
    it('should create service type successfully', async () => {
      // Arrange
      mockHolochainClient.callZomeRawEffect.mockReturnValue(E.succeed(mockRecord));

      // Act
      const result = await runServiceEffect(
        E.gen(function* () {
          const service = yield* ServiceTypesServiceTag;
          return yield* service.createServiceType(testServiceType);
        })
      );

      // Assert
      expect(mockHolochainClient.callZomeRawEffect).toHaveBeenCalledWith(
        'service_types',
        'create_service_type',
        { service_type: testServiceType }
      );
      expect(result).toEqual(mockRecord);
    });

    it('should handle validation errors', async () => {
      // Arrange
      const validationError = new Error('Name is required');
      mockHolochainClient.callZomeRawEffect.mockReturnValue(E.fail(validationError));

      // Act & Assert
      await expect(
        runServiceEffect(
          E.gen(function* () {
            const service = yield* ServiceTypesServiceTag;
            return yield* service.createServiceType(testServiceType);
          })
        )
      ).rejects.toThrow('Name is required');
    });

    it('should transform errors properly', async () => {
      // Arrange
      const networkError = new Error('Network timeout');
      mockHolochainClient.callZomeRawEffect.mockReturnValue(E.fail(networkError));

      // Act & Assert
      await expect(
        runServiceEffect(
          E.gen(function* () {
            const service = yield* ServiceTypesServiceTag;
            return yield* service.createServiceType(testServiceType);
          })
        )
      ).rejects.toThrow('Failed to create service type');
    });
  });

  describe('Effect Composition', () => {
    it('should compose multiple operations', async () => {
      // Arrange
      const mockRecords = [mockRecord];
      mockHolochainClient.callZomeRawEffect.mockReturnValue(E.succeed(mockRecords));

      // Act
      const result = await runServiceEffect(
        E.gen(function* () {
          const service = yield* ServiceTypesServiceTag;

          // Compose multiple operations
          const allTypes = yield* service.getAllServiceTypes();
          const firstType = allTypes.approved[0];
          const updatedType = yield* service.updateServiceType(
            firstType.signed_action.hashed.hash,
            firstType.signed_action.hashed.hash,
            { ...testServiceType, name: 'Updated Name' }
          );

          return { allTypes, updatedType };
        })
      );

      // Assert
      expect(result.allTypes.approved).toHaveLength(1);
      expect(result.updatedType).toBeDefined();
    });
  });
});
```

## Composable Testing Patterns

### Business Logic Composable Testing
```typescript
// tests/composables/useServiceTypes.test.ts
import { renderHook, act } from '@testing-library/svelte';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useServiceTypes } from '$lib/composables/useServiceTypes';

describe('useServiceTypes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with loading state', () => {
    // Act
    const { result } = renderHook(() => useServiceTypes());

    // Assert
    expect(result.current.loading).toBe(true);
    expect(result.current.serviceTypes).toEqual([]);
    expect(result.current.error).toBe(null);
  });

  it('should load service types on mount', async () => {
    // Arrange
    const mockLoadServiceTypes = vi.fn().mockResolvedValue([
      { id: '1', name: 'Service 1' },
      { id: '2', name: 'Service 2' }
    ]);

    // Act
    const { result } = renderHook(() =>
      useServiceTypes({ loadServiceTypes: mockLoadServiceTypes })
    );

    // Wait for loading to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Assert
    expect(result.current.loading).toBe(false);
    expect(result.current.serviceTypes).toHaveLength(2);
    expect(result.current.serviceTypes[0].name).toBe('Service 1');
  });

  it('should handle search functionality', async () => {
    // Arrange
    const mockServiceTypes = [
      { id: '1', name: 'Web Development' },
      { id: '2', name: 'Mobile Development' },
      { id: '3', name: 'UI/UX Design' }
    ];

    // Act
    const { result } = renderHook(() => useServiceTypes());

    await act(async () => {
      result.current.setServiceTypes(mockServiceTypes);
    });

    act(() => {
      result.current.setSearchTerm('web');
    });

    // Assert
    expect(result.current.filteredServiceTypes).toHaveLength(1);
    expect(result.current.filteredServiceTypes[0].name).toBe('Web Development');
  });

  it('should handle create service type', async () => {
    // Arrange
    const mockCreateServiceType = vi.fn().mockResolvedValue({
      id: 'new-id',
      name: 'New Service'
    });

    // Act
    const { result } = renderHook(() =>
      useServiceTypes({ createServiceType: mockCreateServiceType })
    );

    await act(async () => {
      await result.current.createServiceType({
        name: 'New Service',
        description: 'New description'
      });
    });

    // Assert
    expect(mockCreateServiceType).toHaveBeenCalledWith({
      name: 'New Service',
      description: 'New description'
    });
    expect(result.current.serviceTypes).toHaveLength(1);
    expect(result.current.serviceTypes[0].name).toBe('New Service');
  });
});
```

## Integration Testing

### Component Integration Testing
```typescript
// tests/integration/ServiceTypeManagement.test.ts
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import ServiceTypeManagement from '$lib/pages/service-types/+page.svelte';

describe('ServiceTypeManagement Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should integrate list and create components', async () => {
    // Arrange
    const mockService = {
      getAllServiceTypes: vi.fn(() => Promise.resolve({
        pending: [],
        approved: [
          { id: '1', name: 'Web Development', status: 'approved' }
        ],
        rejected: []
      })),
      createServiceType: vi.fn(() => Promise.resolve({
        id: '2', name: 'Mobile Development', status: 'pending'
      }))
    };

    // Act
    render(ServiceTypeManagement, {
      props: { service: mockService }
    });

    // Assert initial state
    expect(screen.getByText('Web Development')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add service type/i })).toBeInTheDocument();

    // Act - Create new service type
    const addButton = screen.getByRole('button', { name: /add service type/i });
    await fireEvent.click(addButton);

    // Fill form
    const nameInput = screen.getByLabelText(/name/i);
    const descriptionInput = screen.getByLabelText(/description/i);

    await fireEvent.input(nameInput, { target: { value: 'Mobile Development' } });
    await fireEvent.input(descriptionInput, { target: { value: 'Mobile app development' } });

    const submitButton = screen.getByRole('button', { name: /create/i });
    await fireEvent.click(submitButton);

    // Assert integration
    await waitFor(() => {
      expect(mockService.createServiceType).toHaveBeenCalledWith({
        name: 'Mobile Development',
        description: 'Mobile app development'
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Mobile Development')).toBeInTheDocument();
    });
  });

  it('should handle error states across components', async () => {
    // Arrange
    const mockService = {
      getAllServiceTypes: vi.fn(() => Promise.reject(new Error('Network error')))
    };

    // Act
    render(ServiceTypeManagement, {
      props: { service: mockService }
    });

    // Assert error propagation
    await waitFor(() => {
      expect(screen.getByText(/failed to load service types/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    // Act - Retry
    const retryButton = screen.getByRole('button', { name: /retry/i });
    await fireEvent.click(retryButton);

    // Assert retry was attempted
    expect(mockService.getAllServiceTypes).toHaveBeenCalledTimes(2);
  });
});
```

## Test Utilities and Helpers

### Custom Matchers
```typescript
// tests/utils/matchers.ts
import { expect } from 'vitest';

interface CustomMatchers {
  toBeValidServiceType: () => void;
  toBeValidActionHash: () => void;
  toHaveProperTimestamps: () => void;
}

expect.extend<CustomMatchers>({
  toBeValidServiceType(received) {
    const isValid = received &&
      typeof received.id === 'string' &&
      typeof received.name === 'string' &&
      typeof received.status === 'string' &&
      received.createdAt instanceof Date &&
      received.updatedAt instanceof Date;

    return {
      pass: isValid,
      message: () => `expected ${received} to be a valid service type`
    };
  },

  toBeValidActionHash(received) {
    const isValid = received instanceof Uint8Array && received.length === 32;

    return {
      pass: isValid,
      message: () => `expected ${received} to be a valid ActionHash`
    };
  },

  toHaveProperTimestamps(received) {
    const hasTimestamps = received &&
      received.createdAt instanceof Date &&
      received.updatedAt instanceof Date &&
      received.createdAt <= received.updatedAt;

    return {
      pass: hasTimestamps,
      message: () => `expected ${received} to have proper timestamps`
    };
  }
});

declare global {
  namespace Vi {
    interface Assertion extends CustomMatchers {}
  }
}
```

### Test Data Factories
```typescript
// tests/utils/factories.ts
import type { ServiceType, Request, Offer } from '$lib/types';

export const createMockServiceType = (overrides: Partial<ServiceType> = {}): ServiceType => ({
  id: `service-${Math.random().toString(36).substr(2, 9)}`,
  name: 'Test Service Type',
  description: 'Test service type description',
  status: 'pending',
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
  ...overrides
});

export const createMockRequest = (overrides: Partial<Request> = {}): Request => ({
  id: `request-${Math.random().toString(36).substr(2, 9)}`,
  title: 'Test Request',
  description: 'Test request description',
  contactPreference: 'Email',
  timePreference: 'Morning',
  timeZone: 'UTC',
  interactionType: 'Virtual',
  links: [],
  serviceTypeHashes: [],
  mediumOfExchangeHashes: [],
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
  ...overrides
});

export const createMockOffer = (overrides: Partial<Offer> = {}): Offer => ({
  id: `offer-${Math.random().toString(36).substr(2, 9)}`,
  title: 'Test Offer',
  description: 'Test offer description',
  timePreference: 'Afternoon',
  timeZone: 'UTC',
  interactionType: 'In-Person',
  links: [],
  serviceTypeHashes: [],
  mediumOfExchangeHashes: [],
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
  ...overrides
});
```

### Mock Service Setup
```typescript
// tests/utils/mocks.ts
import { Effect as E } from 'effect';
import type { Record } from '@holochain/client';

export const createMockHolochainClientService = () => ({
  appId: 'test-app',
  client: null,
  isConnected: true,
  isConnecting: false,
  connectClient: vi.fn(),
  waitForConnection: vi.fn(() => Promise.resolve()),
  getAppInfo: vi.fn(),
  callZome: vi.fn(),
  callZomeRawEffect: vi.fn(),
  callZomeEffect: vi.fn(),
  verifyConnection: vi.fn(),
  getNetworkSeed: vi.fn(() => Promise.resolve('test-network-seed')),
  getNetworkInfo: vi.fn(() => Promise.resolve({
    networkSeed: 'test-network-seed',
    dnaHash: 'test-dna-hash',
    roleName: 'requests_and_offers'
  }))
});

export const createMockRecord = async (data: any = {}): Promise<Record> => ({
  signed_action: {
    hashed: {
      content: {
        type: 'Create',
        author: new Uint8Array(32),
        timestamp: Date.now() * 1000,
        action_seq: 0,
        prev_action: new Uint8Array(32),
        entry_type: {
          App: {
            entry_index: 0,
            zome_index: 0,
            visibility: 'Public'
          }
        },
        entry_hash: new Uint8Array(32)
      },
      hash: new Uint8Array(32)
    },
    signature: new Uint8Array(64),
    entry: {
      Present: {
        entry_type: 'App',
        entry: new Uint8Array(Buffer.from(JSON.stringify(data)))
      }
    }
  });

export const createMockServiceTypesService = () => ({
  createServiceType: vi.fn(),
  getServiceType: vi.fn(),
  getAllServiceTypes: vi.fn(),
  updateServiceType: vi.fn(),
  deleteServiceType: vi.fn(),
  linkToServiceType: vi.fn(),
  unlinkFromServiceType: vi.fn(),
  suggestServiceType: vi.fn(),
  approveServiceType: vi.fn(),
  rejectServiceType: vi.fn()
});
```

## Best Practices

### Test Organization
- **Descriptive Names**: Use `should[expectedBehavior]when[condition]` pattern
- **Arrange-Act-Assert**: Structure tests clearly with setup, execution, and verification
- **One Assertion Per Test**: Focus on single behavior per test
- **Test Isolation**: Ensure tests don't depend on each other

### Mocking Strategy
- **Mock External Dependencies**: Isolate tests from network, database, file system
- **Use Realistic Data**: Create representative test data with factories
- **Mock at Boundaries**: Mock at service layer, not implementation details
- **Consistent Mock Setup**: Use utilities for consistent mock creation

### Performance Considerations
- **Fast Unit Tests**: Keep individual tests under 100ms
- **Parallel Execution**: Use test runner's parallel capabilities
- **Selective Execution**: Run only relevant tests during development
- **Mock Heavy Operations**: Avoid expensive operations in tests

### Coverage Guidelines
- **Critical Paths**: 100% coverage for core user workflows
- **Business Logic**: ≥90% coverage for domain rules and validation
- **Error Handling**: Test all error paths and recovery scenarios
- **Integration Points**: Test all external service integrations

This comprehensive frontend testing approach ensures robust, maintainable components while providing excellent developer experience and confidence in code quality.