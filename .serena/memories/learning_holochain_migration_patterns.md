# Holochain Migration Patterns - Learnings

## Pattern: Submodule Management
- Empty submodule directories indicate uninitialized state, not errors
- Always run `git submodule update --init --recursive` before working with submodules
- Check submodule status with `git submodule status` to see actual commit hashes

## Pattern: Upstream Repository Strategy
- Check if upstream (holochain/[repo]) already has migration solutions
- Adding upstream remote: `git remote add upstream https://github.com/holochain/[repo].git`
- Merge upstream/main to get official migration changes
- Forks should track upstream for major version updates

## Pattern: Bundle Format Changes
- Holochain v0.6 changed webhapp bundle format
- YAML field changes: `happ_manifest` → `happ`
- Bundle deserialization error "unknown variant `1`, expected `0`" indicates format mismatch
- Always rebuild bundles with target Holochain version

## Pattern: Dependency Management
- Holochain v0.6 requires specific client versions
- `@holochain/client` ^0.20.0 for v0.6 compatibility
- `@holochain/hc-spin-rust-utils` 0.600.0 for v0.6
- Lair keystore v0.6.3 paired with Holochain v0.6.0

## Pattern: Build System Adaptation
- kangaroo-electron expects webhapp in `pouch/` directory
- Use system Holochain binaries when available (Nix store)
- Work around yarn dependencies with bun/bunx when needed
- Individual command execution helps isolate build issues

## Pattern: SSH Configuration
- Update all repository remotes to SSH for consistent authentication
- `git remote set-url origin git@github.com:user/repo.git`
- Include upstream remotes for future merges

## Pattern: Configuration Updates
- Binary version updates require new SHA256 checksums
- kangaroo.config.ts tracks platform-specific binaries
- Configuration merges are typically automated from upstream

## Critical Files for Holochain Migrations
1. `package.json` - Dependency versions
2. `web-happ.yaml` - Bundle format specification
3. `kangaroo.config.ts` - Binary versions and checksums
4. Submodule references in `.gitmodules`