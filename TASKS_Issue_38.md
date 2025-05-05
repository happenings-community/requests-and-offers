# Task List for Issue #38: Align Request/Offer Features with Lightpaper

This list outlines the steps to implement the features described in GitHub issue #38, broken down into logical phases.

## Phase 1: Data Structure Definition & Backend Foundation

### Shared Types (`dnas/requests_and_offers/utils/src/types.rs`)

- [x] Add new public enums with `#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]`:
  - [x] `ExchangePreference { Exchange, Arranged, PayItForward, Open }`
  - [x] `ContactPreference { Email, Phone, Other }` (AppChat was removed as per user modifications)
  - [x] `InteractionType { Virtual, InPerson }`
  - [x] `TimePreference { Morning, Afternoon, Evening, NoPreference, Other }`
- [x] Add new public struct `DateRange` with `#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]`:

    ```rust
    #[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
    pub struct DateRange {
      pub start: Option<Timestamp>,
      pub end: Option<Timestamp>,
    }
    ```

- [x] Define a type alias or use `String` for `TimeZone` initially (e.g., `pub type TimeZone = String;`). Consider integrating a timezone crate later if needed.
- [x] Define a type for `Links` as `Vec<String>` (implemented directly in the Request/Offer structs).

### Request Zomes

#### Integrity (`dnas/requests_and_offers/zomes/integrity/requests/src/request.rs`)

- [x] Update `Request` struct definition:
  - [x] Add `contact_preference: ContactPreference` (Required field as per user modifications)
  - [x] Add `date_range: Option<DateRange>`
  - [x] Add `time_estimate_hours: Option<f32>`
  - [x] Add `time_preference: TimePreference` (Required field as per user modifications)
  - [x] Add `time_zone: Option<TimeZone>`
  - [x] Add `exchange_preference: ExchangePreference` (Required field as per user modifications)
  - [x] Add `interaction_type: InteractionType` (Required field as per user modifications)
  - [x] Add `links: Vec<String>` (Required field as per user modifications)
  - [x] Review `requirements: Vec<String>` - Ensure it aligns with "Type of Service or Skill"
  - [x] Remove `urgency: Option<String>` as `date_range` and `time_preference` cover the need
- [x] Enhance `validate_request` function:
  - [x] Add validation for mandatory fields
  - [x] Add basic validation for optional fields where applicable (e.g., check `time_estimate_hours` > 0 if present)
  - [x] Ensure existing `title`, `description`, `requirements` validation remains
  - [x] Add validation for the 500 character limit on the description
- [x] Implement specific logic in `validate_update_request`:
  - [x] Simplified to just run the standard validation on the updated request

#### Coordinator (`dnas/requests_and_offers/zomes/coordinator/requests/src/lib.rs`, etc.)

- [x] Define/Update `CreateRequestInput` struct to include all new settable fields from the `Request` integrity entry
- [x] Modify `create_request` zome function:
  - [x] Accept `RequestInput` with the updated Request struct
  - [x] Call `create_entry` with the Request directly (simplified approach as per user modifications)
  - [x] Handle potential validation errors
- [x] Define/Update `UpdateRequestInput` struct (including the `original_request_hash` and the fields allowed to be updated)
- [x] Modify `update_request` zome function:
  - [x] Accept `UpdateRequestInput`
  - [x] Get the original entry and action
  - [x] Create the updated `Request` entry
  - [x] Call `update_entry`
- [x] Update return types (e.g., `RequestOutput`) for `get_request`, `create_request`, `update_request` (Already correctly implemented)
- [x] Modify `get_request` zome function logic to fetch and return the full `Request` entry data (Already correctly implemented)
- [ ] *Optional:* Add new query functions if useful for filtering (e.g., `get_requests_by_interaction_type(interaction_type: InteractionType)`)

### Offer Zomes

#### Integrity (`dnas/requests_and_offers/zomes/integrity/offers/src/offer.rs`)

- [x] Update `Offer` struct definition:
  - [x] Add `time_zone: Option<TimeZone>`
  - [x] Add `exchange_preference: ExchangePreference` (Required field as per user modifications)
  - [x] Add `interaction_type: InteractionType` (Required field as per user modifications)
  - [x] Add `links: Vec<String>` (Required field as per user modifications)
  - [x] Review `capabilities: Vec<String>` - Ensure it aligns with "Type of Service" dropdown options
  - [x] Update `availability: Option<String>` to `time_preference: TimePreference` (Required field as per user modifications)
- [x] Enhance `validate_offer` function:
  - [x] Add validation for mandatory fields
  - [x] Ensure existing `title`, `description`, `capabilities` validation remains
  - [x] Add validation for the 500 character limit on the description
- [x] Implement specific logic in `validate_update_offer`:
  - [x] Simplified to use default validation

#### Coordinator (`dnas/requests_and_offers/zomes/coordinator/offers/src/lib.rs`, etc.)

- [x] Define/Update `CreateOfferInput` struct (Already exists as `OfferInput`)
- [x] Modify `create_offer` zome function (Already using the direct approach with `create_entry(&EntryTypes::Offer(input.offer))`)
- [x] Define/Update `UpdateOfferInput` struct (Already exists with the correct structure)
- [x] Modify `update_offer` zome function (Already correctly implemented)
- [x] Update return types (e.g., `OfferOutput`) for `get_offer`, `create_offer`, `update_offer` (Already correctly implemented)
- [x] Modify `get_offer` zome function logic (Already correctly implemented - uses `record.entry().to_app_option()` which adapts to struct changes)
- [ ] *Optional:* Add new query functions if useful (e.g., `get_offers_by_interaction_type(interaction_type: InteractionType)`)

### Backend Testing (`tests/src/`)

- [x] Add/Update Tryorama tests for `requests` zome:
  - [x] Test successful creation of a `Request` with all new fields populated
  - [x] Test validation failures for missing/invalid mandatory fields in `create_request`
  - [x] Test successful `get_request` retrieves all fields correctly
  - [x] Test successful `update_request` for allowed field changes
  - [x] Test validation failures for attempting to update immutable fields in `update_request`
  - [x] Fixed serialization issue with `date_range` (null vs undefined)
- [x] Add/Update Tryorama tests for `offers` zome:
  - [x] Test successful creation of an `Offer` with all new fields populated
  - [x] Test validation failures for missing/invalid mandatory fields in `create_offer`
  - [x] Test successful `get_offer` retrieves all fields correctly
  - [x] Test successful `update_offer` for allowed field changes
  - [x] Test validation failures for attempting to update immutable fields in `update_offer`
- [ ] Add tests for any new query functions implemented in coordinator zomes
- [x] Ensure tests run within the Nix environment: `nix develop --command bun test:requests` and `nix develop --command bun test:offers`

## Phase 2: UI Implementation (`ui/src/...`)

### Shared UI Elements & Types

- [x] Update Holochain types (`types/holochain.ts`) with new/updated entry definitions and zome function signatures
- [x] Update UI types (`types/ui.ts`) as needed
- [x] Create/Update UI components for TimeZone selection, DateRange input, and various Preference selectors (Radio groups, dropdowns)
- [x] Implement the "Skill Type" dropdown with all options specified in the issue (Testing, Editing, Rust-Developer, etc.)
- [x] Add support for "Other" skill type with admin review flag

### Request Form (`lib/components/requests/RequestForm.svelte`, `services/requestService.ts`)

- [x] Add new form fields:
  - [x] Contact preference radio buttons (Email, Phone, Other)
  - [x] Date range inputs (start/end dates)
  - [x] Time estimate input (hours)
  - [x] Time preference radio buttons (Morning, Afternoon, Evening, No Preference, Other)
  - [x] Time zone dropdown
  - [x] Medium of exchange checkboxes (Exchange services, To be arranged, Pay it Forward, "Hit me up")
  - [x] Interaction type checkboxes (Virtual, In-Person)
  - [x] Links input
- [x] Implement input validation for new fields
- [x] Implement the 500 character limit on description
- [ ] Update `createRequest` and `updateRequest` service calls in `requestService.ts` to pass new data

### Offer Form (`lib/components/offers/OfferForm.svelte`, `services/offerService.ts`)

- [x] Add new form fields:
  - [x] Time preference radio buttons (Morning, Afternoon, Evening, No Preference, Other)
  - [x] Time zone dropdown
  - [x] Medium of exchange checkboxes (Exchange services, To be arranged, Pay it Forward, "Hit me up")
  - [x] Interaction type checkboxes (Virtual, In-Person)
  - [x] Links input
- [x] Implement input validation for new fields
- [x] Implement the 500 character limit on description
- [ ] Update `createOffer` and `updateOffer` service calls in `offerService.ts` to pass new data

### Display Components

- [ ] Update `RequestDetail.svelte` and `OfferDetail.svelte` (or similar) to display the new fields
- [ ] Update list item components (`RequestListItem.svelte`, etc.) if necessary to show relevant new fields in list views

### Skill Suggestion Flow ("Other" Skill)

- [ ] Implement UI logic in skill selection components to handle "Other" input
- [ ] Add visual indicator if a custom skill requires admin review

### Frontend Testing

#### Static Checks

- [ ] Run `bun check` frequently throughout development to catch TypeScript errors

#### Unit & Integration Tests (`ui/tests/unit`, `ui/tests/integration` - Likely Vitest)

- [ ] **Form Components:** Write/Update tests for `RequestForm.svelte` and `OfferForm.svelte` to:
  - [ ] Verify initial state of new fields
  - [ ] Test input handling and validation logic for new fields (e.g., time zone selection, date range inputs)
  - [ ] Test character limit enforcement for description field
  - [ ] Mock `requestService` / `offerService` and assert that correct data (including new fields) is passed on form submission
- [ ] **Display Components:** Write/Update tests for `RequestDetail.svelte`, `OfferDetail.svelte` (or similar) to ensure new fields are rendered correctly when passed appropriate props
- [ ] **Service Layers (`ui/src/services`):** Add/Update tests for `requestService.ts` and `offerService.ts` to ensure:
  - [ ] Zome call functions are correctly formatting input data (including new fields)
  - [ ] Data returned from (mocked) zome calls is correctly mapped/processed

#### End-to-End Tests (`ui/tests/e2e` - Likely Playwright)

- [ ] Write/Update E2E tests for the Request creation/editing flow:
  - [ ] Navigate to the Request form
  - [ ] Fill in all fields, including the new ones (contact preference, date range, time zone, etc.)
  - [ ] Submit the form and verify successful creation (e.g., navigating to the detail page)
  - [ ] Verify the newly created/edited Request detail page displays all the new fields correctly
- [ ] Write/Update E2E tests for the Offer creation/editing flow:
  - [ ] Navigate to the Offer form
  - [ ] Fill in all fields, including the new ones (time preference, time zone, etc.)
  - [ ] Submit the form and verify successful creation/update
  - [ ] Verify the newly created/edited Offer detail page displays all the new fields correctly

#### Manual Testing & Refinement

- [ ] Perform end-to-end manual testing focusing on:
  - [ ] Creating/Editing Requests and Offers using various combinations of the new fields
  - [ ] Checking data persistence and correct display across different views (lists, detail pages)
  - [ ] Ensuring usability of new form inputs (date pickers, dropdowns, etc.)
- [ ] Address any bugs, inconsistencies, or usability issues identified
