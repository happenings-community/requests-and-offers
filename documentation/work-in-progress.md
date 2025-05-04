# Work in Progress

This document tracks the current focus of development, recent changes, and next steps.

## Recent Updates

- Added detailed documentation for the Effect TS Event Bus pattern
- Updated Effect TS patterns rule to include Context/Layer and Event Bus patterns
- Added cross-reference to the Event Bus documentation in technical specifications
- Documented the core data flow (Rust Zomes -> Effect Services -> Svelte Stores -> UI) in `architecture.md`.
- Specified implementation patterns for services (Effect Layer) and stores (Svelte Factory + Runes) in `technical-specs.md`.
- Added detailed explanations of Service (Effect Layer) and Store (Svelte Factory/Runes + Effect) patterns to `documentation/technical-specs/ui-structure.md`.
- Updated the error handling examples in `documentation/technical-specs/ui-structure.md` to use the `Data.TaggedError` pattern.

## Current Focus

- Improving documentation on functional patterns used in the codebase
- Ensuring consistent implementation of Effect TS patterns across the application
- Refining store communication patterns for better reactivity and state management

## Next Steps

- Continue standardizing Effect TS usage throughout the application
- Expand test coverage for store and service layers
- Enhance error handling using the Effect TS patterns 