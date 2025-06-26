# Holochain 0.4 → 0.5 Migration Plan

Migration plan for upgrading the Requests and Offers hApp from Holochain 0.4.x to v0.5.x. This migration addresses the major breaking changes introduced in Holochain 0.5, particularly the new kitsune2 wire protocol, API changes, and dependency updates.

## Overview

Holochain 0.5 introduces significant changes:
- **New kitsune2 wire protocol** - Better gossip performance but incompatible with 0.4
- **Breaking API changes** - Enum serialization, hash constructors, agent info changes
- **Updated dependencies** - HDK/HDI version updates, new package versions
- **Network infrastructure changes** - New bootstrap/signal server requirements

## Completed Tasks

- [x] Research Holochain 0.5 breaking changes and migration requirements
- [x] Analyze current project structure and dependencies
- [x] Create comprehensive migration plan

## In Progress Tasks

- [ ] Update Nix environment configuration
- [ ] Update Rust dependencies (HDK/HDI)
- [ ] Update JavaScript client dependencies

## Future Tasks

### Phase 1: Environment and Dependencies
- [ ] Update flake.nix for Holochain 0.5
- [ ] Update root Cargo.toml workspace dependencies
- [ ] Update UI package.json dependencies
- [ ] Update tests package.json dependencies
- [ ] Update root package.json scripts and dependencies

### Phase 2: Rust Zome Code Updates
- [ ] Fix HoloHash constructor usage across all zomes
- [ ] Update agent_info() calls (replace agent_latest_pubkey with agent_initial_pubkey)
- [ ] Remove origin_time and quantum_time from DNA manifests
- [ ] Update enum serialization patterns in Rust code
- [ ] Fix timestamp imports (holochain_timestamp crate)
- [ ] Update validation callback signatures if needed

### Phase 3: JavaScript/TypeScript Code Updates
- [ ] Fix enum serialization in UI code (Signal handling)
- [ ] Update AppWebsocket.callZome calls (remove null cap_secret)
- [ ] Update signal handling patterns
- [ ] Fix createCloneCell, disableCloneCell, enableCloneCell usage
- [ ] Update error handling for new API responses
- [ ] Fix any broken type imports and schemas

### Phase 4: Configuration and Manifest Updates
- [ ] Update dna.yaml manifest (remove origin_time/quantum_time)
- [ ] Update happ.yaml if needed
- [ ] Update package.json scripts for new tools
- [ ] Replace hc run-local-services with kitsune2-bootstrap-srv

### Phase 5: Testing and Validation
- [ ] Update Tryorama test configurations
- [ ] Fix broken unit tests
- [ ] Fix broken integration tests
- [ ] Test DNA compilation and packaging
- [ ] Test hApp startup and basic functionality
- [ ] Test networking between multiple agents

### Phase 6: Production Readiness
- [ ] Configure production bootstrap/signal servers
- [ ] Update deployment scripts
- [ ] Update documentation for new development setup
- [ ] Performance testing with kitsune2

## Implementation Plan

### Dependencies Update Strategy

**Critical Version Updates Required:**
- HDI: `=0.5` → `=0.6.2` (or later)
- HDK: `=0.4` → `=0.5.2` (or later) 
- @holochain/client: `^0.17.1` → `^0.19.0`
- @holochain/tryorama: `^0.17.0` → `^0.18.1`
- Holonix: `main-0.4` → `main-0.5`

### Code Change Priorities

1. **High Priority (Breaks Compilation)**
   - HoloHash constructor renames
   - Agent info API changes
   - HDK/HDI dependency updates

2. **Medium Priority (Runtime Issues)**
   - Enum serialization patterns
   - Signal handling updates
   - DNA manifest cleanup

3. **Low Priority (Future Compatibility)**
   - Script optimizations
   - Production server configuration

### Risk Assessment

**High Risk Areas:**
- Service layer type compatibility between old and new schemas
- Effect stores with complex dependency management
- Cross-zome calls and capability grants

**Mitigation Strategies:**
- Incremental migration with thorough testing at each step
- Maintain backwards compatibility shims where possible
- Test with minimal viable changes first

## Relevant Files

### Core Configuration
- `flake.nix` - Holonix environment configuration ✅
- `Cargo.toml` - Rust workspace dependencies ✅
- `ui/package.json` - Frontend dependencies ✅
- `tests/package.json` - Test dependencies ✅
- `package.json` - Root workspace and scripts ✅

### DNA/hApp Manifests
- `workdir/dna.yaml` - DNA configuration
- `workdir/happ.yaml` - hApp configuration
- `workdir/web-happ.yaml` - Web hApp configuration

### Rust Zomes (Coordinator)
- `dnas/requests_and_offers/zomes/coordinator/administration/` - Admin zome
- `dnas/requests_and_offers/zomes/coordinator/offers/` - Offers zome
- `dnas/requests_and_offers/zomes/coordinator/requests/` - Requests zome
- `dnas/requests_and_offers/zomes/coordinator/service_types/` - Service types zome
- `dnas/requests_and_offers/zomes/coordinator/users_organizations/` - Users/orgs zome

### Rust Zomes (Integrity)
- `dnas/requests_and_offers/zomes/integrity/administration/` - Admin integrity
- `dnas/requests_and_offers/zomes/integrity/offers/` - Offers integrity
- `dnas/requests_and_offers/zomes/integrity/requests/` - Requests integrity
- `dnas/requests_and_offers/zomes/integrity/service_types/` - Service types integrity
- `dnas/requests_and_offers/zomes/integrity/users_organizations/` - Users/orgs integrity

### Frontend Code
- `ui/src/lib/services/` - Service layer with Holochain client calls
- `ui/src/lib/stores/` - Svelte stores with Effect TS patterns
- `ui/src/lib/schemas/` - Type schemas and validation
- `ui/src/lib/types/` - TypeScript type definitions

### Testing
- `tests/src/` - Tryorama integration tests
- `ui/tests/` - Frontend unit and integration tests

## Breaking Changes Summary

### Rust/HDK Changes
1. **HoloHash Constructors**: `from_raw_39` → `try_from_raw_39`, `from_raw_39_panicky` → `from_raw_39`
2. **Agent Info**: `agent_latest_pubkey` → `agent_initial_pubkey` (behind feature flag)
3. **Timestamps**: Move from `kitsune_p2p_timestamp` to `holochain_timestamp` crate
4. **DNA Properties**: Remove `origin_time` and `quantum_time` fields

### JavaScript/Client Changes  
1. **Enum Serialization**: `SignalType.App in sig` → `sig.type == SignalType.App`
2. **Cap Secrets**: Remove `cap_secret: null` from callZome calls
3. **Clone Cell Operations**: New enum format for clone_cell_id parameters
4. **Signal Values**: Access signal data via `sig.value` instead of `sig[SignalType.App]`

### Infrastructure Changes
1. **Bootstrap Server**: Replace `hc run-local-services` with `kitsune2-bootstrap-srv`
2. **Network Config**: Update scripts to use new bootstrap server binary
3. **Production Servers**: Need new bootstrap/signal server URLs for production

## Success Criteria

- [ ] All zomes compile successfully with Holochain 0.5
- [ ] DNA and hApp packages build without errors
- [ ] All existing unit tests pass
- [ ] All existing integration tests pass
- [ ] hApp starts and runs in development environment
- [ ] Multi-agent networking functions correctly
- [ ] UI connects and communicates with conductor
- [ ] No regressions in existing functionality

## Notes

- **Network Incompatibility**: Holochain 0.5 conductors cannot communicate with 0.4 conductors due to kitsune2
- **Feature Flags**: Some 0.4 features are behind unstable flags in 0.5
- **Type Safety**: The migration will improve type safety but requires careful schema management
- **Performance**: kitsune2 should provide better gossip performance once fully migrated

## References

- [Official Holochain 0.4 → 0.5 Upgrade Guide](https://developer.holochain.org/resources/upgrade/upgrade-holochain-0.5/)
- [HDK Changelog](https://crates.io/crates/hdk)
- [HDI Changelog](https://crates.io/crates/hdi)
- [@holochain/client Changelog](https://github.com/holochain/holochain-client-js) 