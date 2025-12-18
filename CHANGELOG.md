# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.3] - 2025-12-18

### 🐛 Bug Fixes & Quality Improvements Release

#### Bug Fixes
- **Holochain Peer Discovery**: Fixed incorrect peer count calculation in network discovery for accurate peer visibility (`ed780a7`)

#### Features
- **Atomic Feature Controls**: Implemented atomic development feature management system for granular control over development modes (`6dc74a9`)
- **Test Mode User List**: Enhanced test mode with dedicated user list functionality for improved testing workflows (`6dc74a9`)
- **Release Notes Template**: Added standardized release notes template for consistent documentation (`22fe065`)

#### Technical Improvements
- **hREA DNA Update**: Updated to hREA DNA version 0.3.4-beta for latest improvements and bug fixes (`e8fd4ca`)
- **Deployment Infrastructure**: Updated deployment submodules with latest configuration improvements (`22fe065`)

#### Development Experience
- **Improved Feature Management**: Atomic controls allow individual feature toggles without affecting other development settings
- **Enhanced Testing Environment**: Better test mode with user management capabilities for comprehensive testing scenarios
- **Documentation Standards**: Standardized release process with templates for better release communication

## [0.2.2] - 2025-12-08

### 🔧 Holochain v0.6 Migration & Build Infrastructure Release

#### Features
- **NetworkStatusPopup Component**: Extracted reusable network status popup component from NavBar for improved component separation and code reusability (`27fa3c2`)

#### Technical Improvements
- **Holochain v0.6 Compatibility**: Complete migration to Holochain 0.6.0 with updated HDK (0.6.0) and HDI (0.7.0) across all zomes (`cc05890`, `c26067d`)
- **Nix Flake Support**: Added reproducible Nix builds with flake.lock and Holochain 0.6.0 compatibility (`35b9112`)
- **WASM Build Configuration**: Updated custom getrandom backend configuration for Holochain compatibility and improved build process (`35b9112`)
- **Deployment Infrastructure**: Updated kangaroo-electron submodule for Holochain v0.6 compatibility with latest dependencies (`83848f0`)

#### Refactor
- **Component Architecture**: Extracted NetworkStatusPopup component with comprehensive network status display and Kangaroo API integration (`27fa3c2`)
- **Build System**: Simplified build process by removing Tauri-specific scripts and updating dependency version specifications (`35b9112`)
- **DNA Manifest**: Updated web-happ.yaml configuration for Holochain v0.6 compatibility (happ_manifest → happ) (`83848f0`)

#### Dependencies
- **Holochain Framework**: Upgraded from 0.5.x to 0.6.0 across entire project (`cc05890`, `c26067d`)
- **Client Libraries**: Updated to @holochain/client ^0.20.0 and hc-spin-rust-utils 0.600.0 (`83848f0`)
- **Nix Infrastructure**: Added flake.lock for reproducible builds with Holochain 0.6.0 (`35b9112`)
- **Rust Dependencies**: Updated getrandom backend configuration for WASM compatibility (`35b9112`)

## [0.2.1] - 2025-11-19

### Infrastructure & Debugging Enhancement Release

#### Features
- **Bootstrap Server Update**: Migrated from `holostrap.elohim.host/` to production-grade `bootstrap.holo.host/` for improved reliability and performance
- **Enhanced Network Debugging**: Improved debugging screens with comprehensive bootstrap and signal server status indicators
- **Real-time Connectivity Tests**: Added server connectivity diagnostics with response time measurements and status badges
- **Connection Health Monitoring**: Enhanced NetworkStatusPopup with WebSocket status indicators and troubleshooting information
- **Server Diagnostics**: Added comprehensive server health checks and certificate validation displays

#### Technical Improvements
- **Production Infrastructure**: Upgraded to production-grade bootstrap server infrastructure for enhanced stability
- **Enhanced Error Handling**: Better connection failure detection and user-friendly troubleshooting guidance
- **Network Visibility**: Improved visibility into network connectivity health and server status
- **Debugging Tools**: Built-in connectivity testing tools for better issue diagnosis

#### Bug Fixes
- **Bootstrap Server Reliability**: Resolved connectivity issues with previous bootstrap server configuration
- **Signal Server Stability**: Improved WebSocket connection handling and status reporting
- **Connection State Management**: Enhanced connection state tracking and UI synchronization

#### Documentation
- **Troubleshooting Guides**: Added comprehensive guides for new debugging and connectivity features
- **Server Configuration**: Updated documentation with new bootstrap server configuration patterns

#### Testing
- **Connectivity Testing**: Enhanced testing infrastructure for bootstrap and signal server connectivity
- **Network Diagnostics**: Improved test coverage for network debugging features

## [0.2.0] - 2025-11-15

### 🚀 UI/UX Enhancement Release

#### Features
- **Connection Status Display**: Enhanced connection status with interactive popup for better user feedback and network diagnostics (`9224cb1`)
- **Modal Layering System**: Improved UI modal layering and reorganized user components for better visual hierarchy (`66957b1`)
- **Admin Dashboard**: Enhanced admin dashboard with improved reactivity patterns and user management interface (`f814ad1`)

#### Bug Fixes
- **ActionBar Reactivity**: Resolved ActionBar reactivity issues and implemented event-driven status updates for consistent UI state (`03ecd28`)
- **User Profile Deserialization**: Fixed user profile update deserialization error preventing proper profile updates (`a0f601c`)
- **Frontend Improvements**: General frontend stability improvements and error handling enhancements (`a0f601c`)

#### Refactor
- **Service Type Links**: Removed service type links from user entities to simplify data model and improve performance (`aeb7e7c`)
- **Obsolete Files**: Deleted obsolete `ui/src/index.html` file as part of cleanup efforts (`bffbb94`)
- **User Components**: Reorganized user components architecture and moved ProfileStatusIndicator to dedicated users directory (`66957b1`)

#### Documentation
- **Admin Dashboard Analysis**: Added comprehensive admin dashboard reactivity analysis and optimization documentation (`f814ad1`)
- **Build Configuration**: Documented build configuration optimizations and performance improvements (`f814ad1`)
- **Release Patterns**: Added v0.1.10 release patterns and session completion documentation for development workflow (`459e566`)

#### Testing
- **Store Events**: Enhanced store event system with improved type safety and error handling (`66957b1`)
- **User Management**: Improved user management testing with comprehensive scenario coverage (`66957b1`)
- **Administration**: Enhanced administration interface testing with better error simulation (`66957b1`)

#### Build & Deployment
- **Deployment Submodules**: Updated deployment submodules for latest desktop application releases (`bffbb94`)
- **Build Optimization**: Optimized build configuration for better performance and reduced bundle size (`f814ad1`)
- **Development Features**: Enhanced development features system with better environment management (`f814ad1`)

## [0.1.10] - 2025-11-05

### 🚀 Development Network Release

#### Features
- **Access Control Enhancement**: Implement comprehensive access control improvements and user experience enhancements (`c6e12ab`)
- **Network Diagnostics**: Enhanced network diagnostics and connection monitoring for improved reliability (`813d8c1`)
- **Error Handling**: Improved error handling and removed race conditions in user initialization (`e178383`)
- **Serena AI Integration**: Implemented Serena AI integration and cleanup deprecated deployment infrastructure (`e4eb503`)
- **Deployment Automation**: Added comprehensive Deployment Automation Skill with proven production patterns (`735e100`)

#### Documentation
- **Docker Compose Configurations**: Added comprehensive Docker Compose configurations for Holochain bootstrap server (`47f08b6`)
- **Deployment Process Documentation**: Replaced automated deployment guide with current working process (`f204170`)
- **Release Documentation**: Added comprehensive v0.1.9 release documentation and update deployment submodules (`0681c49`)
- **Release Checklist**: Updated RELEASE_CHECKLIST.md with v0.1.9 lessons learned and proven patterns (`5b82bc6`)

#### Bug Fixes
- **Homebrew Installation**: Resolved Homebrew installation npm dependency issue (`60c684c`)

#### Build & Deployment
- **Version Management**: Unified versioning across main repository and kangaroo desktop application (`a255879`)
- **Cross-Platform Builds**: Desktop applications building with manual upload strategy for maximum reliability following v0.1.9 success patterns
- **CI/CD Pipeline**: GitHub Actions builds for Windows, macOS (Intel & ARM), and Linux platforms

#### Network Configuration
- **Development Network**: Updated bootstrap and signal URLs to dev-test infrastructure for enhanced testing capabilities
- **Network Seed Management**: Updated to 'alpha-test-2025' for coordinated development testing
- **Infrastructure**: Utilizes dev-test-bootstrap2.holochain.org for coordinated development testing

## [0.1.9] - 2025-10-23

### 🚀 Cross-Platform Desktop Integration Release

#### Features
- **Desktop App Integration**: Enhanced cross-platform compatibility with Kangaroo desktop application for improved user experience (`4aac497`)
- **Deployment Infrastructure**: Restructured deployment scripts with git submodule integration for improved automation (`b83a231`)
- **Repository Management**: Added deployment repositories as submodules for unified development workflow (`e471570`)
- **Admin Interface**: Integrated user filtering and search capabilities in admin interface (`1d0e310`)
- **User Management**: Implemented comprehensive user search and filtering with documentation cleanup (`b5427fa`)
- **Network Information**: Exposed network seed information via misc zome for better diagnostics (`cba5bea`)
- **Architecture Simplification**: Removed application runtime abstraction layer to streamline service architecture (`e31c032`)

#### Bug Fixes
- **Admin Panel**: Resolved admin panel loading issues and theme persistence problems (`ba99cd2`)
- **Application Initialization**: Simplified application startup logic and improved Holochain connection reliability (`607c338`)
- **Service Types**: Resolved initialization race condition and improved connection management (`0c222b2`)
- **TypeScript**: Fixed compilation issues and improved error handling across application (`811244e`)

#### Refactor
- **Agent OS Framework**: Completed removal of legacy Agent OS framework files for cleaner codebase (`09872ea`, `f75656c`)
- **Service Type Simplification**: Enhanced test coverage following service type simplification (`5cd7814`)
- **Runtime Architecture**: Centralized dependency injection with unified AppServicesTag (`5890691`)

#### Documentation
- **Skills Framework**: Added comprehensive Claude Skills development framework with Effect-TS and Holochain patterns (`10a7f99`)
- **Product Documentation**: Complete Agent OS product documentation and kangaroo-electron minimal configuration specifications (`3aaa7b5`, `61c3545`)
- **Meeting Notes**: Updated development meeting notes and refined listings UI layout (`8c36026`)
- **Implementation Plans**: Added comprehensive implementation plans for network seed logging and deployment restructuring (`e968db1`, `1dc26ca`, `b83a231`)
- **Release Documentation**: Enhanced release checklists and documentation for systematic deployment process (`1061fce`, `5a25ce6`)

#### Testing
- **Test Infrastructure**: Enhanced test coverage and organization following architectural improvements (`4ea7aa2`)
- **Mock Services**: Updated mock services with new network information methods (`397d3e0`)

#### Build & Maintenance
- **Version Management**: Automated version bumping and webhapp build fixes (`56d57de`, `cc7293a`, `a1e2ac8`)

## [0.1.8-patch2] - 2025-10-08

### Features

- **Network Information API**: Implemented network seed information exposure via misc zome, enabling better network diagnostics, verification, and troubleshooting capabilities (`cba5bea`)

### Architecture

- **Service Layer Simplification**: Removed application runtime abstraction layer to streamline the service architecture, reducing complexity and improving maintainability (`e31c032`)

### Documentation

- **Network Seed Verification**: Added comprehensive implementation documentation for network seed logging and verification features (`e968db1`)
- **Release Process**: Created detailed RELEASE_CHECKLIST.md with systematic deployment procedures for consistent and reliable releases (`1061fce`)

### Fixed

- **TypeScript Build**: Resolved TypeScript compilation issues in webhapp build process (`56d57de`)
- **Type Safety**: Fixed all svelte-check errors and enhanced release documentation with environment variable requirements (`a1e2ac8`)

## [0.1.8-patch1] - 2025-09-29

### Build System Improvements

- **Fixed TypeScript Errors**: Resolved all svelte-check errors that were blocking the webhapp build process
- **Enhanced Release Documentation**: Updated RELEASE_CHECKLIST.md with comprehensive environment variable requirements for test mode builds
- **Improved Type Safety**: Fixed Effect-TS type errors in test files and store implementations
- **Build Infrastructure**: Enhanced build process to ensure test mode builds (no development features) work correctly

### Technical Fixes

- **Import Path Corrections**: Fixed incorrect relative imports to use proper package imports
- **Property Access Fixes**: Resolved TypeScript errors with dynamic property access using proper type casting
- **Test Infrastructure**: Enhanced test mocking with proper AppServicesTag implementations
- **State Management**: Fixed missing state variable declarations in Svelte components

## [0.1.8] - 2025-09-23

### Desktop Application Updates

The Kangaroo Electron desktop application has received significant improvements:

#### Network Setup System
- **New Network Configuration Flow**: First-time users are now guided through a network setup process that allows:
  - Creating a new network instance for your community
  - Joining an existing network via invitation link
  - Automatic network configuration persistence
  - Improved error handling and validation for network setup

#### Technical Improvements
- **Enhanced Network Invite System**: Implemented a comprehensive network invite system for easier onboarding of new community members (`c6c3234`).
- **Network Setup UI**: Added dedicated network setup interface with clear user guidance (`081a172`).
- **Error Handling**: Improved network setup error handling and validation for better user experience.
- **Build Configuration**: Fixed electron-vite build configuration for network setup HTML resources (`646f38d`).
- **Function Exposure**: Exposed necessary functions for onclick handlers in the UI (`d58d3f5`).

#### Deployment Process
- **Semantic Versioning Update**: Transitioned to simplified semantic versioning (0.1.8) from alpha versioning scheme.
- **Automated Release Pipeline**: Leveraging the comprehensive deployment system introduced in alpha.7 for streamlined releases.

### Notes
- Main application functionality remains unchanged from v0.1.0-alpha.7
- This release focuses on improving the desktop application experience, particularly for new users
- The network setup feature simplifies community deployment and member onboarding

## [0.1.0-alpha.7] - 2025-09-17

### Features

- Implemented simplified bulletin board MVP by removing complex exchange features while preserving core functionality for streamlined user experience (`ab46206`).
- Added streamlined contact modal system for simplified bulletin board with direct communication capabilities (`fe4ffec`).
- Enhanced accepted user validation at data layer for requests and offers to improve data integrity (`8541648`).
- Implemented comprehensive Phase 2 UI/UX enhancements for simplified bulletin board experience (`ed7bed0`).
- Added comprehensive automated deployment system for improved release management (`a2779b9`).
- Implemented separate response status tracking with reason system for exchanges (`cf44173`).

### Refactor

- Improved Effect-TS type safety in requests store and utilities for better code reliability (`1f70473`).
- Implemented comprehensive documentation reorganization and cleanup after MVP simplification (`30e701b`).
- Enhanced exchanges type safety and completed terminology migration across the system (`ec85e05`).
- Standardized TypeScript types and code formatting across components for consistency (`b83806d`).
- Completed namedCells migration for multi-DNA test reliability and improved testing infrastructure (`714b3d0`, `548c48f`, `3b11d22`).
- Modernized testing infrastructure and dependencies for better development experience (`3b11d22`).

### Fixed

- Resolved Issue #57 with successive profile updates and hash preservation for improved user management (`2866c9f`).
- Fixed administration action hash chain traversal in status management system (`1fdeff0`).
- Enhanced user auto-acceptance behavior in testing infrastructure (`5d0e1fe`).

### Testing

- Aligned test infrastructure with simplified bulletin board MVP for consistency (`5051764`).
- Enhanced testing infrastructure with comprehensive administration test coverage (`5d0e1fe`).
- Implemented namedCells migration for improved multi-DNA test reliability (`548c48f`).

### Documentation

- Restructured AI rules and added Windsurf integration with UI access control enhancements (`7ab32f3`).
- Added project board configuration and DNA ordering diagnostics for better tooling (`3fdc129`).
- Implemented comprehensive documentation reorganization after MVP simplification (`30e701b`).

### Maintenance

- Migrated from bun.lockb to bun.lock format and improved UI consistency (`e306fb3`).

## [0.1.0-alpha.6] - 2025-08-22

### Features

- Implemented comprehensive exchanges functionality with response management, approval/rejection system, and duplicate prevention across the entire workflow (`a1f5de7`, `10c79fc`, `060f991`, `9040dd5`, `541deed`).
- Enhanced bidirectional response management with improved UI and agent-specific filtering for exchanges (`060f991`, `9040dd5`).
- Added singleton store pattern for exchanges to prevent duplicate responses and improve state consistency (`10c79fc`).
- Enhanced organizations domain with legal name field requirements and Exchange Coordinator role clarity (`50ff94f`, `6b4dba5`, `9380d75`).
- Implemented comprehensive service type management with filtering, status tracking, and table layout conversion (`9562f42`, `85bee1e`).
- Added enhanced mediums of exchange UI components and improved type system with selector UX improvements (`8da77e0`, `e69484a`).
- Implemented comprehensive connection management and status monitoring system with resilience improvements (`416f2d7`, `4c788dd`).
- Added Effect-first SvelteKit layout implementation milestone with complete architecture integration (`bf85f8e`).
- Implemented domain initialization lock system to prevent Holochain race conditions during startup (`2b39116`).
- Added centralized runtime error system with Effect-first layout integration for improved error handling (`86f19cb`).
- Implemented comprehensive Application Runtime Layer for Effect-first architecture pattern (`b4b9dc7`).
- Added Effect-SvelteKit integration utilities for seamless Effect-first application development (`9be9421`).
- Introduced comprehensive GitHub project management command with intelligent automation capabilities (`643ee5b`).

### Refactor

- Simplified exchange response mapping and improved code formatting consistency across the exchanges system (`4e74b95`).
- Renamed exchange proposal to exchange response across the entire system for better clarity (`24475be`).
- Simplified exchanges workflow architecture by removing complex cancellation and event systems for cleaner implementation (`3ac3abd`).
- Standardized domain stores with centralized helper patterns for improved code organization (`7ab3d7f`, `ca7f432`).
- Pivoted to native Holochain exchange implementation for Alpha 6, removing hREA dependencies for simpler architecture (`2ac892d`, `0745fdc`).

### Fixed

- Improved exchange timestamp consistency and external call reliability for better system stability (`36726d0`).
- Enhanced connection resilience and admin status preservation during network issues (`4c788dd`).
- Fixed import paths and code formatting cleanup across service types components (`e66baba`).

### Testing

- Added comprehensive tests for MediumOfExchangeSelector and ServiceTypesTable components with full coverage (`764ade9`).
- Implemented complete unit test suite for exchanges service and store layers with comprehensive scenarios (`61c3575`).

### Documentation

- Added implementation plan for meeting 11-08-25 fixes with detailed task breakdown (`4aab236`).
- Created comprehensive Exchange Process feature documentation with complete workflow specifications (`fe621fa`).
- Completed Effect-TS architecture documentation milestone with comprehensive patterns and guidelines (`905c55a`).
- Enhanced documentation-first approach and standardized development guidelines across the project (`e36cd2e`).
- Implemented comprehensive documentation restructure and enhancement for better developer experience (`8934edc`).
- Added comprehensive Kangaroo Electron deployment process guide for desktop applications (`c25d9da`).
- Expanded hREA entity mapping plan with comprehensive proposal and intent infrastructure documentation (`1dfd7f4`).

### Maintenance

- Migrated to PostCSS and improved development tooling for better build performance (`4223375`).
- Enhanced documentation cleanup with improved whitespace and formatting consistency (`51157c0`).

## [0.1.0-alpha.5.1] - 2025-07-29

### Fixed

- Enhanced Holochain connection reliability with exponential backoff retry logic (`edcefbb`).
- Improved error handling during application initialization for better startup experience (`edcefbb`).
- Better loading UI with troubleshooting guidance for network timing issues (`edcefbb`).
- Robust recovery from network problems and conductor timing issues (`edcefbb`).

### Desktop Apps

- Complete cross-platform asset build for Windows, macOS (Intel & Apple Silicon), and Linux distributions.
- Updated Homebrew formula to version 0.1.0-alpha.5.1 with new SHA256 checksums.
- All Alpha 5 desktop applications remain fully compatible with reliability improvements.

## [0.1.0-alpha.5] - 2025-07-29

### Features

- Introduced Avatar Utilities and Guard Composables patterns for enhanced user experience with consistent avatar management and reactive access control using Svelte 5 runes (`3aff6a3`).
- Added UserAccessGuard component and useUserAccessGuard composable for improved user access management and better state handling (`3aff6a3`).
- Implemented UserAvatar component with consistent avatar display and fallback placeholder functionality (`3aff6a3`).
- Enhanced PrerequisitesGuard component with improved state management and error handling (`3aff6a3`).
- Expanded E2E test coverage with comprehensive Holochain integration including realistic data generation, admin workflows, and complex user journey tests (`47fb5a4`).
- Added comprehensive medium of exchange management in admin panel with full CRUD operations and validation (`47fb5a4`).
- Introduced cross-entity relationship tests and data integrity validation for improved test coverage (`47fb5a4`).
- Enhanced service type details handling with better UI components and improved error management (`38dcb52`).
- Implemented comprehensive hREA integration with event-driven user-to-agent mapping and enhanced GraphQL mutations (`5b50e7b`, `abb7e96`).
- Added comprehensive documentation for codebase navigation and medium of exchanges functionality (`fe1cbbe`, `9907be7`).
- Implemented complete Medium of Exchange zome with full CRUD operations, suggestion system, and hREA Resource Specification mapping (`3d05325`, `c1102cb`, `7c29457`, `17bf8f6`).
- Integrated hREA (Holochain Resource-Event-Agent) framework with auto-sync for Service Types, complete agent mapping system, and GraphQL mutations (`d35c3f6`, `b0bda95`, `d368815`, `abb7e96`).
- Added PrerequisitesGuard component for service types and mediums of exchange validation with comprehensive status checking (`2f67d94`).
- Enhanced user interface with new dropdown navigation components and improved user experience (`0f6d83c`).
- Implemented comprehensive organization retrieval functionality with enhanced error handling (`9765bc8`).
- Added Effect-TS integration across components for improved asynchronous handling (`340d72d`).

### Refactor

- Replaced E.runPromise with standardized runEffect utility across all components for consistent Effect-TS integration and improved error handling (`91ff74f`).
- Polished UX and navigation interface before alpha 5 release with enhanced user feedback and streamlined component interactions (`b02d73f`).
- Enhanced dark mode support across offers and requests components with improved color contrast and user feedback (`727762c`).
- Improved OffersTable and RequestsTable with Medium of Exchange display and better layout visibility (`727762c`).
- Updated service types management for improved mode handling and reactivity (`38dcb52`, `661e60c`).
- Enhanced user interface components with better error handling and improved asynchronous operations (`dfa8370`).
- Streamlined request form management with improved composable patterns and submission process (`f070be1`, `108c83a`).
- Enhanced service type loading and error handling with better store interactions (`f7c9525`, `a5712ab`).
- Improved offers management with enhanced state handling and error management (`5bbc5cc`).
- Restructured OfferForm component for improved layout and functionality (`9e47f0d`).
- Enhanced status history handling with improved data structure and event-driven updates (`7d8b6ff`).
- Streamlined HolochainClientService logic and improved hREA store documentation (`f449103`).
- Enhanced error handling system with standardized patterns across domains (`b2ddbd9`, `17a8c76`).
- Major architectural transformation to unified Effect-TS 7-layer pattern with standardized service layer, store factory functions, and comprehensive error handling (`108c83a`, `06489f1`, `e9f8695`).
- Complete store standardization with 9 helper functions across all domains including cache sync, event emission, and loading state management (`fb52766`, `424964a`, `1c006ec`).
- Enhanced service types store with comprehensive utility functions and error handling patterns (`4a777b3`, `0a1bb65`).
- Improved Holochain client integration with better error handling and connection management (`4142e2d`).

### Testing

- Added comprehensive E2E test coverage with Playwright integration including admin workflows, user journeys, and complex scenarios (`47fb5a4`).
- Implemented realistic data generation and Holochain data seeder for comprehensive testing (`47fb5a4`).
- Enhanced integration tests with improved Effect library handling and better mock services (`f9af1d6`).
- Added unit tests for hREA service and store with comprehensive Effect-TS coverage (`581a158`).
- Introduced developer tools with TDD test page for status history verification and debugging (`8e90193`).
- Enhanced testing documentation with improved test commands and coverage guidelines (`865adfc`).

### Fixed

- Resolved Svelte 5 state proxy serialization errors by sanitizing arrays with spread operator to prevent "An object could not be cloned" errors (`8e90193`).
- Fixed status history bugs with frontend workaround for backend limitations, ensuring complete chronological display (`8e90193`).
- Improved reactive status history updates with proper event bus integration and real-time status changes (`8e90193`).
- Fixed EntityStatusHistory method for proper statuses retrieval and enhanced data handling (`a6a131b`).
- Enhanced request form and service type handling with better error management and validation (`f7c9525`).
- Corrected user and administration store interactions for proper user status management (`e8557cf`, `47fb5a4`).
- Updated user creation logic to utilize proper onSubmit function and improved form handling (`aa4fd06`).
- Improved navigation alignment and added comprehensive store documentation (`730a1c4`).
- Fixed method calls and improved TailwindCSS class consistency across components (`35af90e`).
- Resolved component initialization timing and formatting issues for better reliability (`60525a6`).
- Updated app source path handling in misc.test.ts for proper test execution (`d6f7ec1`).

### Documentation

- Added comprehensive documentation index for project navigation with detailed codebase documentation (`9907be7`).
- Enhanced medium of exchanges feature documentation with complete implementation details (`fe1cbbe`).
- Updated CLAUDE.md with implementation status and standardized store helper functions documentation (`a540ea6`).
- Introduced Effect-TS coding guidelines and enhanced composable patterns documentation (`544a0a3`).
- Added comprehensive testing documentation with E2E Playwright Holochain integration plan (`47fb5a4`).
- Enhanced hREA integration documentation with comprehensive tutorial and implementation details (`f752650`).
- Updated architecture and status documentation to reflect unified Effect-TS integration (`9ada67d`).
- Added comprehensive store event bus guidelines for Svelte stores (`4b0b013`).
- Updated project overview and technical specifications for clarity and current state (`f449103`).

### Dependencies

- Updated Cargo.lock and package.json for improved compatibility and security updates (`dd060eb`).
- Enhanced dependency management across zomes with updated Cargo.toml files (`dd060eb`).

### Maintenance

- Removed outdated workflow documents and obsolete migration plans for cleaner project structure (`318f62a`, `36b95f2`).
- Enhanced project documentation structure and removed obsolete files (`36b95f2`).
- Cleaned up unused code and enhanced component functionality across the application (`661e60c`).
- Updated ESLint configuration and improved development tooling (`47fb5a4`).
- Enhanced Vite and testing configurations for better development experience (`47fb5a4`).

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
