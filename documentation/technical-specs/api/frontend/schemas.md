# Frontend Schema Validation API

Effect Schema validation system for type-safe data validation across all layers.

## Schema Architecture

Strategic validation boundaries using Effect Schema for input validation, data transformation, and type safety.

### Base Schema Patterns

```typescript
import { Schema } from "@effect/schema";

// Entity schemas
export const EntityStatusSchema = Schema.Union(
  Schema.Literal("pending"),
  Schema.Literal("approved"),
  Schema.Literal("rejected"),
);

export const BaseEntitySchema = Schema.Struct({
  name: Schema.String,
  description: Schema.String,
  status: EntityStatusSchema,
});

// Input schemas with validation
export const CreateEntityInputSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.minLength(1)),
  description: Schema.String.pipe(Schema.minLength(1)),
});

// UI entity schemas (includes UI-specific fields)
export const UIEntitySchema = BaseEntitySchema.extend(
  Schema.Struct({
    hash: Schema.String, // ActionHash
    createdAt: Schema.Date,
  }),
);
```

## Domain Schemas

### Service Type Schemas

**File**: `ui/src/lib/schemas/service-type.schemas.ts`

Complete schema definitions for service type validation and transformation.

### Request Schemas

**File**: `ui/src/lib/schemas/request.schemas.ts`

Request-specific schemas with proper validation boundaries.

### Common Schemas

**File**: `ui/src/lib/schemas/common.schemas.ts`

```typescript
// Shared schemas used across domains
export const TimePreferenceSchema = Schema.Union(
  Schema.Literal("asap"),
  Schema.Literal("flexible"),
  Schema.Literal("specific"),
);

export const InteractionTypeSchema = Schema.Union(
  Schema.Literal("in-person"),
  Schema.Literal("remote"),
  Schema.Literal("hybrid"),
);
```

## Validation Integration

### Service Layer Validation

Schemas integrate with services for input/output validation and type safety.

### Store Layer Validation

Strategic validation at store boundaries for data integrity.

This schema system provides comprehensive type safety and validation across the application.
