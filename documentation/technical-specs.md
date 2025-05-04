# Technical Specifications Overview

This document outlines the technical foundation of the project, including technologies used, development setup, dependencies, and specific implementation details.

## Key Sections

- **[General Specs](./technical-specs/general.md)**: Overall technical requirements and constraints.
- **[UI Structure](./technical-specs/ui-structure.md)**: Frontend architecture, components, and state management details.
- **[Event Bus Pattern](./technical-specs/event-bus-pattern.md)**: Event-based communication using Effect TS.
- **[Zome Details](./technical-specs/zomes/README.md)**: Detailed documentation for each Holochain zome.

## Implementation Patterns

-   **Services (`ui/src/lib/services`):** Implemented as **Effect Services**. Define a service interface, a `Context.Tag`, and provide the implementation via an Effect `Layer`. Internal state (if needed) uses Effect `Ref`. This pattern facilitates dependency injection and composition within Effect workflows.
-   **Stores (`ui/src/lib/stores`):** Implemented using **Svelte Factory Functions**. These factories use Svelte 5 Runes (`$state`, `$derived`, etc.) internally to manage reactive UI state. Store methods orchestrate actions by creating and running `Effect` pipelines, which often consume the Effect Services. 