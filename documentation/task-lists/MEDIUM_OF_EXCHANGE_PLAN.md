# Medium of Exchange (MoE) Implementation

This plan outlines the implementation of a dedicated Medium of Exchange (MoE) system. The goal is to allow users to specify how they want to be compensated for their services, using pre-defined currencies, suggesting new ones, or opting for non-monetary exchanges. This feature is a critical prerequisite for enabling the hREA exchange process.

The architecture will be based on a dedicated `mediums_of_exchange` zome that indexes `ResourceSpecification` records in hREA, distinguishing them from standard service types.

## Completed Tasks

*This section will be populated as tasks are completed.*

## In Progress Tasks

*This section will be populated as tasks are worked on.*

## Future Tasks

### Phase 1: Zome and DNA Scaffolding
- [ ] Create new `mediums_of_exchange` zome (integrity and coordinator)
- [ ] Define `MediumOfExchange` integrity entry (`code`, `name`, `status`, `resource_spec_hrea_id`)
- [ ] Implement `suggest_medium_of_exchange` coordinator function
- [ ] Implement `get_all_mediums_of_exchange` coordinator function
- [ ] Implement `approve_medium_of_exchange` coordinator function (creates hREA spec and updates entry)
- [ ] Implement `reject_medium_of_exchange` coordinator function
- [ ] Add unit tests for the new zome functions

### Phase 2: Service and State Management Layer
- [ ] Create `mediums-of-exchange.service.ts` to wrap zome calls
- [ ] Create `mediums_of_exchange.store.svelte.ts` for state management
- [ ] Add functions to the store to fetch all MoEs and manage their state
- [ ] Add functions to the store to handle suggesting, approving, and rejecting MoEs

### Phase 3: Administration UI
- [ ] Create new admin route at `/admin/mediums-of-exchange`
- [ ] Create `MoEManagementTable.svelte` component to display and manage MoEs
- [ ] Implement logic for admins to approve/reject suggested currencies

### Phase 4: User-Facing UI
- [ ] Create `MediumOfExchangeSelector.svelte` component
- [ ] Implement UI for "Payment in Currency" (dropdown of approved MoEs)
- [ ] Implement UI for "Suggest a currency" (text field + button)
- [ ] Implement UI for "Pay it Forward/Free" (checkbox)
- [ ] Implement UI for "I prefer to exchange services" (checkbox)
- [ ] Integrate `MediumOfExchangeSelector.svelte` into the `Offer` and `Request` forms

### Phase 5: Core Logic Integration
- [ ] Update `hrea.store.svelte.ts` to use the selected MoE
- [ ] Modify the `Proposal` creation logic to use the MoE `ResourceSpecification` for the "payment" intent

### Phase 6: Documentation
- [ ] Update `HREA_INTEGRATION_PLAN.md` to reference this plan
- [ ] Update `architecture.md` with the new zome and data flow
- [ ] Update `technical-specs.md` with details of the new entry type
- [ ] Update `work-in-progress.md` and `status.md`

## Implementation Plan

The core of this feature is a new, dedicated Holochain zome named `mediums_of_exchange`. This zome will manage a local index of entries that represent different ways a user can be compensated.

1.  **Data Model**: An integrity zome entry, `MediumOfExchange`, will be created. It will have the following fields:
    *   `code: string` - A short, unique identifier (e.g., 'EUR', 'USD', 'PAY_IT_FORWARD').
    *   `name: string` - A human-readable name (e.g., 'Euro', 'US Dollar', 'Pay it Forward').
    *   `status: enum('suggested', 'approved', 'rejected')` - The moderation status.
    *   `resource_spec_hrea_id: Option<string>` - The ID of the corresponding hREA `ResourceSpecification` record. This will only be present for `approved` entries.

2.  **Workflow**:
    *   **Suggestion**: A user suggests a new currency via the UI. This creates a `MediumOfExchange` entry with `suggested` status. No hREA record is created at this stage.
    *   **Approval**: An administrator reviews the suggestion on a dedicated admin page. Upon approval, two things happen:
        1.  A call is made to the hREA service to create a new `ResourceSpecification`.
        2.  The local `MediumOfExchange` entry is updated with the `approved` status and the `resource_spec_hrea_id` from the newly created hREA record.
    *   **Selection**: In the `Offer` or `Request` forms, the UI fetches all `approved` MoEs from our zome. The user's selection is passed to the `hrea.store`.
    *   **Proposal Creation**: When creating an hREA `Proposal`, the `hrea.store` uses the `resource_spec_hrea_id` from the selected MoE to correctly form the reciprocal "payment" `Intent`.

This architecture cleanly separates the concerns of MoE management from other domains and leverages hREA for what it's good at (economic resource specification) while keeping our application-specific business logic (moderation workflows) in our own DNA.

## Relevant Files

### Files to Create

**Zome:**
- `dnas/requests_and_offers/zomes/integrity/mediums_of_exchange/src/lib.rs` - Integrity zome definition
- `dnas/requests_and_offers/zomes/coordinator/mediums_of_exchange/src/lib.rs` - Coordinator zome functions
- `tests/src/requests_and_offers/mediums_of_exchange/moe.test.ts` - Tests for the new zome

**Service & Store:**
- `ui/src/lib/services/zomes/mediums-of-exchange.service.ts` - Service for zome communication
- `ui/src/lib/stores/mediums_of_exchange.store.svelte.ts` - Svelte store for state management

**Admin UI:**
- `ui/src/routes/admin/mediums-of-exchange/+page.svelte` - Admin management page
- `ui/src/lib/components/moe/MoEManagementTable.svelte` - Component for the admin table

**User-Facing UI:**
- `ui/src/lib/components/moe/MediumOfExchangeSelector.svelte` - The main user-facing component

### Files to Modify

**Configuration:**
- `dnas/requests_and_offers/dna.yaml` - Add the new zome to the DNA
- `workdir/happ.yaml` - Register the new zome

**Core Stores & Forms:**
- `ui/src/lib/stores/hrea.store.svelte.ts` - To integrate the selected MoE into Proposal creation
- `ui/src/lib/components/offers/OfferForm.svelte` - To integrate the selector component
- `ui/src/lib/components/requests/RequestForm.svelte` - To integrate the selector component

**Documentation:**
- `documentation/task-lists/HREA_INTEGRATION_PLAN.md` - To reference this new plan
- `documentation/architecture.md` - To add the new zome to the architecture diagram/description
- `documentation/technical-specs.md` - To describe the new `MediumOfExchange` entry 