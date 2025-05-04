# Architecture Overview

This document provides a high-level overview of the system architecture, including design patterns, key technical decisions, and component relationships.

## Key Sections

- **[General Overview](./architecture/overview.md)**: System structure and design principles.
- **[hREA Integration](./architecture/hrea-integration.md)**: Details on integrating with the hREA framework.

## Core Data Flow

The application follows a typical data and control flow from the backend to the frontend:

1.  **Rust Zomes (Holochain Backend):** Execute core business logic and manage data persistence on the DHT.
2.  **Effect Services (`ui/src/lib/services`):** Encapsulate communication with Holochain zomes. They wrap zome calls within Effect computations, handling async operations and errors. Services are defined using Effect's Tag/Layer pattern for dependency injection.
3.  **Svelte Stores (`ui/src/lib/stores`):** Manage application state using Svelte 5 Runes (`$state`). They orchestrate user actions by running Effect pipelines that call methods on the Effect Services. Stores update their reactive state based on service results.
4.  **Svelte UI Components (`ui/src/lib/components`):** Subscribe to reactive state in the Stores and trigger actions by calling store methods.

This layered approach separates concerns, leveraging Effect TS for robust service logic and Svelte Runes for efficient UI reactivity. 