# Development Guidelines

Comprehensive coding standards and patterns for the Requests and Offers project, covering Effect-TS, Svelte 5, and component architecture.

## Effect-TS Development Patterns

### Decision Matrix

Use the following decision matrix to determine whether to use `Effect.gen` or `.pipe`:

- **Injecting/Retrieving Dependencies** → `Effect.gen`
- **Conditional Logic** → `Effect.gen`
- **Sequential Operations** → `Effect.gen`
- **Error Handling** → `.pipe`
- **Adding Tracing** → `.pipe`
- **Layer Building** → `.pipe`
- **Simple Transforms** → `.pipe`

### Core Principles

1. **Pure Effect-Native Services**: All domain services built entirely with Effect TS
2. **Dependency Injection**: Use `Context.Tag` and `Layer` for service dependencies
3. **Strategic Schema Usage**: Schema validation at business boundaries only
4. **Centralized Error Handling**: Domain-specific tagged errors
5. **Functional Composition**: Prefer composition over inheritance

### Service Layer Patterns

```typescript
// Effect-native service with dependency injection
export const ServiceExample =
  Context.GenericTag<ServiceExample>("ServiceExample");

export const makeServiceExample = Effect.gen(function* () {
  const client = yield* HolochainClientService;

  const createEntity = (input: CreateInput) =>
    Effect.gen(function* () {
      // Business logic with proper error handling
      const result = yield* client.callZome(/* ... */);
      return yield* Schema.decodeUnknown(EntitySchema)(result);
    }).pipe(Effect.mapError((error) => new DomainError({ cause: error })));

  return { createEntity };
});
```

## Svelte 5 Runes Standards

### Component Architecture

1. **Reactive State Management**: Use `$state`, `$derived`, `$effect`
2. **Prop Destructuring**: Extract props with proper defaults
3. **Accessibility First**: WCAG compliance and keyboard navigation
4. **Performance Optimization**: Minimize reactive dependencies

### Component Pattern Template

```svelte
<script lang="ts">
  import type { ComponentProps } from './types';

  // Props with defaults
  const {
    data = [],
    loading = false,
    onAction = () => {}
  }: ComponentProps = $props();

  // Reactive state
  let localState = $state({ filter: '', selected: null });

  // Derived values
  const filteredData = $derived(
    data.filter(item => item.name.includes(localState.filter))
  );

  // Effects for side effects
  $effect(() => {
    if (data.length > 0) {
      // Handle data changes
    }
  });
</script>

<div role="main" aria-label="Component description">
  <!-- Accessible markup with proper ARIA labels -->
</div>
```

### Reactivity Guidelines

1. **Minimize Dependencies**: Keep reactive expressions focused
2. **Avoid Nested Reactivity**: Flatten reactive chains when possible
3. **Use $effect Sparingly**: Prefer derived values over effects
4. **Batch State Updates**: Group related state changes

## Schema Validation Patterns

### Strategic Schema Usage

Use schemas at **business boundaries only**:

- **API responses** from Holochain zomes
- **User input validation** in forms
- **External system integration** points
- **Critical data transformations**

### Schema Definition Patterns

```typescript
// Entity schemas with proper error handling
export const EntitySchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String.pipe(Schema.minLength(1)),
  status: Schema.Literal("active", "inactive"),
  created_at: Schema.DateFromSelf,
  tags: Schema.Array(Schema.String).pipe(Schema.maxItems(10)),
});

// Input schemas for validation
export const CreateEntityInputSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(100)),
  description: Schema.optional(Schema.String),
  tags: Schema.optional(Schema.Array(Schema.String)),
});

// UI-specific schemas
export const UIEntitySchema = Schema.extend(
  EntitySchema,
  Schema.Struct({
    displayName: Schema.String,
    isEditable: Schema.Boolean,
  }),
);
```

### Validation Error Handling

```typescript
// Proper error context for schema validation
const validateInput = (input: unknown) =>
  Schema.decodeUnknown(CreateEntityInputSchema)(input).pipe(
    Effect.mapError(
      (error) =>
        new ValidationError({
          message: "Invalid input data",
          cause: error,
          context: "CreateEntity",
        }),
    ),
  );
```

## Component Patterns

### Composable Architecture

1. **Logic Extraction**: Extract business logic into composables
2. **Pure Functions**: Keep components pure when possible
3. **Dependency Injection**: Use Effect context for service dependencies
4. **Event-Driven Communication**: Use event bus for cross-component communication

### Composable Pattern

```typescript
// Composable for entity management
export const useEntityManager = () => {
  const entityService = yield * EntityService;
  const eventBus = yield * EventBusService;

  const createEntity = (input: CreateEntityInput) =>
    Effect.gen(function* () {
      const entity = yield* entityService.create(input);
      yield* eventBus.emit("entity.created", entity);
      return entity;
    });

  return { createEntity };
};
```

### Guard Pattern for Component Logic

```typescript
// Guard composable for access control
export const useAccessGuard = (requiredRole: Role) =>
  Effect.gen(function* () {
    const userService = yield* UserService;
    const currentUser = yield* userService.getCurrentUser();

    const hasAccess = currentUser.roles.includes(requiredRole);

    return {
      hasAccess,
      requireAccess: hasAccess
        ? Effect.unit
        : Effect.fail(new AccessDeniedError()),
    };
  });
```

## Code Quality Standards

### File Organization

```
src/lib/
├── components/           # UI components by feature
│   ├── shared/          # Reusable components
│   ├── [domain]/        # Domain-specific components
├── services/            # Effect-TS services
├── stores/              # Svelte stores with Effect integration
├── composables/         # Reusable component logic
├── schemas/             # Schema definitions
├── errors/              # Error definitions and contexts
└── utils/               # Pure utility functions
```

### Naming Conventions

- **Files**: kebab-case (`user-profile.svelte`)
- **Components**: PascalCase (`UserProfile`)
- **Services**: PascalCase with Service suffix (`UserService`)
- **Stores**: camelCase with Store suffix (`userProfileStore`)
- **Composables**: camelCase with use prefix (`useUserProfile`)
- **Types**: PascalCase (`UserProfile`, `CreateUserInput`)

### Documentation Requirements

1. **JSDoc Comments**: For all public APIs
2. **Type Definitions**: Export all public types
3. **Example Usage**: Include examples in complex components
4. **Accessibility Notes**: Document ARIA patterns and keyboard interactions

### Performance Guidelines

1. **Bundle Size**: Keep component bundles under reasonable limits
2. **Reactive Efficiency**: Minimize reactive computation overhead
3. **Memory Management**: Proper cleanup of effects and subscriptions
4. **Asset Optimization**: Optimize images and static assets

This consolidated guideline provides comprehensive development standards while reducing cognitive overhead from multiple files.
