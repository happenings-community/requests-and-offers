# Task List for Issue #38: Align Request/Offer Features with Lightpaper

This list outlines the steps to implement the features described in GitHub issue #38, broken down into logical phases.

## Phase 1: Data Structure Definition & Backend Foundation

### Shared Types (`dnas/requests_and_offers/utils/src/types.rs`)

- [ ] Add new public enums with `#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]`:
  - [ ] `ExchangePreference { Barter, Gift, Payment, Negotiable }`
  - [ ] `ContactPreference { AppChat, Email, Phone, Other }`
  - [ ] `RequestType { Need, Want, Transfer }`
  - [ ] `OfferType { Service, Good, Transfer }`
- [ ] Add new public struct `DateRange` with `#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]`:

    ```rust
    #[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
    pub struct DateRange {
      pub start: Option<Timestamp>,
      pub end: Option<Timestamp>,
    }
    ```

- [ ] Define a type alias or use `String` for `TimeZone` initially (e.g., `pub type TimeZone = String;`). Consider integrating a timezone crate later if needed.

### Request Zomes

#### Integrity (`dnas/requests_and_offers/zomes/integrity/requests/src/request.rs`)

- [ ] Update `Request` struct definition:
  - [ ] Add `contact_preference: Option<ContactPreference>`
  - [ ] Add `date_range: Option<DateRange>`
  - [ ] Add `date_posted: Timestamp` (Ensure it's added if not implicitly handled by entry creation).
  - [ ] Add `time_estimate_hours: Option<f32>`
  - [ ] Add `time_preference: Option<String>` (Free text)
  - [ ] Add `time_zone: Option<TimeZone>` (Using the type alias/String)
  - [ ] Add `exchange_preference: Option<ExchangePreference>`
  - [ ] Add `request_type: RequestType`
  - [ ] Review `requirements: Vec<String>` - Ensure it aligns with "Keywords" and "Specific Skill". No change needed if interpretation fits.
  - [ ] Remove/Update `urgency: Option<String>` if `date_range` covers the need.
- [ ] Enhance `validate_request` function:
  - [ ] Add validation for mandatory fields (`request_type`).
  - [ ] Add basic validation for optional fields where applicable (e.g., check `time_estimate_hours` > 0 if present).
  - [ ] Ensure existing `title`, `description`, `requirements` validation remains.
- [ ] Implement specific logic in `validate_update_request`:
  - [ ] Determine which fields are mutable after creation (e.g., maybe `request_type` is immutable?).
  - [ ] Add validation checks for any attempted mutations of immutable fields.
  - [ ] Re-run relevant `validate_request` checks on the updated data.

#### Coordinator (`dnas/requests_and_offers/zomes/coordinator/requests/src/lib.rs`, etc.)

- [ ] Define/Update `CreateRequestInput` struct to include all new settable fields from the `Request` integrity entry.
- [ ] Modify `create_request` zome function:
  - [ ] Accept `CreateRequestInput`.
  - [ ] Populate the `Request` entry struct, including setting `date_posted` to `now()`.
  - [ ] Call `create_entry` with the populated `Request`.
  - [ ] Handle potential validation errors.
- [ ] Define/Update `UpdateRequestInput` struct (including the `original_request_hash` and the fields allowed to be updated).
- [ ] Modify `update_request` zome function:
  - [ ] Accept `UpdateRequestInput`.
  - [ ] Get the original entry and action.
  - [ ] Create the updated `Request` entry.
  - [ ] Call `update_entry`.
- [ ] Update return types (e.g., `RequestOutput`) for `get_request`, `create_request`, `update_request` to include all fields of the `Request` entry.
- [ ] Modify `get_request` zome function logic to fetch and return the full `Request` entry data.
- [ ] *Optional:* Add new query functions if useful for filtering (e.g., `get_requests_by_type(request_type: RequestType)`).

### Offer Zomes

#### Integrity (`dnas/requests_and_offers/zomes/integrity/offers/src/offer.rs`)

- [ ] Update `Offer` struct definition:
  - [ ] Add `qualifications_experience: Option<String>`
  - [ ] Add `time_zone: Option<TimeZone>` (Using the type alias/String)
  - [ ] Add `exchange_preference: Option<ExchangePreference>`
  - [ ] Add `offer_type: OfferType`
  - [ ] Review `capabilities: Vec<String>` - Ensure it aligns with "Type of Service". No change needed if interpretation fits.
  - [ ] Remove/Update `availability: Option<String>` if it's redundant or needs restructuring (e.g., integrate with `DateRange`?).
- [ ] Enhance `validate_offer` function:
  - [ ] Add validation for mandatory fields (`offer_type`).
  - [ ] Add basic validation for optional fields.
  - [ ] Ensure existing `title`, `description`, `capabilities` validation remains.
- [ ] Implement specific logic in `validate_update_offer`:
  - [ ] Determine mutable fields (e.g., maybe `offer_type` is immutable?).
  - [ ] Add validation for attempted mutations.
  - [ ] Re-run relevant `validate_offer` checks.

#### Coordinator (`dnas/requests_and_offers/zomes/coordinator/offers/src/lib.rs`, etc.)

- [ ] Define/Update `CreateOfferInput` struct.
- [ ] Modify `create_offer` zome function (Accept input, populate `Offer`, call `create_entry`).
- [ ] Define/Update `UpdateOfferInput` struct.
- [ ] Modify `update_offer` zome function (Accept input, get original, create updated `Offer`, call `update_entry`).
- [ ] Update return types (e.g., `OfferOutput`) for `get_offer`, `create_offer`, `update_offer`.
- [ ] Modify `get_offer` zome function logic.
- [ ] *Optional:* Add new query functions if useful (e.g., `get_offers_by_type(offer_type: OfferType)`).

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
