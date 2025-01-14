# Playwright Test Implementation Plan

This document outlines the plan for implementing end-to-end testing using Playwright for the Requests and Offers Holochain application.

## 1. Initial Setup

Install Playwright and its dependencies:

```bash
npm init playwright@latest
```

This will:

- Add Playwright dependencies
- Create `playwright.config.ts`
- Set up initial test structure
- Add test scripts to package.json

## 2. Test Structure

``` bash
ui/
├── tests/
│   ├── e2e/
│   │   ├── auth/
│   │   │   └── login.spec.ts
│   │   ├── organizations/
│   │   │   ├── create.spec.ts
│   │   │   ├── edit.spec.ts
│   │   │   ├── members.spec.ts
│   │   │   └── coordinators.spec.ts
│   │   ├── requests/
│   │   │   ├── create.spec.ts
│   │   │   ├── status.spec.ts
│   │   │   └── list.spec.ts
│   │   ├── offers/
│   │   │   ├── create.spec.ts
│   │   │   ├── status.spec.ts
│   │   │   └── list.spec.ts
│   │   ├── admin/
│   │   │   ├── users.spec.ts
│   │   │   └── organizations.spec.ts
│   │   └── routes/
│   │       ├── app.spec.ts
│   │       └── admin.spec.ts
│   ├── fixtures/
│   │   ├── test-users.ts
│   │   ├── test-organizations.ts
│   │   └── test-data.ts
│   └── utils/
│       ├── test-helpers.ts
│       └── mock-holochain.ts
│       └── holochain-services.ts
```

## 3. Test Scenarios Priority Order

### Phase 1: Core User Flows

1. **User Management**
   - User registration
   - Profile creation/editing
   - Login/Authentication

2. **Organization Management**
   - Create organization
   - Edit organization details
   - Add/remove members
   - Add/remove coordinators

3. **Basic Request/Offer Flow**
   - Create request
   - Create offer
   - View requests/offers list
   - Update request/offer status

### Phase 2: Administrative Features

1. **Admin Panel**
   - User management
   - Organization management
   - System-wide requests/offers view

2. **Advanced Features**
   - Status history tracking
   - Organization hierarchies
   - Advanced filtering and search

## 4. Test Implementation Guidelines

### Setup Fixtures

```typescript
// fixtures/test-data.ts
import type { 
  UIUser, 
  UIOrganization, 
  UserType, 
  StatusType, 
  OrganizationRole 
} from '$types/ui';
import type { ActionHash, AgentPubKey } from '@holochain/client';

export const testUsers: Record<string, UIUser> = {
  creator: {
    name: 'Test Creator',
    nickname: 'creator_test',
    email: 'creator@example.com',
    user_type: 'creator',
    skills: ['software', 'design'],
    status: {
      status_type: 'pending'
    },
    organizations: [],
    role: OrganizationRole.Member
  },
  advocate: {
    name: 'Test Advocate',
    nickname: 'advocate_test', 
    email: 'advocate@example.com',
    user_type: 'advocate',
    skills: ['marketing', 'communication'],
    status: {
      status_type: 'accepted'
    },
    organizations: [],
    role: OrganizationRole.Coordinator
  }
};

export const testOrganizations: Record<string, UIOrganization> = {
  standard: {
    name: 'Test Organization',
    description: 'A comprehensive test organization',
    email: 'org@example.com',
    location: 'Global',
    urls: ['https://example.com'],
    members: [],
    coordinators: [],
    status: {
      status_type: 'pending'
    }
  },
  complex: {
    name: 'Complex Test Org',
    description: 'Organization with multiple scenarios',
    email: 'complex@example.com',
    location: 'Distributed',
    urls: ['https://complex.org'],
    members: [],
    coordinators: [],
    status: {
      status_type: 'accepted',
      reason: 'Verified test organization'
    }
  }
};

// Playwright custom fixture
import { test as base } from '@playwright/test';

export const test = base.extend({
  // Holochain-specific mock client
  mockHolochainClient: async ({}, use) => {
    const mockClient = {
      createUser: async (userData: UIUser) => {
        // Simulate Holochain zome call
        return { 
          success: true, 
          actionHash: 'mock-action-hash' as ActionHash 
        };
      },
      createOrganization: async (orgData: UIOrganization) => {
        // Simulate Holochain zome call
        return { 
          success: true, 
          actionHash: 'mock-org-hash' as ActionHash 
        };
      },
      // Add more mock methods matching zome functions
    };
    
    await use(mockClient);
  }
});
```

### Example Test Structure

```typescript
// organizations/create.spec.ts
import { test, expect } from '@playwright/test';
import { testUsers } from '../fixtures/test-users';

test.describe('Organization Creation', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: Login, mock Holochain client if needed
  });

  test('should create a new organization successfully', async ({ page }) => {
    // Test implementation
  });

  test('should validate required fields', async ({ page }) => {
    // Test implementation
  });
});
```

## 5. Holochain-Specific Considerations

1. **Mock Holochain Client**
   - Create mock implementations of Holochain zome calls
   - Simulate network conditions and responses
   - Handle DNA/Cell initialization

2. **Test Environment**
   - Setup test conductor configuration
   - Handle test data cleanup between tests
   - Manage test agent keys and identities

## 6. CI/CD Integration

### GitHub Actions Configuration

```yaml
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Install dependencies
      - run: npm ci
      - name: Install Playwright browsers
        run: npx playwright install --with-deps
      - name: Run Playwright tests
        run: npm run test:e2e
```

## 7. Implementation Steps

### Week 1: Setup and Basic Tests

- Install and configure Playwright
- Set up test structure
- Implement basic auth tests
- Create common test utilities

### Week 2: Core Feature Tests

- Organization management tests
- Basic request/offer flow tests
- Setup test fixtures and helpers

### Week 3: Advanced Features

- Admin panel tests
- Complex workflows
- Edge cases and error scenarios

### Week 4: Polish and CI/CD

- Setup CI/CD pipeline
- Performance testing
- Documentation
- Code review and refinement

## 8. Best Practices

### Test Organization

- Use page objects for common UI interactions
- Implement reusable test utilities
- Maintain clear test descriptions

### Data Management

- Clean test data between runs
- Use unique identifiers for test data
- Implement proper test isolation

### Performance

- Run tests in parallel when possible
- Optimize test setup and teardown
- Use proper waiting strategies

## 9. Type-Driven Testing

### Type-Specific Test Fixtures

```typescript
// fixtures/test-data.ts
import type { 
  UIUser, 
  UIOrganization, 
  UserType, 
  StatusType, 
  OrganizationRole 
} from '$types/ui';
import type { ActionHash, AgentPubKey } from '@holochain/client';

export const testUsers: Record<string, UIUser> = {
  creator: {
    name: 'Test Creator',
    nickname: 'creator_test',
    email: 'creator@example.com',
    user_type: 'creator',
    skills: ['software', 'design'],
    status: {
      status_type: 'pending'
    },
    organizations: [],
    role: OrganizationRole.Member
  },
  advocate: {
    name: 'Test Advocate',
    nickname: 'advocate_test', 
    email: 'advocate@example.com',
    user_type: 'advocate',
    skills: ['marketing', 'communication'],
    status: {
      status_type: 'accepted'
    },
    organizations: [],
    role: OrganizationRole.Coordinator
  }
};

export const testOrganizations: Record<string, UIOrganization> = {
  standard: {
    name: 'Test Organization',
    description: 'A comprehensive test organization',
    email: 'org@example.com',
    location: 'Global',
    urls: ['https://example.com'],
    members: [],
    coordinators: [],
    status: {
      status_type: 'pending'
    }
  },
  complex: {
    name: 'Complex Test Org',
    description: 'Organization with multiple scenarios',
    email: 'complex@example.com',
    location: 'Distributed',
    urls: ['https://complex.org'],
    members: [],
    coordinators: [],
    status: {
      status_type: 'accepted',
      reason: 'Verified test organization'
    }
  }
};
```

### Test Scenario Types

1. **User Management Tests**
   - Validate user creation with different `UserType`
   - Test status transitions (`pending`, `accepted`, `rejected`)
   - Verify organization role assignments

2. **Organization Management Tests**
   - Create organizations with various configurations
   - Test member and coordinator management
   - Validate organization status changes

3. **Status and Revision Tracking**
   - Test status history recording
   - Verify action hash tracking
   - Check revision timestamp functionality

### Type-Driven Test Strategies

- Use TypeScript's type system to ensure test data integrity
- Create exhaustive test cases covering all possible type variations
- Leverage `Record<string, Type>` for comprehensive test scenarios
- Mock Holochain client with type-safe return values

### Performance and Edge Case Testing

- Test with maximum/minimum values for each type
- Validate type conversion and serialization
- Check boundary conditions in status and user management
- Simulate network and DHT interaction scenarios

### Recommended Test Coverage

1. **100% Type Coverage**
   - Test every possible value of enum types
   - Cover all optional and required fields
   - Validate type constraints

2. **State Transition Tests**
   - Track all possible state changes
   - Verify action and previous action hash logic
   - Test status history accumulation

3. **Error Handling**
   - Simulate invalid type inputs
   - Test error scenarios with incomplete data
   - Validate type-level error prevention

## 10. Holochain Service Testing

### Zome Service Mocks

```typescript
// fixtures/holochain-services.ts
import type { ActionHash, Link, Record, AgentPubKey } from '@holochain/client';
import type { OrganizationInDHT, StatusInDHT } from '@/types/holochain';
import { AdministrationEntity } from '@/types/holochain';

export const mockOrganizationsService = {
  createOrganization: async (organization: OrganizationInDHT): Promise<Record> => {
    return {
      signed_action: {
        hashed: {
          hash: 'test-hash' as ActionHash,
          content: {
            author: 'test-author' as AgentPubKey,
            timestamp: Date.now() * 1000,
            action_seq: 0,
            prev_action: null,
            action: organization
          }
        }
      },
      entry: organization
    } as Record;
  },
  
  getAllOrganizationsLinks: async (): Promise<Link[]> => {
    return [
      {
        target: 'test-target' as ActionHash,
        author: 'test-author' as AgentPubKey,
        timestamp: Date.now() * 1000,
        tag: 'test-tag'
      }
    ];
  }
};

export const mockAdministrationService = {
  getAllUsersLinks: async (): Promise<Link[]> => {
    return [
      {
        target: 'test-target' as ActionHash,
        author: 'test-author' as AgentPubKey,
        timestamp: Date.now() * 1000,
        tag: 'test-tag'
      }
    ];
  },
  
  registerAdministrator: async (
    entity: AdministrationEntity,
    entity_original_action_hash: ActionHash,
    agent_pubkeys: AgentPubKey[]
  ): Promise<boolean> => {
    return true;
  }
};
```

### Route-Specific Test Scenarios

1. **App Routes Testing**

   ```typescript
   // tests/e2e/routes/app.spec.ts
   import { test, expect } from '@playwright/test';
   import { testUsers, testOrganizations } from '../fixtures/test-data';
   
   test.describe('App Routes', () => {
     test('should navigate through main app routes', async ({ page }) => {
       // Test navigation
       await page.goto('/');
       await page.goto('/organizations');
       await page.goto('/offers');
       await page.goto('/requests');
       
       // Verify navigation state
       expect(page.url()).toContain('/requests');
     });
   });
   ```

2. **Admin Routes Testing**

   ```typescript
   // tests/e2e/routes/admin.spec.ts
   test.describe('Admin Routes', () => {
     test('should manage administrators', async ({ page }) => {
       await page.goto('/admin/administrators');
       // Test admin functionalities
     });
   });
   ```

### SvelteKit-Specific Testing

1. **Layout Testing**
   - Test shared layout components
   - Verify navigation guards
   - Check error boundaries

2. **Store Testing**

   ```typescript
   // tests/e2e/stores/user-store.spec.ts
   test.describe('User Store', () => {
     test('should update user state', async ({ page }) => {
       // Test store updates
     });
   });
   ```

### Test Environment Setup

```typescript
// playwright.config.ts
import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' }
    }
  ]
};

export default config;
```

### Test Commands

Add to `package.json`:

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug"
  }
}
