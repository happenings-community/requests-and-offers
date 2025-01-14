# UI Structure Documentation

This document provides a comprehensive overview of the UI structure for the Requests and Offers application.

## Project Structure

The UI is built with:

- SvelteKit as the framework
- TailwindCSS for styling
- SkeletonUI for UI components
- Svelte 5 features (runes and native HTML events)

Main directories:

- `/src/routes`: Application routes and pages
- `/src/lib`: Reusable components and utilities
- `/src/services`: Service layer for backend communication
- `/src/stores`: Svelte stores for state management
- `/src/types`: TypeScript type definitions
- `/src/utils`: Utility functions

## Routes

The application uses SvelteKit's file-based routing system with two main sections:

### Main Application Routes (`/src/routes/(app)/`)

Contains the main application routes that are accessible to regular users:

- `/`: Home page (`+page.svelte`)
- `/offers`: Offers management
- `/organizations`: Organization management
- `/projects`: Project management
- `/requests`: Request management
- `/user`: User profile and settings
- `/users`: User directory

Layout:

- `(app)/+layout.svelte`: Layout for main application routes

### Admin Routes (`/src/routes/admin/`)

Contains administrative routes and functionalities:

- `/admin`: Admin dashboard (`+page.svelte`)
- `/admin/administrators`: Administrator management
- `/admin/offers`: Offer administration
- `/admin/organizations`: Organization administration
- `/admin/projects`: Project administration
- `/admin/requests`: Request administration
- `/admin/users`: User administration

Layout:

- `admin/+layout.svelte`: Layout for admin routes

### Root Layout

- `+layout.svelte`: The root layout component that wraps all routes
- `+layout.ts`: Layout load function for initialization
- `+error.svelte`: Global error handling component

## Components

Located in `/src/lib`, organized by functionality:

### Core Navigation Components

- `NavBar.svelte`: Main navigation bar component
- `NavButton.svelte`: Navigation button component
- `MenuLink.svelte`: Menu link component
- `AdminSideBar.svelte`: Administrative sidebar component
- `ActionBar.svelte`: Action bar component with common actions

### Dialog Components

Located in `/src/lib/dialogs`, containing dialog UI components.

### Drawer Components

Located in `/src/lib/drawers`, containing drawer UI components.

### Modal Components

Located in `/src/lib/modals`, containing modal dialog components.

### Table Components

Located in `/src/lib/tables`, containing table and data grid components.

### SVG Components

Located in `/src/lib/svg`, containing SVG icons and graphics.

### Types

`types.ts`: Contains TypeScript type definitions for components.

## Services

Located in `/src/services`, handling all communication with the Holochain backend:

### HolochainClientService

Main service for Holochain client initialization and management (`HolochainClientService.svelte.ts`).

### Zome Services

Located in `/src/services/zomes`, containing specific zome interaction services.

The services layer is responsible for:

- Making calls to Holochain zomes
- Handling data transformation
- Managing backend communication state

## Stores

Located in `/src/stores`, managing application state using Svelte 5 runes:

### Administration Store

`administration.store.svelte.ts`: Manages administrative state and operations.

### Organizations Store

`organizations.store.svelte.ts`: Handles organization-related state and operations.

### Users Store

`users.store.svelte.ts`: Manages user-related state and operations.

Key features:

- Uses `$state` for reactive state management
- Uses `$derived` for computed values
- Uses `$effect` for side effects
- Implements native HTML events (onclick, oninput, onsubmit, etc.)

## Type System

Located in `/src/types`:

- TypeScript interfaces and types for the application
- Type definitions for Holochain data structures

## Testing

The UI includes:

- End-to-end tests using Playwright
- Type checking using "bunx sv check"
- Tests must be run using "nix develop --command [test command]" for proper environment setup
