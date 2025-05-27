# Effect Schemas Refactor Plan

This document outlines the plan to refactor the codebase to integrate Effect Schemas for robust runtime data validation and to complement existing TypeScript types. The goal is to use Schemas as the source of truth for data structures that require runtime validation or transformation, deriving TypeScript types from these schemas.

## Completed Tasks

- [x] Initial setup of Effect Schemas for basic form validation (`form.schemas.ts`).
- [x] Creation of `holochain.schemas.ts` and `ui.schemas.ts` with initial schema definitions.
- [x] Creation of `validation.service.ts` to encapsulate schema validation logic.
- [x] Discussion and decision to use Effect Schemas as the source of truth for validated data structures.

## In Progress Tasks

- [ ] **Holochain Schemas (`holochain.schemas.ts`):**
  - [ ] Define `UserTypeSchema` using `Schema.Literal`.
  - [ ] Define `StatusTypeSchema` using `Schema.Literal`.
  - [ ] Define `AdministrationEntitySchema` using `Schema.Literal`.
  - [ ] Define `ContactPreferenceSchema` using `Schema.Literal`.
  - [ ] Define `TimePreferenceSchema` using `Schema.Literal`.
  - [ ] Define `ExchangePreferenceSchema` using `Schema.Literal`.
  - [ ] Define `InteractionTypeSchema` using `Schema.Literal`.
  - [ ] Define `DateRangeSchema` as `Schema.Struct`.
  - [ ] Define `UserInDHTSchema` using `Schema.Struct`, incorporating relevant literal schemas.
  - [ ] Define `StatusInDHTSchema` using `Schema.Struct`, incorporating relevant literal schemas.
  - [ ] Define `OrganizationInDHTSchema` using `Schema.Struct`, incorporating relevant literal schemas.
  - [ ] Define `RequestInDHTSchema` using `Schema.Struct`, incorporating `DateRangeSchema` and relevant literal schemas.
  - [ ] Define `OfferInDHTSchema` using `Schema.Struct`, incorporating relevant literal schemas.
  - [ ] Define `ServiceTypeInDHTSchema` using `Schema.Struct`.
  - [ ] Define `RequestInputSchema` by extending `RequestInDHTSchema`.
  - [ ] Define `OfferInputSchema` by extending `OfferInDHTSchema`.
  - [ ] Export derived TypeScript types for all defined schemas (e.g., `export type UserInDHT = Schema.Schema.Type<typeof UserInDHTSchema>;`).

## Future Tasks

- [ ] **UI Schemas (`ui.schemas.ts`):**
  - [ ] Define `OrganizationRoleSchema` using `Schema.Literal`.
  - [ ] Define `UIStatusSchema` (potentially extending `StatusInDHTSchema` or a new struct).
  - [ ] Define `RevisionSchema` as `Schema.Struct` (will require `UIUserSchema` and `UIOrganizationSchema` to be defined or forward-declared).
  - [ ] Define `UIUserSchema` by extending `UserInDHTSchema` and adding UI-specific fields, using other defined UI/Holochain schemas.
  - [ ] Define `UIOrganizationSchema` by extending `OrganizationInDHTSchema` and adding UI-specific fields.
  - [ ] Define `UIRequestSchema` by extending `RequestInDHTSchema`.
  - [ ] Define `UIOfferSchema` by extending `OfferInDHTSchema`.
  - [ ] Define `UIServiceTypeSchema` by extending `ServiceTypeInDHTSchema`.
  - [ ] Define schemas for modal meta types: `AlertModalMetaSchema`, `ConfirmModalMetaSchema`, `PromptModalMetaSchema`.
  - [ ] Export derived TypeScript types for all defined UI schemas.

- [ ] **Refactor Services (`ui/src/lib/services`):**
  - [ ] Update all service methods that interact with Holochain zomes to accept raw `unknown` data.
  - [ ] Use `Schema.decodeUnknown` or `Schema.decodeUnknownEither` from the `ValidationService` or directly with the newly defined Holochain/UI schemas to parse and validate incoming zome data.
  - [ ] Ensure service method return types use the schema-derived TypeScript types.
  - [ ] For methods sending data to zomes, ensure data conforms to the schema, potentially using `Schema.encode` if transformations are needed.

- [ ] **Refactor Stores (`ui/src/lib/stores`):**
  - [ ] Update store methods to expect and work with schema-derived types when interacting with services.
  - [ ] Ensure data passed to UI components from stores also uses these derived types.

- [ ] **Refactor UI Components (`ui/src/lib/components`, `ui/src/routes`):**
  - [ ] Update components to expect props and manage state using schema-derived TypeScript types.
  - [ ] When handling form submissions or other user inputs that will be sent to Holochain, use `ValidationService` to validate data against the relevant form schemas (e.g., `CreateRequestFormSchema`) before passing to store/service layers.

- [ ] **Update Type Definitions (`ui/src/lib/types`):**
  - [ ] Review existing types in `holochain.ts` and `ui.ts`.
  - [ ] Gradually replace hand-written types with their schema-derived counterparts where schemas are now the source of truth.
  - [ ] Remove redundant type definitions if they are fully covered by schema-derived types.
  - [ ] Keep utility types or purely internal UI state types that don't require runtime validation if necessary.

- [ ] **Documentation Updates:**
  - [ ] Update `documentation/technical-specs/ui-structure.md` to reflect the use of Effect Schemas for data validation and type derivation.
  - [ ] Update any relevant diagrams or data flow descriptions in `documentation/architecture.md`.
  - [ ] Add examples of schema usage to `documentation/guides` or a new dedicated section.
  - [ ] Update `.cursor/rules/effect-patterns.mdc` if new common patterns emerge from this refactor.

- [ ] **Testing:**
  - [ ] Add unit tests for all new and modified schemas to ensure they validate and parse data correctly.
  - [ ] Update existing unit/integration tests for services, stores, and components to work with the new schema-based data validation and derived types.
  - [ ] Ensure error handling paths for schema validation failures are adequately tested.

## Implementation Plan

The refactoring will be done incrementally, focusing on one layer at a time to minimize disruption and allow for easier testing and verification.

1.  **Schema Definition (Holochain & UI):**
    *   Start by defining all necessary schemas in `holochain.schemas.ts` for data structures coming directly from the DHT.
    *   Then, define schemas in `ui.schemas.ts` for UI-specific views or extensions of Holochain data.
    *   Export derived TypeScript types alongside each schema definition. This makes the schemas the single source of truth.

2.  **Service Layer Refactor:**
    *   Modify service methods that call Holochain zomes. These methods should now accept `unknown` data and use `Schema.decodeUnknown(RelevantSchema)(data)` to validate and parse the response.
    *   The return types of these service methods should be updated to the schema-derived TypeScript types.
    *   Ensure `Context.Tag` and `Layer` definitions in services are updated if type signatures change significantly.

3.  **Store Layer Refactor:**
    *   Update store methods to align with the new service layer signatures, expecting and using schema-derived types.
    *   Internal state within stores (e.g., in `EntityCache`) should also use these derived types.

4.  **UI Component & Form Refactor:**
    *   Update Svelte components to use the schema-derived types for props and internal state.
    *   For forms, continue using `form.schemas.ts` for input validation. The validated form data (which is already a schema-derived type) can then be passed to stores/services.

5.  **TypeScript Types Cleanup:**
    *   Once schemas are in place and used throughout the app, review the manually defined types in `ui/src/lib/types`.
    *   Remove or refactor any types that are now redundant because they are derived from schemas.

6.  **Testing & Documentation:**
    *   Throughout the process, write unit tests for new schemas.
    *   Update existing tests for services, stores, and components.
    *   Update all relevant project documentation (`documentation/` and potentially `.cursor/rules/`).

### Relevant Files

**Schema Definitions:**
- `ui/src/lib/schemas/index.ts` - Central export for all schemas.
- `ui/src/lib/schemas/holochain.schemas.ts` - Schemas for data structures from Holochain DHT.
- `ui/src/lib/schemas/ui.schemas.ts` - Schemas for UI-specific data structures and views.
- `ui/src/lib/schemas/form.schemas.ts` - Schemas for form validation (already partially implemented).

**Core Logic:**
- `ui/src/lib/services/**/*.service.ts` - All service files will need updates to use schemas for decoding zome call results.
- `ui/src/lib/stores/**/*.store.svelte.ts` - All store files will need updates to use schema-derived types.
- `ui/src/lib/services/validation.service.ts` - May need updates or new utility functions.

**Type Definitions (to be refactored/reduced):**
- `ui/src/lib/types/holochain.ts`
- `ui/src/lib/types/ui.ts`

**UI Components & Routes:**
- `ui/src/lib/components/**/*.svelte`
- `ui/src/routes/**/*.svelte`

**Documentation:**
- `documentation/technical-specs/ui-structure.md`
- `documentation/architecture.md`
- `documentation/guides/*` (Potentially new guide on Effect Schema usage)
- `.cursor/rules/effect-patterns.mdc`
- `EFFECT_SCHEMAS_REFACTOR.md` (This file) 