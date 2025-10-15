## Tech Stack

This project uses a sophisticated Holochain + Effect-TS + SvelteKit architecture. This serves as a reference for all team members and helps maintain consistency across the project.

### Framework & Runtime
- **Application Framework:** Holochain (peer-to-peer distributed applications)
- **Backend Language/Runtime:** Rust (for DNA/zome compilation)
- **Frontend Runtime:** Node.js + Bun (package manager)
- **Development Environment:** Nix (required for zome compilation)
- **Package Manager:** Bun (primary) with npm fallback

### Frontend Architecture
- **JavaScript Framework:** SvelteKit 2 with Svelte 5 Runes
- **State Management:** Effect-TS with 7-layer architecture pattern
- **Type System:** TypeScript (strict mode)
- **CSS Framework:** TailwindCSS with Skeleton UI components
- **UI Components:** Skeleton UI + custom Svelte 5 components
- **Accessibility:** WCAG 2.1 AA compliance (built-in)

### Backend Architecture
- **Distributed Framework:** Holochain with hREA framework integration
- **DNA Structure:** Coordinator + Integrity zomes per domain
- **Effect-TS Integration:** Service layer with Context.Tag dependency injection
- **Data Modeling:** hREA Economic Resource pattern
- **Storage:** Distributed Hash Table (DHT) with local caching

### Testing & Quality
- **Backend Testing:** Tryorama (multi-agent Holochain scenarios)
- **Frontend Testing:** Vitest (unit) + Playwright (E2E)
- **Type Safety:** TypeScript + Effect Schema validation
- **Linting/Formatting:** ESLint + Prettier with automated formatting
- **Code Quality:** 268+ passing unit tests with comprehensive coverage

### Deployment & Infrastructure
- **Web App Deployment:** Holochain hApp packaging with GitHub releases
- **Desktop Applications:** Tauri-based Kangaroo apps (Windows, macOS, Linux)
- **Package Management:** Homebrew formula integration
- **CI/CD:** GitHub Actions with automated testing and validation
- **Git Submodules:** Unified deployment repository management

### Development Features System
- **Environment Modes:** Development (.env.development), Test (.env.test), Production (.env.production)
- **Feature Flags:** `VITE_DEV_FEATURES_ENABLED`, `VITE_MOCK_BUTTONS_ENABLED`
- **Port Management:** Dynamic port allocation with conflict resolution
- **Hot Reloading:** Vite dev server with HMR for frontend

### Core Dependencies
- **Holochain Client:** @holochain/client v0.19.0
- **Effect-TS:** effect v3.14.18 with comprehensive service layer
- **SvelteKit:** @sveltejs/kit v2.27.0 with Svelte 5.19.2
- **Testing:** @playwright/test v1.50.0 + vitest v3.1.2
- **Build Tools:** Vite v5.4.14 with TailwindCSS integration

### Third-Party Integrations
- **ValueFlows:** @valueflows/vf-graphql-holochain for economic modeling
- **Authentication:** Peer-to-peer identity through Holochain
- **Caching:** EntityCache with configurable expiry times
- **Monitoring:** Console logging with RUST_LOG and VITE_LOG_LEVEL support
