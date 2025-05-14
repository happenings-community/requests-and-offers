---
description: How to write and update integration tests for the UI (SvelteKit, TypeScript, Effect TS) using Vitest.
---

# Workflow: Writing and Updating Integration Tests

This workflow standardizes how to add, update, and maintain integration tests for the UI codebase using Vitest, TypeScript, and Effect TS. Integration tests in this context verify the interaction between stores, services, and (mocked) backend boundaries, ensuring the system works as a whole.

---

## 1. Identify Integration Points
- Focus on testing the interaction between Svelte stores and Effect-based service layers.
- Prioritize flows that span multiple modules or involve cross-store/service logic.
- Use integration tests for scenarios that require multiple units working together (e.g., store updates after service calls, event bus interactions).

## 2. Locate or Create the Test File
- Integration tests are located in `ui/tests/integration/`.
- For a new feature, create a file named `<feature>.test.ts` (e.g., `requests.test.ts`).
- Use clear naming to indicate the integration scope (e.g., `requests.test.ts`, `offers.test.ts`).

## 3. Write the Test
- Use Vitest for test definitions: `describe`, `it`, `expect`.
- Mock dependencies that are not the focus of the integration (e.g., stores, services, backend calls) using `vi.mock`.
- Compose effectful logic with Effect TS (`runEffect`, `Effect.gen`, `pipe`).
- Arrange tests to:
  - Set up mocks and initial state in `beforeEach`.
  - Exercise the integration flow (e.g., call a store method that triggers a service and updates state).
  - Assert on final state, events, and side effects.
- Example:
  ```typescript
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { runEffect } from '$lib/utils/effect';
  import { requestsStore } from '$lib/stores/requests.store.svelte';
  import { mockEffectFnWithParams } from '../unit/effect';

  vi.mock('$lib/stores/organizations.store.svelte', () => ({
    default: { getAcceptedOrganizations: vi.fn(() => Promise.resolve([])) }
  }));

  describe('Requests Store-Service Integration', () => {
    beforeEach(() => {
      // Reset mocks and state
    });

    it('should create a request and update the store', async () => {
      await runEffect(requestsStore.createRequest(mockRequest));
      // assertions...
    });
  });
  ```

## 4. Run the Integration Tests
- In the `ui/` directory, run all integration tests:
  ```
  bun test:integration
  ```
- To run a specific integration test file:
  ```
  bun test:integration path/to/requests.test.ts
  ```
- Fix any failing tests before proceeding.

## 5. Update and Refactor Integration Tests
- Update tests to reflect changes in integration logic or APIs.
- Refactor for clarity and maintainability as flows evolve.
- Remove or rewrite obsolete tests when integration points change.

## 6. Maintain Shared Mocks and Helpers
- Place reusable mocks and helpers in `ui/tests/unit/fixtures/` or a shared helper file.
- Ensure all mocks are type-safe and up to date with service/store interfaces.

## 7. Document Test Scenarios
- Add comments for complex integration flows and edge cases.
- Update project documentation if new integration patterns or helpers are introduced.

## 8. Review and Commit
- Ensure all integration tests pass before committing.
- Use a descriptive commit message, e.g.:
  ```
  test(integration): add tests for offer-store/service flow
  ```

---

**References:**
- See `ui/tests/integration/` for examples.
- Project documentation: `documentation/guides/contributing.md`, `documentation/technical-specs.md`.
- Effect TS patterns: `.cursor/rules/effect-patterns.mdc`.
- Svelte 5 and TypeScript standards: `.cursor/rules/svelte-5-coding-standards.mdc`.
