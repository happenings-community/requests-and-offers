# Domain Implementation: Administration & Access Control

## Role-Based Access Control

Hierarchy:

- Administrator – Full system access, user management, critical operations
- Moderator – Content moderation, user support, community management
- Creator – Content creation, project management
- Advocate – Community engagement and networking

### Zome-level Access Control (Rust)

```rust
#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum UserRole {
    Administrator,
    Moderator,
    Creator,
    Advocate,
}

#[hdk_extern]
pub fn create_admin_only_resource(input: AdminResourceInput) -> ExternResult<ActionHash> {
    let agent_info = agent_info()?;
    let user_roles = get_user_roles(agent_info.agent_initial_pubkey)?;

    if !user_roles.contains(&UserRole::Administrator) {
        return Err(wasm_error!(WasmErrorInner::Guest(
            "Insufficient permissions: Administrator role required".to_string()
        )));
    }

    let resource_hash = create_entry(&EntryTypes::AdminResource(input.into()))?;
    Ok(resource_hash)
}
```

## Frontend Access Guards (Effect-TS)

```ts
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

export const useAdminGuard = () => useAccessGuard(UserRole.Administrator);
export const useModeratorGuard = () => useAccessGuard(UserRole.Moderator);
export const useCreatorGuard = () => useAccessGuard(UserRole.Creator);
```

## Capability Token Pattern

```ts
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
