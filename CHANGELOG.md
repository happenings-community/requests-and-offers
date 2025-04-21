# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Documentation for `.cursor/rules/` and task list management (`7d2218f`).
- Detailed task list for Issue #38 (`d472cc7`).

### Changed
- Refined documentation, rules, and integrated Effect TS/Bun standards (`95997e1`).
- Revamped documentation structure and enhanced navigation (`0300116`, `74793a6`, `156e65f`).
- Updated administration rules (`9d58168`).
- Updated Request and Offer structures with new fields and validation (`4444bae`).
- Migrated tooling to Bun and updated README structure (`205bfbf`).
- Updated UI structure documentation for Effect TS integration and feature-based organization (`457f725`).
- Enhanced UI components with responsive patterns and optimizations (`78cfc23`).

### Deprecated
### Removed
### Fixed
### Security

## [0.1.0-alpha.1] - 2025-04-14

### Added

-   Initial implementation of core zomes for the Holochain backend.
-   Basic SvelteKit frontend structure with TailwindCSS.
-   Basic User Management: Create and view basic user profiles.
-   Simple Request System: Create and view basic requests.
-   Basic Offer System: Create and view basic offers.
-   Initial Admin Panel: Basic administrative interface.
-   Multiple distribution formats: `.deb`, `.AppImage`, `.exe`, `.webhapp`.

### Changed

-   This is the first alpha release with basic functionality. Many features are under development.
-   Connectivity between users is currently only possible through the Holochain Launcher.

### Known Issues

-   Minor UI Bug: Homepage displays a "404 Not Found" error on initial load (cosmetic).

[Unreleased]: https://github.com/happenings-community/requests-and-offers/compare/v0.1.0-alpha.1...HEAD
[0.1.0-alpha.1]: https://github.com/happenings-community/requests-and-offers/releases/tag/v0.1.0-alpha.1 