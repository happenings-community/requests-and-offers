# Domain Implementation: Guard Composables

## Input Validation Guards

```ts
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
```

## Business Rule Guards

```ts
export const useBusinessRuleGuard =
  <TEntity>(
    rules: Array<(entity: TEntity) => Effect.Effect<boolean, ValidationError>>,
  ) =>
  (entity: TEntity) =>
    Effect.gen(function* () {
      const results = yield* Effect.all(
        rules.map((rule) => rule(entity)),
        { concurrency: "unbounded" },
      );

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

export const serviceTypeBusinessRules = [
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

## State Transition Guards

```ts
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
  [RequestStatus.Completed]: [],
  [RequestStatus.Cancelled]: [],
};

export const useRequestStatusGuard = () =>
  useStateTransitionGuard(requestStatusTransitions);
```
