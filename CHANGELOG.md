# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0-alpha.3] - 2025-06-05

### Features

- Implemented comprehensive ServiceType management system with new coordinator and integrity zomes (`082a4f4`, `374cdcd`).
- Added ServiceType selection integration in Request and Offer forms (`039962d`).
- Introduced ServiceTypesGuard component for request and offer creation validation (`f27e277`).
- Enhanced ServiceType management with new UI components and DHT integration (`97ac32a`, `dee49e6`, `700e1f3`, `cd318fb`, `f78bc14`).
- Introduced Effect Schemas for robust form validation and data handling (`9357474`).
- Added service_type_action_hashes to Request/Offer entities (relates to #39) (`ce7d686`).

### Refactor

- Major transition from capabilities/requirements to service type integration across offers and requests (`7af63bd`, `6235ad3`).
- Enhanced request form and store functionality for improved user experience (`a010bec`).
- Improved offer management and service type integration (`55fdc0f`, `f157e60`).
- Streamlined service integration and enhanced error handling across services (`9ccf6d9`).
- Enhanced user management with service type integration (`17f002e`).
- Improved time and contact preference handling across components (`6535b81`).
- Enhanced modal structure and styling for improved user experience (`387b1ed`).
- Restructured ServiceTypeSelector integration and removed legacy components (`87bcc7c`, `43ca95d`).
- Enhanced ServiceType UI integration and error handling (`0e38c93`, `de1cd97`).
- Consolidated test configurations and fixed import paths (`20fbebd`).
- Reorganized AI documentation and updated gitignore (`3252d4f`).
- Enhanced organization error handling and return types (`72937de`).
- Removed unused StoreEventBusLive from offers and requests stores (`2c5f016`).

### Testing

- Enhanced integration tests for offers, requests, and service types (`60497e6`).
- Implemented offers-requests interaction tests with improved EventBus mock (`845db2c`).
- Fixed Effect TS usage in integration tests (`acee6ea`).

### Fixed

- Updated logo references across components and added new logo asset (`e286192`).
- Improved request store and UI components error handling with service type integration (`bed932c`, `8d1fb47`).
- Aligned service type entity references (`f1ca7a3`).
- Improved event emission logic and enhanced error handling in stores (`0a3f9a7`).
- Streamlined HolochainClientService and ServiceTypesService integration (`4eac252`).
- Updated task lists and fixed TypeScript errors in components (`4f5e4f1`).
- Updated package.json scripts and removed obsolete task documentation (`5366eaa`).

### Dependencies

- Updated thiserror from 1.0.69 to 2.0.12 (`24a4ecb`).
- Updated Rust and JavaScript dependencies (`ba13621`, `d4cb859`).

### Documentation

- Added implementation plan for Dynamic ServiceType DHT Entry (`fdb528f`).
- Updated CHANGELOG and documentation for version 0.1.0-beta.2 (`40dcab0`).

### Maintenance

- Aligned import paths with SvelteKit conventions (`f72b569`).
- Removed legacy rule files and updated .gitignore (`e3a4321`).

## [0.1.0-alpha.2] - 2025-05-07

### Features

- Introduced Event Bus using Effect TS for improved state management across the application (`d14069d`).
- Enhanced Request and Offer structures with new fields and validation logic (`7b9f0bf`).
- Integrated Luxon for consistent date/time handling and timezone support (`c78db00`).
- Added new form components for User and Organization management (`576a971`, `82e1fe6`).
- Completed implementation of Request/Offer features for Issue #38 (`8d89f28`).
- Enhanced UI components with responsive patterns and optimizations (`78cfc23`).

### Refactor

- Migrated project tooling from `pnpm` to `bun` for improved performance (`205bfbf`).
- Introduced EntityCache enhancements with Effect TS integration (`62b1054`).
- Updated error handling to use Effect's Data.TaggedError pattern (`3e4739b`).

### Documentation

- Revamped documentation structure with clearer navigation and organization (`0300116`).
- Enhanced Request and Offer system documentation with detailed field specifications (`9a6700e`).
- Updated documentation for Effect TS patterns and Event Bus integration (`1daab0b`).
- Updated coding standards for Effect TS and Svelte 5 (`52c30eb`).

### Testing

- Enhanced testing guidelines and introduced new Vitest configurations (`9c62f29`).
- Added comprehensive test mocks for Offers and Requests stores (`4168788`).

### Fixed

- Updated `network_seed` in `dna.yaml` to `requests_and_offers_alpha` for consistency (`608a2a8`).
- Fixed RequestForm to properly handle requirements and links arrays (`7994bfb`).

## [0.1.0-alpha.1] - 2025-04-14

### Added

- Initial implementation of core zomes for the Holochain backend.
- Basic SvelteKit frontend structure with TailwindCSS.
- Basic User Management: Create and view basic user profiles.
- Simple Request System: Create and view basic requests.
- Basic Offer System: Create and view basic offers.
- Initial Admin Panel: Basic administrative interface.
- Multiple distribution formats: `.deb`, `.AppImage`, `.exe`, `.webhapp`.

### Changed

- This is the first alpha release with basic functionality. Many features are under development.
- Connectivity between users is currently only possible through the Holochain Launcher.

### Known Issues

- Minor UI Bug: Homepage displays a "404 Not Found" error on initial load (cosmetic).

[0.1.0-beta.2]: https://github.com/happenings-community/requests-and-offers/compare/v0.1.0-alpha.1...v0.1.0-beta.2
[0.1.0-alpha.1]: https://github.com/happenings-community/requests-and-offers/releases/tag/v0.1.0-alpha.1
