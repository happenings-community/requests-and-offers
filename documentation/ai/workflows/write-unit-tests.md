---
description: How to write and update unit tests for the UI (SvelteKit, TypeScript, Effect TS) using Vitest.
---

# Workflow: Writing and Updating Unit Tests

This workflow standardizes how to add, update, and maintain unit tests for the UI codebase using Vitest, TypeScript, and Effect TS. It ensures tests are robust, maintainable, and follow project conventions.

---

## 1. Identify What to Test

- Focus on pure functions, store logic, utilities, and component behavior.
- Prioritize new features, bug fixes, and areas with recent changes.
- Review `src/lib/stores/`, `src/lib/utils/`, and `src/lib/components/` for code needing coverage.

## 2. Locate or Create the Test File

- Unit tests are located in `ui/tests/unit/` and feature subfolders (e.g., `ui/tests/unit/stores/`).
- For a new module, create a test file named `<module>.test.ts` in the relevant subdirectory.
- For shared helpers, use the `fixtures/` and `test-helpers.ts` files.

## 3. Write the Test

- Use Vitest for test definitions: `describe`, `it`, `expect`.
- Use Effect TS for effectful logic, following project patterns (`Effect.gen`, `pipe`, etc.).
- Mock dependencies using `vi.mock` as needed.
- Use TypeScript strict mode and project aliases (`$lib/`, not `@/`).
- Structure tests for clarity:
  - Group related tests with `describe`.
  - Use clear, descriptive test names.
  - Reset mocks and state in `beforeEach` where required.
- Example:

  ```typescript
  import { describe, it, expect, vi } from 'vitest';
  import { myFunction } from '$lib/utils/myFunction';

  describe('myFunction', () => {
    it('should return the correct value', () => {
      expect(myFunction(2)).toBe(4);
    });
  });
  ```

## 4. Run the Tests

- In the `ui/` directory, run all unit tests:

  ```
  bun test:unit
  ```

- To run a specific test file:

  ```
  bun test:unit path/to/file.test.ts
  ```

- Fix any failing tests before proceeding.

## 5. Update and Refactor Tests

- When updating code, update corresponding tests to reflect new logic or API changes.
- Refactor tests for readability and maintainability as code evolves.
- Remove tests for deleted or deprecated features.

## 6. Maintain Test Utilities and Fixtures

- Add or update shared mocks in `fixtures/` or `test-helpers.ts` for reusable test data and helpers.
- Ensure mocks and helpers are type-safe and documented.

## 7. Document Test Scenarios

- For complex modules, add comments describing test scenarios and edge cases.
- Update project documentation if new testing approaches or utilities are introduced.

## 8. Review and Commit

- Ensure all tests pass before committing.
- Use a descriptive commit message, e.g.:

  ```
  test(stores): add unit tests for new request logic
  ```

---

**References:**

- See `ui/tests/unit/` for examples.
- Project documentation: `documentation/guides/contributing.md`, `documentation/technical-specs.md`.
- Effect TS patterns: `.cursor/rules/effect-patterns.mdc`.
- Svelte 5 and TypeScript standards: `.cursor/rules/svelte-5-coding-standards.mdc`.
