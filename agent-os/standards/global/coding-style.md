## Coding Style Best Practices

This project uses multiple languages and frameworks. Follow these patterns to maintain consistency across the entire codebase.

### General Principles

- **Consistent Naming Conventions**: Establish and follow naming conventions for variables, functions, classes, and files across the codebase
- **Automated Formatting**: Maintain consistent code style (indenting, line breaks, etc.) using configured tools
- **Meaningful Names**: Choose descriptive names that reveal intent; avoid abbreviations and single-letter variables except in narrow contexts
- **Small, Focused Functions**: Keep functions small and focused on a single task for better readability and testability
- **Consistent Indentation**: Use consistent indentation (spaces or tabs) and configure your editor/linter to enforce it
- **Remove Dead Code**: Delete unused code, commented-out blocks, and imports rather than leaving them as clutter
- **Backward Compatibility Only When Required**: Unless specifically instructed otherwise, assume you do not need to write additional code logic to handle backward compatibility
- **DRY Principle**: Avoid duplication by extracting common logic into reusable functions or modules

### TypeScript / JavaScript Patterns

#### Effect-TS Functional Programming
```typescript
// ✅ Preferred: Use Effect.pipe for composition
const result = pipe(
  getServiceType(hash),
  Effect.mapError((error) => new ServiceTypeError({ cause: error, context: 'get_service_type' })),
  Effect.tap((serviceType) => Effect.log(`Retrieved service type: ${serviceType.name}`))
);

// ❌ Avoid: Nested then chains
const result = getServiceType(hash)
  .then(serviceType => {
    console.log(`Retrieved service type: ${serviceType.name}`);
    return serviceType;
  })
  .catch(error => {
    throw new ServiceTypeError({ cause: error, context: 'get_service_type' });
  });
```

#### Error Handling Patterns
```typescript
// ✅ Preferred: Tagged errors with context
export class ServiceTypeError extends Data.TaggedError('ServiceTypeError')<{
  readonly cause: unknown;
  readonly context: string;
  readonly timestamp: number;
}> {}

// ❌ Avoid: Generic error types
throw new Error('Something went wrong');
```

#### Service and Context Patterns
```typescript
// ✅ Preferred: Context.Tag for dependency injection
export class ServiceTypesServiceTag extends Context.Tag('ServiceTypesService')<
  ServiceTypesServiceTag,
  ServiceTypesService
>() {}

// ❌ Avoid: Direct instantiation
const service = new ServiceTypesService();
```

#### Schema Validation
```typescript
// ✅ Preferred: Effect Schema validation
export const CreateServiceTypeInputSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.minLength(1)),
  description: Schema.optional(Schema.String)
});

// ❌ Avoid: Manual validation without typing
function validateInput(input: any) {
  return input.name && input.name.length > 0;
}
```

### Svelte 5 Patterns

#### Runes and Reactive State
```typescript
// ✅ Preferred: Svelte 5 Runes
const serviceTypes: UIServiceType[] = $state([]);
const loading: boolean = $state(false);
const approvedCount = $derived(() => approvedServiceTypes.length);

// ❌ Avoid: Legacy Svelte stores
import { writable, derived } from 'svelte/store';
const serviceTypes = writable([]);
const loading = writable(false);
const approvedCount = derived(approvedServiceTypes, $approved => $approved.length);
```

#### Component Patterns
```svelte
<!-- ✅ Preferred: Modern Svelte 5 syntax -->
<script>
  let { data, children } = $props();

  const count = $state(0);
  const doubled = $derived(() => count * 2);

  function increment() {
    count++;
  }
</script>

<button onclick={increment}>
  Count: {doubled}
</button>

{@render children()}
```

#### Event Handling
```typescript
// ✅ Preferred: Type-safe event handlers with proper error handling
const handleClick = async (event: MouseEvent) => {
  event.preventDefault();

  await Effect.runPromise(
    pipe(
      service.createServiceType(input),
      Effect.catchAll((error) => {
        setError(error.message);
        return Effect.void;
      })
    )
  );
};

// ❌ Avoid: Untyped event handlers
function handleClick(event) {
  service.createServiceType(input)
    .catch(error => setError(error.message));
}
```

### Rust / Holochain Patterns

#### Function and Variable Naming
```rust
// ✅ Preferred: snake_case for functions and variables
fn create_service_type(service_type: ServiceType) -> ExternResult<Record> {
    let mut service_type_with_metadata = service_type;
    service_type_with_metadata.created_at = sys_time()?;

    create_entry(&EntryTypesApp::ServiceType(service_type_with_metadata))
}

// ❌ Avoid: camelCase or inconsistent naming
fn createServiceType(serviceType: ServiceType) -> ExternResult<Record> {
    // ...
}
```

#### Error Handling
```rust
// ✅ Preferred: Use Result and proper error propagation
#[hdk_extern]
pub fn get_service_type(original_action_hash: ActionHash) -> ExternResult<Option<Record>> {
    match get_latest_record(original_action_hash) {
        Ok(record) => Ok(record),
        Err(e) => Err(WasmError::Guest(e.to_string())),
    }
}

// ❌ Avoid: Panic or unwrap without proper handling
#[hdk_extern]
pub fn get_service_type(original_action_hash: ActionHash) -> ExternResult<Option<Record>> {
    Ok(get_latest_record(original_action_hash).unwrap())
}
```

#### Struct and Enum Definitions
```rust
// ✅ Preferred: Clear, descriptive names with documentation
/// Represents the status of a service type in the approval workflow
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum ServiceTypeStatus {
    /// Service type is pending approval
    Pending,
    /// Service type has been approved and is active
    Approved,
    /// Service type has been rejected
    Rejected,
}

// ❌ Avoid: Unclear or abbreviated names
#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum Status {
    P,
    A,
    R,
}
```

### File and Directory Organization

#### Naming Conventions
```
# ✅ Preferred: Consistent naming patterns
src/
├── lib/
│   ├── services/
│   │   ├── serviceTypes.service.ts
│   │   ├── holochainClient.service.svelte.ts
│   │   └── cache.service.svelte.ts
│   ├── stores/
│   │   ├── serviceTypes.store.svelte.ts
│   │   ├── offers.store.svelte.ts
│   │   └── users.store.svelte.ts
│   └── types/
│       ├── ui/
│       │   └── serviceTypes.ts
│       └── holochain/
│           └── serviceTypes.ts

# ❌ Avoid: Inconsistent naming
src/
├── lib/
│   ├── services/
│   │   ├── ServiceTypes.ts
│   │   ├── holochainClient.ts
│   │   └── CacheService.ts
│   ├── stores/
│   │   ├── serviceTypesStore.ts
│   │   ├── offersStore.ts
│   │   └── userStore.ts
```

#### Import Organization
```typescript
// ✅ Preferred: Organized imports with clear grouping
// External dependencies
import { Context, Layer, Effect as E } from 'effect';
import type { ActionHash, Record } from '@holochain/client';

// Internal dependencies (lib)
import { HolochainClientServiceTag } from '$lib/services/HolochainClientService.svelte';
import type { ServiceTypeInDHT } from '$lib/types/holochain';

// Local dependencies
import { createUIServiceType } from './helpers';
import { SERVICE_TYPE_CONTEXTS } from './constants';

// ❌ Avoid: Disorganized imports
import { Context, Layer, Effect as E, pipe } from 'effect';
import type { ActionHash, Record } from '@holochain/client';
import { HolochainClientServiceTag } from '$lib/services/HolochainClientService.svelte';
import type { ServiceTypeInDHT } from '$lib/types/holochain';
import { createUIServiceType } from './helpers';
import { SERVICE_TYPE_CONTEXTS } from './constants';
```

### Commenting and Documentation

#### Code Documentation
```typescript
// ✅ Preferred: JSDoc with proper typing and examples
/**
 * Creates a new service type with validation and caching
 * @param input - The service type data to create
 * @returns Effect that resolves to the created Record or fails with ServiceTypeError
 *
 * @example
 * ```typescript
 * const result = await Effect.runPromise(
 *   createServiceType({ name: 'Test Service', description: 'A test' })
 * );
 * ```
 */
const createServiceType = (input: CreateServiceTypeInput): E.Effect<Record, ServiceTypeError> =>
  pipe(/* implementation */);

// ❌ Avoid: Unclear or missing documentation
const createServiceType = (input) => {
  // Creates a service type
  return pipe(/* implementation */);
};
```

#### Rust Documentation
```rust
// ✅ Preferred: Comprehensive rustdoc comments
/// Creates a new service type entry in the DHT
///
/// # Arguments
///
/// * `service_type` - The service type data to create
///
/// # Returns
///
/// Returns a `Record` representing the created entry, or an error if creation fails
///
/// # Examples
///
/// ```
/// let service_type = ServiceType {
///     name: "Web Development".to_string(),
///     description: Some("Web development services".to_string()),
///     created_at: sys_time()?,
///     status: ServiceTypeStatus::Pending,
/// };
///
/// let record = create_service_type(service_type)?;
/// ```
#[hdk_extern]
pub fn create_service_type(service_type: ServiceType) -> ExternResult<Record> {
    // implementation
}
```

### Configuration Files

#### TypeScript Configuration
```json
// tsconfig.json - Strict typing enabled
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

#### ESLint Configuration
```json
// .eslintrc.json
{
  "extends": [
    "@typescript-eslint/recommended",
    "plugin:svelte/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "prefer-const": "error",
    "no-var": "error"
  }
}
```

### Testing Patterns

#### Test Organization
```typescript
// ✅ Preferred: Clear test structure with descriptive names
describe('ServiceTypesStore', () => {
  describe('createServiceType', () => {
    it('should create service type successfully when input is valid', async () => {
      // Test implementation
    });

    it('should return error when input validation fails', async () => {
      // Test implementation
    });
  });
});

// ❌ Avoid: Unclear test names and structure
describe('ServiceTypesStore', () => {
  it('should work', async () => {
    // Test implementation
  });
});
```

By following these coding style patterns, we ensure consistency, maintainability, and readability across all languages and frameworks used in this project.
