# Work in Progress

This document tracks the current focus of development, recent changes, and next steps.

## Recent Updates

- Completed Issue #38: Align Request/Offer Features with Lightpaper
  - Updated UI components to display new fields (contact_preference, date_range, time_estimate_hours, time_preference, time_zone, exchange_preference, interaction_type, links)
  - Enhanced service methods to properly pass new data to Holochain backend
  - Updated card views to display key new fields
- Added detailed documentation for the Effect TS Event Bus pattern
- Updated Effect TS patterns rule to include Context/Layer and Event Bus patterns
- Added cross-reference to the Event Bus documentation in technical specifications
- Documented the core data flow (Rust Zomes -> Effect Services -> Svelte Stores -> UI) in `architecture.md`.
- Specified implementation patterns for services (Effect Layer) and stores (Svelte Factory + Runes) in `technical-specs.md`.
- Added detailed explanations of Service (Effect Layer) and Store (Svelte Factory/Runes + Effect) patterns to `documentation/technical-specs/ui-structure.md`.
- Updated the error handling examples in `documentation/technical-specs/ui-structure.md` to use the `Data.TaggedError` pattern.

## Current Focus

- Implementing testing for the new Request/Offer features (Issue #38)
- Building out the "Other" skill suggestion flow with admin review
- Improving documentation on functional patterns used in the codebase
- Ensuring consistent implementation of Effect TS patterns across the application
- Refining store communication patterns for better reactivity and state management

## Next Steps

- Complete frontend testing for new Request/Offer features
- Implement Skill Suggestion Flow for "Other" skill type
- Continue standardizing Effect TS usage throughout the application
- Expand test coverage for store and service layers
- Enhance error handling using the Effect TS patterns 