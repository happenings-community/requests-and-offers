---
trigger: model_decision
description: Guideline for working with tests
globs: 
---
# Testing Guidelines

## Unit Testing Philosophy

1. **Focus on public APIs** - Test the behavior from a consumer's perspective, not implementation details
2. **Isolation** - Tests should be isolated, with no dependencies on external services or system state
3. **Predictability** - Tests should produce consistent results on every run
4. **Readability** - Tests should be easy to understand and maintain

## Test Structure

Use the standard Vitest pattern:

```typescript
describe('Component or Module Name', () => {
  beforeEach(() => {
    // Setup code
  });

  afterEach(() => {
    // Cleanup code
  });

  it('should do something specific', () => {
    // Arrange
    // Act
    // Assert
  });
});
```

## Testing With Effect TS

Effect-based code requires special testing approaches:

1. **Use `mockEffectFn` and `mockEffectFnWithParams`** to create testable Effects
2. **Use `runEffect(effect)` to execute Effects** in tests (provides better error messages than Effect.runPromise)
3. **Use `Effect.provide()` to inject dependencies** needed by the Effect

Example:

```typescript
// Creates a mockable Effect-based function with parameter tracking
const mockFunction = mockEffectFnWithParams(vi.fn((param) => Promise.resolve(value)));

// Test with dependency injection
const result = await runEffect(
  Effect.provide(
    effectToTest,
    mockLayer
  )
);
```

## Testing with EventBus

When testing code that uses the EventBus:

1. **Create a MockEventBus** instance in tests
2. **Provide the MockEventBus layer** to Effects that use the EventBus
3. **Use emitHistory to verify events** that should have been emitted

Example:

```typescript
// In your test
const mockEventBus = createMockEventBus<StoreEvents>();

// Call the function with the MockEventBus layer
await runEffect(
  Effect.provide(
    store.someFunction(params),
    mockEventBus.mockLayer
  )
);

// Verify events were emitted
expect(mockEventBus.emitHistory.length).toBe(1);
expect(mockEventBus.emitHistory[0].event).toBe('expected:event');
expect(mockEventBus.emitHistory[0].payload).toHaveProperty('expected_property');
```

- the backend tests are located in `tests/src/requests_and_offers`
  - The command to run them are in [package.json](mdc:package.json).
- The frontend test are located in `ui/src/tests`
  - The command to run them is `bun test:unit` in the `ui/` directory.
