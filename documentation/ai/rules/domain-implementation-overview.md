# Domain Implementation: Overview

This overview summarizes the standardized 7-layer Effect-TS architecture and key patterns used across all domains.

## Implementation Status

- Service Types: 100% complete – architectural template with all 9 helper functions
- Requests: 100% complete – all patterns successfully applied
- Offers: 100% complete – fully standardized implementation
- Users, Organizations, Administration: Effect-based, pending standardization
- Medium of Exchange: Effect-based, pending standardization

## 7-Layer Architecture

1. Service Layer – Effect-native services with Context.Tag dependency injection
2. Store Layer – Factory functions with Svelte 5 Runes + 9 standardized helper functions
3. Schema Validation – Effect Schema at strategic business boundaries
4. Error Handling – Domain-specific tagged errors with centralized contexts
5. Composables – Component logic abstraction using Effect-based functions
6. Components – Svelte 5 + accessibility focus, using composables for business logic
7. Testing – Comprehensive Effect-TS coverage across all layers

## Key Implementation Patterns

- Administration & Access Control – Role-based permissions and capability tokens
- Error Management – Tagged errors with rich context and recovery strategies
- Guard Patterns – Access control, input validation, state transitions
- Utility Patterns – Avatars, slugs, tags normalization, display helpers

See the following rule files for details:

- domain-implementation-admin-access.md
- domain-implementation-error-management.md
- domain-implementation-guards.md
- domain-implementation-utilities.md
