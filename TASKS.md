# Task List for Issue #38: Align Request/Offer Features with Lightpaper

This list outlines the steps to implement the features described in GitHub issue #38, broken down into logical phases.

## Phase 1: Data Structure Definition & Backend Foundation

### Shared Types (`dnas/requests_and_offers/utils/src/types.rs`)

- [x] Add new public enums with `#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]`:
  - [x] `ExchangePreference { Barter, Gift, Payment, Negotiable, Other(String) }`
  - [x] `ContactPreference { AppChat, Email, Phone, Other(String) }`
  - [x] `InteractionType { Virtual, InPerson }` (Merged RequestType and OfferType into a single type)
  - [x] `ServiceType { Testing, Editing, RustDeveloper, HolochainDeveloper, ... }` (Added new enum for service types)
- [x] Add new public struct `DateRange` with `#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]`:

    ```rust
    #[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
    pub struct DateRange {
      pub start: Option<Timestamp>,
      pub end: Option<Timestamp>,
    }
    ```

- [x] Define a type alias or use `String` for `TimeZone` initially (e.g., `pub type TimeZone = String;`). Consider integrating a timezone crate later if needed.

### Request Zomes

#### Integrity (`dnas/requests_and_offers/zomes/integrity/requests/src/request.rs`)

- [x] Update `Request` struct definition:
  - [x] Add `contact_preference: Option<ContactPreference>`
  - [x] Add `date_range: Option<DateRange>`
  - [x] Add `service_type: ServiceType` (Added for service type classification)
  - [x] Add `time_estimate_hours: Option<f32>`
  - [x] Add `time_preference: Option<String>` (Free text)
  - [x] Add `time_zone: Option<TimeZone>` (Using the type alias/String)
  - [x] Add `exchange_preference: Option<ExchangePreference>`
  - [x] Add `interaction_type: InteractionType` (Renamed from request_type)
  - [x] Review `requirements: Vec<String>` - Kept as is for keywords and specific skills
  - [x] Removed `urgency: Option<String>` as `date_range` covers this need
- [x] Enhance `validate_request` function:
  - [x] Add validation for time_estimate_hours (must be > 0 if present)
  - [x] Add validation for date_range (start date must be before end date if both present)
  - [x] Ensure existing `title`, `description`, `requirements` validation remains
- [x] Implement specific logic in `validate_update_request`:
  - [x] Determined `interaction_type` is immutable after creation
  - [x] Added validation check for attempted mutation of immutable fields
  - [x] Re-run relevant `validate_request` checks on the updated data

#### Coordinator (`dnas/requests_and_offers/zomes/coordinator/requests/src/request.rs`)

- [x] Define/Update `RequestInput` struct to include all new settable fields from the `Request` integrity entry
- [x] Modify `create_request` zome function:
  - [x] Accept updated `RequestInput` with all new fields
  - [x] Populate the `Request` entry struct with all fields
  - [x] Call `create_entry` with the populated `Request`
  - [x] Handle potential validation errors
- [x] Define/Update `UpdateRequestInput` struct (including the `original_action_hash`, `previous_action_hash` and all fields)
- [x] Modify `update_request` zome function:
  - [x] Accept updated `UpdateRequestInput`
  - [x] Get the original entry and action
  - [x] Create the updated `Request` entry
  - [x] Call `update_entry`
- [ ] Update return types (e.g., `RequestOutput`) for `get_request`, `create_request`, `update_request` to include all fields of the `Request` entry
- [ ] Modify `get_request` zome function logic to fetch and return the full `Request` entry data
- [ ] *Optional:* Add new query functions if useful for filtering (e.g., `get_requests_by_interaction_type(interaction_type: InteractionType)`)

### Offer Zomes

#### Integrity (`dnas/requests_and_offers/zomes/integrity/offers/src/offer.rs`)

- [x] Update `Offer` struct definition:
  - [x] Add `qualifications_experience: Option<String>`
  - [x] Add `time_zone: Option<TimeZone>` (Using the type alias/String)
  - [x] Add `exchange_preference: Option<ExchangePreference>`
  - [x] Add `interaction_type: InteractionType` (Renamed from offer_type)
  - [x] Add `type_of_service: ServiceType` (Added for service type classification)
  - [x] Kept `capabilities: Vec<String>` for skills being offered
  - [x] Kept `availability: Option<String>` for now
- [x] Enhance `validate_offer` function:
  - [x] Ensure existing `title`, `description`, `capabilities` validation remains
  - [x] Prepared for additional validation of new fields if needed
- [x] Implement specific logic in `validate_update_offer`:
  - [x] Determined `interaction_type` is immutable after creation
  - [x] Added validation for attempted mutations of immutable fields
  - [x] Re-run relevant `validate_offer` checks on updated data

#### Coordinator (`dnas/requests_and_offers/zomes/coordinator/offers/src/offer.rs`)

- [x] Define/Update `OfferInput` struct with all new fields
- [x] Modify `create_offer` zome function (Accept updated input, populate `Offer` with all fields, call `create_entry`)
- [x] Define/Update `UpdateOfferInput` struct with all fields
- [x] Modify `update_offer` zome function (Accept updated input, get original, create updated `Offer`, call `update_entry`)
- [ ] Update return types (e.g., `OfferOutput`) for `get_offer`, `create_offer`, `update_offer`
- [ ] Modify `get_offer` zome function logic
- [ ] *Optional:* Add new query functions if useful (e.g., `get_offers_by_interaction_type(interaction_type: InteractionType)`)

### Backend Testing (`tests/src/`)

- [ ] Add/Update Tryorama tests for `requests` zome:
  - [ ] Test successful creation of a `Request` with all new fields populated.
  - [ ] Test validation failures for missing/invalid mandatory fields in `create_request`.
  - [ ] Test successful `get_request` retrieves all fields correctly.
  - [ ] Test successful `update_request` for allowed field changes.
  - [ ] Test validation failures for attempting to update immutable fields in `update_request`.
- [ ] Add/Update Tryorama tests for `offers` zome:
  - [ ] Test successful creation of an `Offer` with all new fields populated.
  - [ ] Test validation failures for missing/invalid mandatory fields in `create_offer`.
  - [ ] Test successful `get_offer` retrieves all fields correctly.
  - [ ] Test successful `update_offer` for allowed field changes.
  - [ ] Test validation failures for attempting to update immutable fields in `update_offer`.
- [ ] Add tests for any new query functions implemented in coordinator zomes.
- [ ] Ensure tests run within the Nix environment: `nix develop --command bun test:requests` and `nix develop --command bun test:offers`

## Phase 2: UI Implementation (`ui/src/...`)

### Shared UI Elements & Types

- [ ] Update Holochain types (`types/holochain.ts`) with new/updated entry definitions and zome function signatures.
- [ ] Update UI types (`types/ui.ts`) as needed.
- [ ] Create/Update UI components for TimeZone selection, DateRange input, and various Preference selectors (Radio groups, dropdowns).

### Request Form (`lib/components/requests/RequestForm.svelte`, `services/requestService.ts`)

- [ ] Add form fields connected to `$state` for all new `Request` properties.
- [ ] Implement input validation for new fields.
- [ ] Update `createRequest` and `updateRequest` service calls in `requestService.ts` to pass new data.

### Offer Form (`lib/components/offers/OfferForm.svelte`, `services/offerService.ts`)

- [ ] Add form fields connected to `$state` for all new `Offer` properties.
- [ ] Implement input validation for new fields.
- [ ] Update `createOffer` and `updateOffer` service calls in `offerService.ts` to pass new data.

### Display Components

- [ ] Update `RequestDetail.svelte` and `OfferDetail.svelte` (or similar) to display the new fields.
- [ ] Update list item components (`RequestListItem.svelte`, etc.) if necessary.

### Exchange Completion UI

- [ ] Implement UI controls (e.g., buttons) for initiating/confirming mutual validation on detail pages.
- [ ] Create `ReviewForm.svelte` component and integrate into the UI flow (e.g., after validation).
- [ ] Create `FeedbackForm.svelte` component and integrate.
- [ ] Implement UI sections for displaying reviews (e.g., on user profiles, potentially linked from Request/Offer history).
- [ ] Add admin contact information/link (e.g., in footer or a dedicated help/support page).

### Skill Suggestion Flow ("Other" Skill)

- [ ] Implement UI logic in skill selection components to handle "Other" input.
- [ ] Add visual indicator if a custom skill requires admin review (if applicable based on backend implementation).

### Frontend Testing

#### Static Checks

- [ ] Run `bun check` frequently throughout development to catch TypeScript errors.

#### Unit & Integration Tests (`ui/tests/unit`, `ui/tests/integration` - Likely Vitest)

- [ ] **Form Components:** Write/Update tests for `RequestForm.svelte` and `OfferForm.svelte` to:
  - [ ] Verify initial state of new fields.
  - [ ] Test input handling and validation logic for new fields (e.g., time zone selection, date range inputs, preference enums).
  - [ ] Mock `requestService` / `offerService` and assert that correct data (including new fields) is passed on form submission.
- [ ] **Display Components:** Write/Update tests for `RequestDetail.svelte`, `OfferDetail.svelte` (or similar) to ensure new fields are rendered correctly when passed appropriate props.
- [ ] **Service Layers (`ui/src/services`):** Add/Update tests for `requestService.ts` and `offerService.ts` to ensure:
  - [ ] Zome call functions are correctly formatting input data (including new fields).
  - [ ] Data returned from (mocked) zome calls is correctly mapped/processed.

#### End-to-End Tests (`ui/tests/e2e` - Likely Playwright)

- [ ] Write/Update E2E tests for the Request creation/editing flow:
  - [ ] Navigate to the Request form.
  - [ ] Fill in all fields, including the new ones (contact preference, date range, time zone, etc.).
  - [ ] Submit the form and verify successful creation (e.g., navigating to the detail page).
  - [ ] Verify the newly created/edited Request detail page displays all the new fields correctly.
- [ ] Write/Update E2E tests for the Offer creation/editing flow:
  - [ ] Navigate to the Offer form.
  - [ ] Fill in all fields, including the new ones (qualifications, time zone, etc.).
  - [ ] Submit the form and verify successful creation/update.
  - [ ] Verify the newly created/edited Offer detail page displays all the new fields correctly.

#### Manual Testing & Refinement

- [ ] Perform end-to-end manual testing focusing on:
  - [ ] Creating/Editing Requests and Offers using various combinations of the new fields.
  - [ ] Checking data persistence and correct display across different views (lists, detail pages).
  - [ ] Ensuring usability of new form inputs (date pickers, dropdowns, etc.).
- [ ] Address any bugs, inconsistencies, or usability issues identified.
