# Domain Implementation: Error Management

## Tagged Error Hierarchy

```ts
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

## Error Contexts and Transformation

```ts
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

export const transformErrorWithContext =
  <TError extends Data.TaggedError<any, any>>(context: string) =>
  (error: unknown): TError => {
    if (error instanceof Data.TaggedError) {
      return new (error.constructor as any)({
        ...error,
        context,
        originalContext: (error as any).context,
      });
    }

    return new ServiceTypeError({
      message: error instanceof Error ? error.message : "Unknown error",
      cause: error,
      context,
    }) as TError;
  };

export const createServiceType = (input: CreateServiceTypeInput) =>
  Effect.gen(function* () {
    const validatedInput = yield* Schema.decodeUnknown(
      CreateServiceTypeInputSchema,
    )(input);

    const result = yield* client.callZome({
      zome_name: "service_types_coordinator",
      fn_name: "create_service_type",
      payload: validatedInput,
    });

    const serviceType = yield* Schema.decodeUnknown(ServiceTypeSchema)(result);
    return serviceType;
  }).pipe(
    Effect.mapError(
      transformErrorWithContext(ErrorContexts.SERVICE_TYPE_CREATION),
    ),
  );
```

## Recovery Strategies

```ts
export const createEntityWithRecovery =
  <TInput, TEntity>(
    primaryCreate: (input: TInput) => Effect.Effect<TEntity, any>,
    fallbackCreate?: (input: TInput) => Effect.Effect<TEntity, any>,
  ) =>
  (input: TInput) =>
    Effect.gen(function* () {
      const primaryResult = yield* primaryCreate(input).pipe(
        Effect.catchAll((error) => {
          yield* Effect.logWarning("Primary creation failed", { error, input });
          if (fallbackCreate) return fallbackCreate(input);
          return Effect.fail(error);
        }),
      );
      return primaryResult;
    });

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
