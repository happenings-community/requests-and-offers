# Documentation Index - Requests and Offers

**Comprehensive searchable index of all project documentation**

> **📢 Recent Update**: AI development rules consolidated from 25 to 6 focused files for improved usability. New [Quick Reference Guide](QUICK_REFERENCE.md) added for essential commands and patterns.

## 🔍 Quick Search Keywords

**Getting Started**: installation, setup, environment, nix, development, quickstart
**Architecture**: holochain, rust, svelte, effect-ts, 7-layer, zomes, hREA
**Development**: coding guidelines, patterns, testing, debugging, stores, services, store-helpers, apis
**Deployment**: building, packaging, distribution, commands
**Features**: requests, offers, organizations, users, service-types, administration, exchanges, mediums-of-exchange
**Integration**: weave, moss, progenitor, hybrid-profiles, dual-mode

---

## 📋 Main Documentation Structure

### 🏠 Root Documentation

- **[README.md](../README.md)** - Streamlined project introduction and quick start
- **[CLAUDE.md](../CLAUDE.md)** - AI development assistant instructions and patterns
- **[CHANGELOG.md](../CHANGELOG.md)** - Version history and updates
- **[LICENSE.md](../LICENSE.md)** - Project licensing information

### 📁 Core Documentation (`/documentation/`)

#### 🚀 Quick Start & Navigation

- **[Quick Reference Guide](QUICK_REFERENCE.md)** - Essential commands, patterns, and workflows ⭐
- **[Troubleshooting Guide](TROUBLESHOOTING.md)** - Common issues and solutions 🔧
- **[Documentation README](README.md)** - Documentation navigation guide
- **[Project Overview](project-overview.md)** - Comprehensive project introduction and features

#### 🔗 Integration
- **[Moss/Weave Integration](MOSS_INTEGRATION.md)** - Weave/Moss ecosystem integration, hybrid profiles, admin detection

#### 🎯 Project Overview

- **[Requirements](requirements.md)** - Functional and technical requirements summary
- **[Technical Specs](technical-specs.md)** - Technical specification overview
- **[Status](status.md)** - Current development status and progress
- **[Work in Progress](work-in-progress.md)** - Active development items

#### 🏗️ Architecture (`/architecture/`)

- **[Architecture README](architecture/README.md)** - Architecture documentation overview
- **[Architecture Overview](architecture.md)** - System architecture and design patterns
- **[App Runtime (Effect TS)](architecture/app-runtime.md)** - Centralized runtime and DI with AppServicesTag
- **[hREA Integration](architecture/hrea-integration.md)** - Holochain REA framework integration

#### 📋 Requirements (`/requirements/`)

- **[Requirements README](requirements/README.md)** - Requirements documentation overview
- **[Features](requirements/features.md)** - Feature specifications and user stories
- **[MVP](requirements/mvp.md)** - Minimum viable product definition
- **[Roles](requirements/roles.md)** - User roles and permissions
- **[Use Cases](requirements/use-cases.md)** - Detailed use case scenarios
- **[Post-MVP](requirements/post-mvp)** - Future features and enhancements

#### 📚 Guides (`/guides/`)

- **[Guides README](guides/README.md)** - User and developer guides overview
- **[Installation](guides/installation.md)** - Step-by-step installation instructions
- **[Getting Started](guides/getting-started.md)** - Beginner's guide to the project
- **[Contributing](guides/contributing.md)** - Contribution guidelines and workflow

#### 🔧 Technical Specifications (`/technical-specs/`)

- **[Technical Specs README](technical-specs/README.md)** - Technical specifications overview
- **[General](technical-specs/general.md)** - General technical requirements
- **[Component Library](technical-specs/component-library.md)** - UI component specifications
- **[Development Features System](technical-specs/development-features-system.md)** - Development tools and environment management
- **[Medium of Exchanges](technical-specs/medium-of-exchanges.md)** - Technical implementation of currency and payment method system
- **[Event Bus Pattern](technical-specs/event-bus-pattern.md)** - Event system architecture
- **[Services Layer](technical-specs/services-layer.md)** - Service layer specifications
- **[State Management](technical-specs/state-management.md)** - State management patterns
- **[UI Structure](technical-specs/ui-structure.md)** - User interface structure
- **[UI Types](technical-specs/ui-types.md)** - TypeScript type definitions

##### 🔗 API Documentation (`/technical-specs/api/`)

- **[API README](technical-specs/api/README.md)** - Complete API documentation overview

###### Frontend APIs (`/technical-specs/api/frontend/`)

- **[Services](technical-specs/api/frontend/services.md)** - Effect-TS service layer APIs for all domains
- **[Stores](technical-specs/api/frontend/stores.md)** - Svelte store APIs with standardized patterns
- **[Store-Helpers](technical-specs/api/frontend/store-helpers.md)** - Comprehensive utilities for store standardization
- **[Composables](technical-specs/api/frontend/composables.md)** - Business logic composable APIs
- **[Error Handling](technical-specs/api/frontend/errors.md)** - Tagged error system and error contexts
- **[Schema Validation](technical-specs/api/frontend/schemas.md)** - Effect Schema validation APIs
- **[Event System](technical-specs/api/frontend/events.md)** - Cross-domain event bus APIs

###### Backend APIs (`/technical-specs/api/backend/`)

- **[Zome Functions](technical-specs/api/backend/zome-functions.md)** - Complete Holochain zome function reference
- **[Entry Types](technical-specs/api/backend/entry-types.md)** - Data structure definitions and validation
- **[Link Types](technical-specs/api/backend/link-types.md)** - Relationship and indexing patterns
- **[Integration](technical-specs/api/backend/integration.md)** - hREA and external system integration APIs

##### 🧬 Zomes (`/technical-specs/zomes/`)

- **[Zomes README](technical-specs/zomes/README.md)** - Holochain zomes overview
- **[Administration](technical-specs/zomes/administration.md)** - Admin zome specifications
- **[Offers](technical-specs/zomes/offers.md)** - Offers zome functionality
- **[Organizations](technical-specs/zomes/organizations.md)** - Organizations management
- **[Requests](technical-specs/zomes/requests.md)** - Requests zome functionality
- **[Service Types](technical-specs/zomes/service_types.md)** - Service types management
- **[Users](technical-specs/zomes/users.md)** - User management
- **[Users Organizations](technical-specs/zomes/users_organizations.md)** - User-organization relationships
- **[Exchanges](technical-specs/zomes/exchanges.md)** - Exchange proposals, agreements, and lifecycle management
- **[Mediums of Exchange](technical-specs/zomes/mediums_of_exchange.md)** - Currency and payment method management

#### 🤖 AI Development Rules (`/ai/rules/`) - **CONSOLIDATED**

**Core Development Guidelines** (Consolidated from 25 to 6 focused files):

- **[Development Guidelines](ai/rules/development-guidelines.md)** - Effect-TS patterns, Svelte 5 standards, schema validation, and component architecture
- **[Architecture Patterns](ai/rules/architecture-patterns.md)** - 7-layer architecture, service patterns, store management, and event-driven communication
- **[Testing Framework](ai/rules/testing-framework.md)** - Comprehensive testing strategy across backend (Tryorama) and frontend (Vitest/Testing Library)
- **[Domain Implementation](ai/rules/domain-implementation.md)** - Administration patterns, error management, guard composables, and utility patterns
- **[Development Guidelines](ai/rules/development-guidelines.md)** - Continuation strategies, cleanup processes, planning methodologies, and changelog maintenance
- **[Environment Setup](ai/rules/environment-setup.md)** - Nix configuration, development environment, and documentation standards

#### 🎨 Assets (`/assets/images/`)

- **[Project Status](assets/images/project-status.png)** - Visual project status overview
- **[Happening Community Theme 1](assets/images/happening-community-theme-1.png)** - UI design reference
- **[Happening Community Theme 2](assets/images/happening-community-theme-2.png)** - UI design reference
- **[Requests and Offers hREA Mapping](assets/images/requests-and-offers-hrea-mapping.png)** - hREA integration diagram
- **[Types of Projects](assets/images/types-of-projects.png)** - Project categorization
- **[Types of Support Requested](assets/images/types-of-support-requested.png)** - Support categories
- **[User Recovery DHT](assets/images/user-recovery-dht.png)** - User recovery architecture

### 🖥️ Frontend Documentation (`/ui/`)

- **[UI README](../ui/README.md)** - Frontend application overview
- **[Error Handling README](../ui/src/lib/errors/README.md)** - Error management documentation

### 📄 Feature Documentation

- **[Codebase Documentation](CODEBASE_DOCUMENTATION.md)** - Comprehensive codebase overview

---

## 🔍 Search by Topic

### 🚀 Getting Started

**First-time setup and development environment**

- **[Quick Reference Guide](QUICK_REFERENCE.md) - Essential commands, patterns, and workflows** ⭐
- [Installation Guide](guides/installation.md) - Complete setup instructions
- [Getting Started](guides/getting-started.md) - Beginner tutorial
- [Environment Setup](ai/rules/environment-setup.md) - Nix configuration and development environment
- [Project Overview](project-overview.md) - High-level introduction

### 🏗️ Architecture & Design

**System architecture and design patterns**

- [Architecture Overview](architecture.md) - System design
- [System Architecture](ai/rules/system-architecture.md) - Architectural guidelines
- [7-Layer Effect-TS Architecture](../CLAUDE.md#architectural-patterns) - Framework patterns
- [hREA Integration](architecture/hrea-integration.md) - Resource-Event-Agent framework

### 💻 Development

**Coding guidelines and development patterns**

- [Development Guidelines](ai/rules/development-guidelines.md) - Effect-TS patterns, Svelte 5 standards, schema validation
- [Architecture Patterns](ai/rules/architecture-patterns.md) - 7-layer architecture, service patterns, store management
- [Domain Implementation](ai/rules/domain-implementation.md) - Administration patterns, error management, utilities
- [Development Workflow](ai/rules/development-workflow.md) - Continuation strategies, cleanup processes, planning

### 🔗 API Reference

**Complete API documentation for frontend and backend**

- [API Documentation Overview](technical-specs/api/README.md) - Complete API reference guide
- [Frontend Services API](technical-specs/api/frontend/services.md) - Effect-TS service layer APIs
- [Frontend Stores API](technical-specs/api/frontend/stores.md) - Svelte store APIs with standardized patterns
- [Store-Helpers Utilities](technical-specs/api/frontend/store-helpers.md) - Comprehensive store standardization utilities
- [Frontend Composables API](technical-specs/api/frontend/composables.md) - Business logic composable APIs
- [Error Handling API](technical-specs/api/frontend/errors.md) - Tagged error system and contexts
- [Schema Validation API](technical-specs/api/frontend/schemas.md) - Effect Schema validation patterns
- [Event System API](technical-specs/api/frontend/events.md) - Cross-domain event bus communication
- [Backend Zome Functions](technical-specs/api/backend/zome-functions.md) - Holochain zome function reference
- [Backend Entry Types](technical-specs/api/backend/entry-types.md) - Data structure definitions
- [Backend Link Types](technical-specs/api/backend/link-types.md) - Relationship and indexing patterns
- [Backend Integration](technical-specs/api/backend/integration.md) - hREA and external system APIs

### 🧪 Testing

**Testing strategies and implementation**

- [Testing Framework](ai/rules/testing-framework.md) - Comprehensive testing strategy (Backend + Frontend)
- [E2E Playwright Plan](task-lists/E2E/E2E_PLAYWRIGHT_HOLOCHAIN_PLAN.md) - End-to-end testing strategy
- [Real Holochain Data Strategy](task-lists/E2E/REAL_HOLOCHAIN_DATA_STRATEGY.md) - Data management for testing

### 🔧 Technical Implementation

**Technical specifications and zome details**

- [Technical Specs](technical-specs.md) - Overview of all specs
- [Development Features System](technical-specs/development-features-system.md) - Development tools and environment management
- [Medium of Exchanges](technical-specs/medium-of-exchanges.md) - Currency and payment method system implementation
- [Zomes Documentation](technical-specs/zomes/README.md) - Holochain zomes
- [State Management](technical-specs/state-management.md) - Frontend state
- [Event Bus Pattern](technical-specs/event-bus-pattern.md) - Event system
- [Services Layer](technical-specs/services-layer.md) - Service architecture

### 🎯 Features

**Feature specifications and user functionality**

- [Features](requirements/features.md) - All feature specifications
- [Medium of Exchanges](technical-specs/medium-of-exchanges.md) - Currency and payment method system technical implementation
- [Use Cases](requirements/use-cases.md) - User scenarios
- [MVP](requirements/mvp.md) - Core functionality

### 🛠️ Tools & Environment

**Development tools and environment setup**

- [Environment Setup](ai/rules/environment-setup.md) - Nix configuration, development environment, documentation standards
- [Development Features System](technical-specs/development-features-system.md) - Development tools and mock data management
- [Installation](guides/installation.md) - Tool installation
- [Contributing](guides/contributing.md) - Development workflow

### 🔄 Project Management

**Planning and task management**

- [Status](status.md) - Current progress
- [Work in Progress](work-in-progress.md) - Active items
- [Development Workflow](ai/rules/development-workflow.md) - Development continuation, cleanup processes, planning methodologies

### 📝 Documentation

**Documentation standards and maintenance**

- [Environment Setup](ai/rules/environment-setup.md) - Documentation standards and generation processes
- [Development Workflow](ai/rules/development-workflow.md) - Changelog maintenance and release notes
- [CLAUDE.md](../CLAUDE.md) - AI assistant instructions

### 🔒 Error Handling

**Error management and debugging**

- [Domain Implementation](ai/rules/domain-implementation.md) - Comprehensive error management patterns and strategies
- [Error Handling README](../ui/src/lib/errors/README.md) - Frontend error handling implementation
- [Error Handling API](technical-specs/api/frontend/errors.md) - Tagged error system documentation

---

## 📖 Quick Reference by File Type

### Configuration Files

- `CLAUDE.md` - AI development assistant configuration
- `package.json` - Project dependencies and scripts
- `nix/` - Development environment configuration

### Source Code Documentation

- `ui/src/lib/` - Frontend library documentation
- `dnas/` - Holochain DNA and zome code
- `tests/` - Test suites and specifications

### Visual Assets

- `documentation/assets/images/` - Diagrams and visual references
- UI mockups and design references

### Planning Documents

- Task lists and roadmaps
- Feature specifications and requirements
- Architecture decisions and technical plans

---

## 🏷️ Tags and Keywords

**Quick search tags for documentation topics:**

- `#architecture` - System design and structure
- `#development-tools` - Development features, mock data, and environment management
- `#effect-ts` - Effect-TS patterns and guidelines
- `#svelte` - Frontend development and Svelte 5
- `#holochain` - Holochain specific documentation
- `#testing` - Testing strategies and implementation
- `#zomes` - Holochain zome development
- `#state-management` - Frontend state patterns
- `#error-handling` - Error management strategies
- `#setup` - Installation and environment setup
- `#features` - Feature specifications
- `#hrea` - Resource-Event-Agent integration
- `#ui` - User interface development
- `#services` - Service layer implementation
- `#store-helpers` - Store utilities and standardization
- `#api` - API documentation and reference
- `#patterns` - Design patterns and best practices
- `#guidelines` - Development standards and rules

---

_This index is automatically maintained. For updates or corrections, see [Documentation Guidelines](ai/rules/documentation.md)._
