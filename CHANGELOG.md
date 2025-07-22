# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0-alpha.5] - 2025-07-22

### Features

- Implemented complete Medium of Exchange zome with full CRUD operations, suggestion system, and hREA Resource Specification mapping (`3d05325`, `c1102cb`, `7c29457`, `17bf8f6`).
- Integrated hREA (Holochain Resource-Event-Agent) framework with auto-sync for Service Types, complete agent mapping system, and GraphQL mutations (`d35c3f6`, `b0bda95`, `d368815`, `abb7e96`).
- Added PrerequisitesGuard component for service types and mediums of exchange validation with comprehensive status checking (`2f67d94`).
- Enhanced user interface with new dropdown navigation components and improved user experience (`0f6d83c`).
- Implemented comprehensive organization retrieval functionality with enhanced error handling (`9765bc8`).
- Added Effect-TS integration across components for improved asynchronous handling (`340d72d`).

### Refactor

- Major architectural transformation to unified Effect-TS 7-layer pattern with standardized service layer, store factory functions, and comprehensive error handling (`108c83a`, `06489f1`, `e9f8695`).
- Complete store standardization with 9 helper functions across all domains including cache sync, event emission, and loading state management (`fb52766`, `424964a`, `1c006ec`).
- Enhanced error handling system with domain-specific tagged errors and centralized error contexts (`17a8c76`, `b2ddbd9`, `dfa8370`).
- Restructured OfferForm component for improved layout and functionality with better service type integration (`9e47f0d`).
- Updated status history handling and improved data structure across administration components (`7d8b6ff`).
- Enhanced service types store with comprehensive utility functions and error handling patterns (`4a777b3`, `0a1bb65`).
- Improved Holochain client integration with better error handling and connection management (`4142e2d`).

### Testing

- Expanded E2E test coverage with Holochain integration and enhanced documentation for comprehensive testing workflows (`47fb5a4`).
- Added unit tests for hREA service and store with Effect library integration (`581a158`, `5cab2f4`).
- Enhanced testing documentation with improved test commands and coverage guidelines (`865adfc`).
- Streamlined mock functions and integrated Effect library for asynchronous handling in tests (`f9af1d6`).

### Fixed

- Fixed EntityStatusHistory method for proper statuses retrieval and data handling (`a6a131b`).
- Improved navigation alignment and added comprehensive store documentation (`730a1c4`).
- Corrected method calls and improved TailwindCSS class consistency across components (`35af90e`).
- Resolved component initialization timing and formatting issues (`60525a6`).
- Fixed user and administration store interactions for proper user status management (`e8557cf`, `47fb5a4`).
- Updated user creation logic to utilize proper onSubmit function (`aa4fd06`).
- Enhanced request form and service type handling with better error management (`f7c9525`, `f070be1`).

### Documentation

- Added comprehensive documentation index for project navigation with enhanced codebase documentation (`9907be7`, `fe1cbbe`).
- Introduced Effect-TS coding guidelines and enhanced composable patterns documentation (`544a0a3`, `06489f1`).
- Updated architecture and status documentation to reflect unified Effect-TS integration (`9ada67d`, `f449103`).
- Enhanced hREA integration documentation with comprehensive tutorial and implementation plan (`f752650`).
- Added comprehensive medium of exchanges feature documentation (`fe1cbbe`).
- Updated project overview and technical specifications for clarity and current state (`f449103`).

### Dependencies

- Updated Cargo.lock and package.json for improved compatibility and latest dependencies (`dd060eb`).
- Enhanced dependency management with Cargo.toml updates across zomes (`dd060eb`).

### Maintenance

- Removed outdated workflow documents and cleaned up obsolete files (`318f62a`).
- Enhanced documentation structure and removed outdated Holochain 0.4 to 0.5 migration plan (`36b95f2`).
- Cleaned up unused code and enhanced component functionality (`661e60c`).
- Updated app source path handling in test configurations (`d6f7ec1`).

## [0.1.0-alpha.4] - 2025-06-16

### Features

- Implemented comprehensive service type status management and moderation system with pending, approved, and rejected states (`1c43756`, `26fb4c5`, `5cd2e36`).
- Added complete tag-based discovery functionality for offers and requests, enabling users to find content by tags (`afbbc91`).
- Introduced tag-based search and filtering system for service types with autocomplete and tag cloud components (`d33427c`).
- Enhanced PromptModal component with password visibility toggle and caps lock detection for improved user experience (`5cc9ac2`, `c97abd3`).
- Implemented service type suggestion workflow allowing users to contribute to the platform taxonomy (`3198c2f`, `024c606`).
- Added comprehensive ServiceType management UI with ActionBar and Grid components for better organization (`761d1bd`).
- Introduced mocked service type generation for testing and development purposes (`024c606`).
- Enhanced TimeZoneSelect component with auto-selection capabilities across all forms (`4f2a3f3`).
- Added direct approval and deletion capabilities for rejected service types in admin interface (`3f48377`).
- Implemented user acceptance verification for service type suggestions (`2a43898`).

### Refactor

- Major restructuring of service type management interface using composable patterns and focused components (`761d1bd`).
- Enhanced service type store with comprehensive state management for pending, approved, and rejected states (`e338948`, `26fb4c5`).
- Improved navigation components to reflect new service types structure replacing projects (`e338948`).
- Streamlined service type UI components with better error handling and reactivity (`26fe780`).
- Reorganized admin service type pages to show only approved types with pending count indicators (`3f48377`).

### Testing

- Added comprehensive test suite for service type status management including user suggestions, admin moderation, and access control (`5cd2e36`, `aadbec1`).
- Implemented extensive tag-related functionality tests covering search, filtering, and statistics (`258bb3f`).
- Enhanced integration and unit tests for service type management and tag discovery features (`26fe780`, `afbbc91`).
- Added component tests for ServiceTypeModerationTable and ServiceTypeSuggestionForm (`aadbec1`).
- Introduced comprehensive tag-based discovery tests for cross-zome functionality (`afbbc91`).

### Fixed

- Improved service type management UI reactivity and data loading with parallel fetching (`26fe780`).
- Enhanced administrator removal method to accept multiple agent public keys (`67fcfbe`).
- Fixed service type deletion to properly handle removal from all state arrays (`3f48377`).
- Improved service type suggestion flow with proper user acceptance checks (`2a43898`).
- Enhanced page visibility detection to refresh data when returning to service types pages (`26fe780`).

### Documentation

- Updated service types zome specification with cross-zome interaction details and testing status (`62eae26`).
- Refreshed project overview and technical specifications to reflect service types implementation (`62eae26`).
- Updated task lists and status documentation with completed features and remaining work (`62eae26`).
- Enhanced testing guidelines and added new task lists for tag search functionality (`258bb3f`).

### Maintenance

- Updated package dependencies and cleaned up obsolete files (`5cd2e36`).
- Enhanced ESLint configuration for tests directory (`5cd2e36`).
- Improved Vite configuration to support top-level await with ES2022 target (`505d7ec`).

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
