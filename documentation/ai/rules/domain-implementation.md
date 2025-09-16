# Domain Implementation Guide

**Implementation Status**: **100% standardized** 7-layer Effect-TS architecture across all core domains. Service Types domain serves as the complete architectural template.

## Current Domain Status

- Service Types: 100% complete – architectural template with all 9 helper functions
- Requests: 100% complete – all patterns successfully applied
- Offers: 100% complete – fully standardized implementation
- Users, Organizations, Administration: Effect-based, pending standardization
- Medium of Exchange: Effect-based, pending standardization

## 7-Layer Architecture Overview

1. Service Layer – Effect-native services with Context.Tag dependency injection
2. Store Layer – Factory functions with Svelte 5 Runes + 9 standardized helper functions
3. Schema Validation – Effect Schema at strategic boundaries
4. Error Handling – Tagged domain errors with centralized contexts
5. Composables – Effect-based component logic abstractions
6. Components – Svelte 5 + a11y; business logic via composables
7. Testing – Comprehensive Effect-TS coverage

## Split Rule Set (see details)

- Administration & Access Control: `domain-implementation-admin-access.md`
- Error Management: `domain-implementation-error-management.md`
- Guard Composables: `domain-implementation-guards.md`
- Utilities & Avatars: `domain-implementation-utilities.md`

These focused documents replace the inlined long-form guide and keep this index concise (<12k chars). They provide concrete patterns and code samples per concern.
