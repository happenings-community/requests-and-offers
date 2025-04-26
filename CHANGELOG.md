# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Features

- Enhanced UI components with responsive patterns (dashboard layouts, responsive tables) and optimizations (`OrganizationsTable`, `OrganizationDetailsModal`) for improved user experience (`78cfc23`).

### Fixes

- Updated `network_seed` in `dna.yaml` to `requests_and_offers_alpha` for consistency (`608a2a8`).
- Refined documentation structure by renaming sections (e.g., "Technical Documentation" to "Technical Specifications"), updating links, and adding a `technical-requirements.md` file (`156e65f`).

### Refactor

- Migrated project tooling from `pnpm` to `bun`, updating README commands and structure diagram (`205bfbf`).

### Documentation

- Significantly revamped documentation structure: added `project-overview.md`, section READMEs (`requirements/`, `architecture/`, `technical-specs/`, `guides/`), updated links, and refined content across multiple files (`0300116`, `156e65f`, `74793a6`, `9d58168`, `95997e1`).
- Enhanced Request and Offer system documentation with clearer definitions, detailed target fields (e.g., `title`, `type_of_service`, `description`, `availability`), and outlined Exchange Completion/Validation concepts (`9a6700e`).
- Added a link to the Changelog in `README.md` and `project-overview.md` (`c33b3c8`).
- Updated documentation for project rules (administration, Effect TS patterns, Svelte 5 standards, system architecture, testing) (`74793a6`, `95997e1`).
- Added documentation explaining Cursor rule management and task list usage (`7d2218f`).
- Created a detailed task list (`TASKS.md`) breaking down work for aligning Request/Offer features with specifications (Issue #38) (`d472cc7`).
- Updated UI structure documentation to reflect Effect TS integration, feature-based organization, and provided code examples (`457f725`).
- Refined contribution guidelines and getting started guide (`95997e1`).

### Added

- Documentation for `.cursor/rules/` and task list management (`7d2218f`).
- Detailed task list for Issue #38 (`d472cc7`).

### Changed

- Revamped documentation structure and enhanced navigation (`0300116`, `74793a6`, `156e65f`).
- Updated administration rules (`9d58168`).
- Updated Request and Offer structures with new fields and validation (`4444bae`).
- Updated UI structure documentation for Effect TS integration and feature-based organization (`457f725`).

### Deprecated

### Removed

### Fixed

### Security

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

[Unreleased]: https://github.com/happenings-community/requests-and-offers/compare/v0.1.0-alpha.1...HEAD
[0.1.0-alpha.1]: https://github.com/happenings-community/requests-and-offers/releases/tag/v0.1.0-alpha.1
