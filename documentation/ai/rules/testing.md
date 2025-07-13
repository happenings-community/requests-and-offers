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

## Test Commands

**All tests now require the Nix development environment due to hREA DNA integration.**

### Frontend Tests

```bash
# Unit tests (requires Nix environment)
nix develop --command bun test:unit

# Integration tests (requires Nix environment)  
nix develop --command bun test:integration
```

### Backend Tests

```bash
# Tryorama tests (requires Nix environment)
nix develop --command bun test
```

**Note:** The hREA integration requires access to the hREA DNA, which is only available within the Nix development
environment. All test commands must be prefixed with `nix develop --command` to ensure proper dependency access.

## Test Organization

- Backend tests are located in `tests/src/requests_and_offers`
- Frontend tests are located in `ui/tests/`
    - Unit tests: `ui/tests/unit/`
    - Integration tests: `ui/tests/integration/`
