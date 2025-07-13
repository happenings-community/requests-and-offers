# Guidelines for Writing Effect-TS Code

Below are best practices for writing clean and maintainable code using the Effect-TS library in TypeScript, derived from
examples shared in an X thread by Dillon Mulroy on June 21,
2025 (https://x.com/dillon_mulroy/status/1936530534936486009). These guidelines are presented in the order of the
original posts, with each referencing the corresponding post for context. A decision matrix is included to guide the
choice between Effect.gen and .pipe.

## Decision Matrix

Use the following decision matrix to determine whether to use `Effect.gen` or `.pipe` based on the task:

- **Injecting/Retrieving Dependencies** → `Effect.gen`
- **Conditional Logic** → `Effect.gen`
- **Sequential Operations** → `Effect.gen`
- **Error Handling** → `.pipe`
- **Adding Tracing** → `.pipe`
- **Layer Building** → `.pipe`
- **Simple Transforms** → `.pipe`

This matrix, as outlined by Dillon Mulroy, helps align your coding approach with the strengths of each syntax.

## 1. Separate Business Logic and Composition

**Guideline:** Use `Effect.gen` to encapsulate business logic, where sequential operations and control flow are defined.
Use `.pipe` for composing effects, particularly when dealing with layers or cross-cutting concerns.

**Example:**

```typescript
Effect.gen(function* () {
    // business logic lives here
})
    .pipe
    // composition happens here
    ();
```

## 2. Manage Multi-Step Operations with Generators

**Guideline:** For operations involving multiple steps (e.g., validation, hashing, creation), use `Effect.gen` to
sequence them clearly.

**Example:** Creating a user with input validation, password hashing, and database insertion.

```typescript
const createUser = (userData) => {
    return Effect.gen(function* () {
        const validated = yield* effect.validateUser(userData);
        const hashed = yield* hashPassword(validated.password);
        const user = yield* users.create({...validated, password: hashed});
        return yield* enrichUserData(user);
    });
};
```

## 3. Implement Conditional Logic Within Generators

**Guideline:** Use if statements inside `Effect.gen` to handle different logic paths based on conditions.

**Example:** Processing payments differently based on the amount.

```typescript
const processPayment = (payment) => {
    return Effect.gen(function* () {
        const config = yield* Config;
        if (payment.amount > config.largePaymentThreshold) {
            yield* processLargePayment(payment);
        } else {
            yield* processStandardPayment(payment);
        }
    });
};
```

## 4. Compose Layers Using .pipe

**Guideline:** When building dependency injection layers, use `.pipe` to chain `Layer.provide` calls for proper
composition.

**Example:** Providing Database, Logger, Metrics, and Cache layers.

```typescript
const appLayer = Layer.empty.pipe(
    Layer.provide(Database.layer),
    Layer.provide(Logger.layer),
    Layer.provide(Metrics.layer.pipe(Layer.provide(Cache.layer)))
);
```

## 5. Perform Simple Transforms with .pipe and .map

**Guideline:** For simple data transformations, use `.pipe` with `.map` to extract or transform data within effects.

**Example:** Extracting usernames from a list of users.

```typescript
const usernames =
    yield *
    getActiveUsers().pipe(Effect.map((users) => users.map((u) => u.username)));
```

## 6. Combining it all together

**Guideline:** Use `Effect.gen` for business logic like caching and data fetching, and `.pipe` for cross-cutting
concerns like tracing, retries, and error handling.

**Example:** Fetching user posts with caching, tracing, retry, and error handling.

```typescript
const fetchUserPosts = (userId) =>
    Effect.gen(function* () {
        const db = yield* Database;
        const cache = yield* Cache;
        const cached = yield* cache.get(`posts:${userId}`);
        if (cached) return cached;
        const posts = yield* db.posts.findByUser(userId);
        yield* cache.set(`posts:${userId}`, posts);
        return posts;
    }).pipe(
        Effect.withSpan("fetch_user_posts"),
        Effect.retry(retryPolicy),
        Effect.catchTag("DatabaseError", () => Effect.succeed([]))
    );
```

## 7. Avoid Long Chains of .andThen; Use Generators Instead

**Guideline:** Prefer `Effect.gen` over long chains of `.andThen` for sequential logic to improve readability and
maintainability.

**Example:** Processing an order with multiple steps using a generator instead of `.andThen` chains.

```typescript
// Don't do this:
validateOrder(order)
    .andThen(calculateTotals)
    .andThen(applyDiscounts)
    .andThen(processPayment)
    .andThen(sendConfirmation);

// Do this instead:
Effect.gen(function* () {
    const validated = yield* validateOrder(order);
    const withTotals = yield* calculateTotals(validated);
    const discounted = yield* applyDiscounts(withTotals);
    yield* processPayment(discounted);
    yield* sendConfirmation();
});
```
