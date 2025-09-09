# Domain Implementation Guide

**Implementation Status**: **100% standardized** 7-layer Effect-TS architecture across all core domains. Service Types domain serves as the complete architectural template.

**Current Domain Status**:

- ✅ **Service Types**: 100% complete - architectural template with all 9 helper functions
- ✅ **Requests**: 100% complete - all patterns successfully applied
- ✅ **Offers**: 100% complete - fully standardized implementation
- 🔄 **Users, Organizations, Administration**: Effect-based, pending standardization
- 🔄 **Medium of Exchange**: Effect-based, pending standardization

## 7-Layer Architecture Overview

Each domain implements the standardized architecture with:

1. **Service Layer**: Effect-native services with Context.Tag dependency injection
2. **Store Layer**: Factory functions with Svelte 5 Runes + 9 standardized helper functions
3. **Schema Validation**: Effect Schema at strategic business boundaries
4. **Error Handling**: Domain-specific tagged errors with centralized contexts (280+ contexts across 10 domains)
5. **Composables**: Component logic abstraction using Effect-based functions
6. **Components**: Svelte 5 + accessibility focus, using composables for business logic
7. **Testing**: Comprehensive Effect-TS coverage across all layers

**Key Implementation Patterns**:

- **Administration & Access Control**: Role-based permissions and capability tokens
- **Error Management**: Domain-specific tagged errors with rich context
- **Guard Patterns**: Access control and validation guards
- **Utility Patterns**: Avatar management and common domain utilities

## Administration Patterns

### Role-Based Access Control

The system uses comprehensive role-based access control with the following hierarchy:

- **Administrator**: Full system access, user management, critical operations
- **Moderator**: Content moderation, user support, community management
- **Creator**: Content creation, project management, collaboration features
- **Advocate**: Community engagement, promotion, networking features

### Access Control Implementation

```rust
// Zome-level access control
#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum UserRole {
    Administrator,
    Moderator,
    Creator,
    Advocate,
}

#[hdk_extern]
pub fn create_admin_only_resource(input: AdminResourceInput) -> ExternResult<ActionHash> {
    // Verify admin role before proceeding
    let agent_info = agent_info()?;
    let user_roles = get_user_roles(agent_info.agent_initial_pubkey)?;

    if !user_roles.contains(&UserRole::Administrator) {
        return Err(wasm_error!(WasmErrorInner::Guest(
            "Insufficient permissions: Administrator role required".to_string()
        )));
    }

    // Proceed with admin-only operation
    let resource_hash = create_entry(&EntryTypes::AdminResource(input.into()))?;
    Ok(resource_hash)
}
```

### Frontend Access Guard Pattern

```typescript
// Access guard composable for role-based UI
export const useAccessGuard = (requiredRole: UserRole) =>
  Effect.gen(function* () {
    const userService = yield* UserService;
    const currentUser = yield* userService.getCurrentUser();

    const hasAccess = currentUser.roles.includes(requiredRole);

    const requireAccess = hasAccess
      ? Effect.unit
      : Effect.fail(
          new AccessDeniedError({
            message: `${requiredRole} role required`,
            context: "AccessGuard",
            requiredRole,
            userRoles: currentUser.roles,
          }),
        );

    return {
      hasAccess,
      requireAccess,
      currentRoles: currentUser.roles,
      canAccess: (role: UserRole) => currentUser.roles.includes(role),
    };
  });

// Usage in components
export const useAdminGuard = () => useAccessGuard(UserRole.Administrator);
export const useModeratorGuard = () => useAccessGuard(UserRole.Moderator);
export const useCreatorGuard = () => useAccessGuard(UserRole.Creator);
```

### Capability Token Pattern

```typescript
// Capability-based access for sensitive operations
export const useCapabilityGuard = (requiredCapability: string) =>
  Effect.gen(function* () {
    const userService = yield* UserService;
    const capabilityService = yield* CapabilityService;

    const currentUser = yield* userService.getCurrentUser();
    const hasCapability = yield* capabilityService.hasCapability(
      currentUser.id,
      requiredCapability,
    );

    const requireCapability = hasCapability
      ? Effect.unit
      : Effect.fail(
          new InsufficientCapabilityError({
            message: `Capability '${requiredCapability}' required`,
            capability: requiredCapability,
            userId: currentUser.id,
          }),
        );

    return {
      hasCapability,
      requireCapability,
      grantCapability: (targetUserId: string) =>
        capabilityService.grantCapability(targetUserId, requiredCapability),
      revokeCapability: (targetUserId: string) =>
        capabilityService.revokeCapability(targetUserId, requiredCapability),
    };
  });
```

## Error Management Patterns

### Domain-Specific Tagged Errors

```typescript
// Domain error hierarchy
export class ServiceTypeError extends Data.TaggedError("ServiceTypeError")<{
  message: string;
  cause?: unknown;
  context?: string;
  serviceTypeId?: string;
}> {}

export class RequestError extends Data.TaggedError("RequestError")<{
  message: string;
  cause?: unknown;
  context?: string;
  requestId?: string;
  validationErrors?: ValidationError[];
}> {}

export class AccessDeniedError extends Data.TaggedError("AccessDeniedError")<{
  message: string;
  requiredRole?: UserRole;
  userRoles?: UserRole[];
  resource?: string;
}> {}

export class ValidationError extends Data.TaggedError("ValidationError")<{
  message: string;
  field?: string;
  value?: unknown;
  constraint?: string;
}> {}
```

### Error Context Management

```typescript
// Centralized error contexts for consistent error handling
export const ErrorContexts = {
  SERVICE_TYPE_CREATION: "ServiceType.Creation",
  SERVICE_TYPE_VALIDATION: "ServiceType.Validation",
  SERVICE_TYPE_RETRIEVAL: "ServiceType.Retrieval",
  REQUEST_CREATION: "Request.Creation",
  REQUEST_VALIDATION: "Request.Validation",
  USER_AUTHENTICATION: "User.Authentication",
  USER_AUTHORIZATION: "User.Authorization",
  HOLOCHAIN_COMMUNICATION: "Holochain.Communication",
  SCHEMA_VALIDATION: "Schema.Validation",
} as const;

// Error context transformation
export const transformErrorWithContext =
  <TError extends Data.TaggedError<any, any>>(context: string) =>
  (error: unknown): TError => {
    if (error instanceof Data.TaggedError) {
      return new (error.constructor as any)({
        ...error,
        context,
        originalContext: error.context,
      });
    }

    return new ServiceTypeError({
      message: error instanceof Error ? error.message : "Unknown error",
      cause: error,
      context,
    }) as TError;
  };

// Usage in service methods
export const createServiceType = (input: CreateServiceTypeInput) =>
  Effect.gen(function* () {
    // Validate input
    const validatedInput = yield* Schema.decodeUnknown(
      CreateServiceTypeInputSchema,
    )(input);

    // Call Holochain zome
    const result = yield* client.callZome({
      zome_name: "service_types_coordinator",
      fn_name: "create_service_type",
      payload: validatedInput,
    });

    // Transform result
    const serviceType = yield* Schema.decodeUnknown(ServiceTypeSchema)(result);
    return serviceType;
  }).pipe(
    Effect.mapError(
      transformErrorWithContext(ErrorContexts.SERVICE_TYPE_CREATION),
    ),
  );
```

### Error Recovery Strategies

```typescript
// Error recovery with fallback strategies
export const createEntityWithRecovery =
  <TInput, TEntity>(
    primaryCreate: (input: TInput) => Effect.Effect<TEntity, any>,
    fallbackCreate?: (input: TInput) => Effect.Effect<TEntity, any>,
  ) =>
  (input: TInput) =>
    Effect.gen(function* () {
      // Try primary creation method
      const primaryResult = yield* primaryCreate(input).pipe(
        Effect.catchAll((error) => {
          // Log primary failure
          yield *
            Effect.logWarning("Primary creation failed", { error, input });

          // Try fallback if available
          if (fallbackCreate) {
            return fallbackCreate(input);
          }

          // No fallback, propagate error
          return Effect.fail(error);
        }),
      );

      return primaryResult;
    });

// Retry with exponential backoff
export const withRetry = <T, E>(
  effect: Effect.Effect<T, E>,
  maxRetries = 3,
  baseDelay = 1000,
) =>
  effect.pipe(
    Effect.retry(
      Schedule.exponential(baseDelay, 2.0).pipe(
        Schedule.compose(Schedule.recurs(maxRetries)),
      ),
    ),
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* Effect.logError("Max retries exceeded", { error, maxRetries });
        return Effect.fail(error);
      }),
    ),
  );
```

## Guard Composable Patterns

### Input Validation Guards

```typescript
// Input validation guard with detailed error reporting
export const useInputValidationGuard =
  <TSchema>(schema: Schema.Schema<TSchema>) =>
  (input: unknown) =>
    Effect.gen(function* () {
      const validationResult = yield* Schema.decodeUnknown(schema)(input).pipe(
        Effect.mapError(
          (error) =>
            new ValidationError({
              message: "Input validation failed",
              cause: error,
              field: extractFieldFromError(error),
              value: input,
            }),
        ),
      );

      return validationResult;
    });

// Business rule validation guard
export const useBusinessRuleGuard =
  <TEntity>(
    rules: Array<(entity: TEntity) => Effect.Effect<boolean, ValidationError>>,
  ) =>
  (entity: TEntity) =>
    Effect.gen(function* () {
      // Run all validation rules
      const results = yield* Effect.all(
        rules.map((rule) => rule(entity)),
        { concurrency: "unbounded" },
      );

      // Check if all rules passed
      const allPassed = results.every((result) => result === true);

      if (!allPassed) {
        return yield* Effect.fail(
          new ValidationError({
            message: "Business rule validation failed",
            value: entity,
          }),
        );
      }

      return entity;
    });

// Usage example: Service type business rules
export const serviceTypeBusinessRules = [
  // Name must be unique
  (serviceType: ServiceType) =>
    Effect.gen(function* () {
      const existing = yield* serviceTypeService.getByName(serviceType.name);
      return existing === null;
    }).pipe(
      Effect.mapError(
        () =>
          new ValidationError({
            message: "Service type name must be unique",
            field: "name",
            value: serviceType.name,
            constraint: "unique",
          }),
      ),
    ),

  // Tags must not exceed maximum
  (serviceType: ServiceType) =>
    Effect.succeed(serviceType.tags.length <= 10).pipe(
      Effect.filterOrFail(
        (passed) => passed,
        () =>
          new ValidationError({
            message: "Maximum 10 tags allowed",
            field: "tags",
            value: serviceType.tags,
            constraint: "maxLength",
          }),
      ),
    ),
];
```

### State Transition Guards

```typescript
// State transition validation for entities with status
export const useStateTransitionGuard =
  <TStatus>(allowedTransitions: Record<TStatus, TStatus[]>) =>
  (currentStatus: TStatus, newStatus: TStatus) =>
    Effect.gen(function* () {
      const allowedNextStates = allowedTransitions[currentStatus] || [];
      const isValidTransition = allowedNextStates.includes(newStatus);

      if (!isValidTransition) {
        return yield* Effect.fail(
          new ValidationError({
            message: `Invalid state transition: ${currentStatus} -> ${newStatus}`,
            field: "status",
            value: newStatus,
            constraint: "validTransition",
          }),
        );
      }

      return { from: currentStatus, to: newStatus };
    });

// Request status transitions
export const requestStatusTransitions = {
  [RequestStatus.Draft]: [RequestStatus.Published, RequestStatus.Cancelled],
  [RequestStatus.Published]: [
    RequestStatus.InProgress,
    RequestStatus.Cancelled,
  ],
  [RequestStatus.InProgress]: [
    RequestStatus.Completed,
    RequestStatus.Cancelled,
  ],
  [RequestStatus.Completed]: [], // Terminal state
  [RequestStatus.Cancelled]: [], // Terminal state
};

export const useRequestStatusGuard = () =>
  useStateTransitionGuard(requestStatusTransitions);
```

## Avatar and Utility Patterns

### Avatar Management Pattern

```typescript
// Avatar service with image handling and validation
export const AvatarService = Context.GenericTag<AvatarService>("AvatarService");

export const makeAvatarService = Effect.gen(function* () {
  const storageService = yield* StorageService;
  const imageService = yield* ImageService;

  const uploadAvatar = (userId: string, imageFile: File) =>
    Effect.gen(function* () {
      // Validate image file
      yield* validateImageFile(imageFile);

      // Resize and optimize image
      const optimizedImage = yield* imageService.optimizeImage(imageFile, {
        maxWidth: 400,
        maxHeight: 400,
        quality: 0.8,
        format: "webp",
      });

      // Generate storage path
      const avatarPath = `avatars/${userId}/${Date.now()}.webp`;

      // Upload to storage
      const avatarUrl = yield* storageService.uploadFile(
        avatarPath,
        optimizedImage,
      );

      // Update user profile
      yield* userService.updateProfile(userId, { avatarUrl });

      return avatarUrl;
    }).pipe(
      Effect.mapError(
        (error) =>
          new AvatarError({
            message: "Failed to upload avatar",
            cause: error,
            userId,
          }),
      ),
    );

  const deleteAvatar = (userId: string) =>
    Effect.gen(function* () {
      const user = yield* userService.getUser(userId);

      if (user.avatarUrl) {
        // Delete from storage
        yield* storageService.deleteFile(user.avatarUrl);

        // Update user profile
        yield* userService.updateProfile(userId, { avatarUrl: null });
      }
    });

  const generateAvatarInitials = (name: string) =>
    Effect.sync(() => {
      const words = name.trim().split(/\s+/);
      const initials = words
        .slice(0, 2)
        .map((word) => word.charAt(0).toUpperCase())
        .join("");
      return initials || "?";
    });

  return {
    uploadAvatar,
    deleteAvatar,
    generateAvatarInitials,
  };
});

// Avatar component utilities
export const useAvatarDisplay = () => {
  const avatarService = yield * AvatarService;

  const getAvatarDisplay = (user: User) =>
    Effect.gen(function* () {
      if (user.avatarUrl) {
        return {
          type: "image" as const,
          src: user.avatarUrl,
          alt: `${user.name}'s avatar`,
        };
      }

      const initials = yield* avatarService.generateAvatarInitials(user.name);
      return {
        type: "initials" as const,
        initials,
        alt: `${user.name}'s initials`,
      };
    });

  return { getAvatarDisplay };
};
```

### Common Domain Utilities

```typescript
// Slug generation for URLs
export const generateSlug = (text: string) =>
  Effect.sync(
    () =>
      text
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "") // Remove special characters
        .replace(/\s+/g, "-") // Replace spaces with hyphens
        .replace(/-+/g, "-") // Remove duplicate hyphens
        .replace(/^-|-$/g, ""), // Remove leading/trailing hyphens
  );

// Tag normalization
export const normalizeTags = (
  tags: string[],
): Effect.Effect<string[], ValidationError> =>
  Effect.gen(function* () {
    const normalized = tags
      .map((tag) => tag.trim().toLowerCase())
      .filter((tag) => tag.length > 0)
      .filter((tag, index, array) => array.indexOf(tag) === index); // Remove duplicates

    if (normalized.length > 10) {
      return yield* Effect.fail(
        new ValidationError({
          message: "Maximum 10 tags allowed",
          field: "tags",
          value: tags,
          constraint: "maxLength",
        }),
      );
    }

    return normalized;
  });

// Date formatting utilities
export const formatDateForDisplay = (date: Date) =>
  Effect.sync(() => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return "Today";
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  });

// Text truncation with word boundaries
export const truncateText = (text: string, maxLength: number) =>
  Effect.sync(() => {
    if (text.length <= maxLength) {
      return text;
    }

    const truncated = text.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(" ");

    if (lastSpace > 0) {
      return truncated.substring(0, lastSpace) + "...";
    }

    return truncated + "...";
  });
```

This comprehensive domain implementation guide provides consistent patterns for access control, error management, validation, and common utilities across all domains in the application.
