# WINDSURF.md

This file provides guidance to Windsurf/Cascade when working in this repository. It is the single entry point that should always remain in context.

## 🚨 Documentation-First Approach (Mandatory)

Before doing ANY task, first consult the documentation to understand context, constraints, and patterns.

1. Start with the Documentation Index: `documentation/DOCUMENTATION_INDEX.md`
2. Check the Quick Reference: `documentation/QUICK_REFERENCE.md`
3. Review development rules and architecture:
   - `documentation/ai/rules/development-guidelines.md`
   - `documentation/ai/rules/architecture-patterns.md`
   - `documentation/ai/rules/testing-framework.md` (index with splits)
   - `documentation/ai/rules/domain-implementation.md` (index with splits)
4. Validate against Project Status: `documentation/status.md`

Workflow: Read docs → Understand constraints → Propose plan → Implement minimal, correct change → Validate against patterns

## Operational Rules for Windsurf/Cascade

- Tooling
  - Prefer reading files, directory listings, and searching before proposing changes.
  - Use code edit tools to modify files; do not paste large code into chat unless explicitly requested.
  - When running commands:
    - Never change directory inline; set the working directory via the tool.
    - Only auto-run safe, read-only commands. Ask for approval before any command with side effects.
  - File creation:
    - Only create new files if necessary for the task or explicitly requested.
    - Prefer editing existing files over creating new ones.

- Code Changes (Quality Bar)
  - Keep code immediately runnable. Add required imports at the top of files.
  - For edits, maintain existing style and architecture patterns (7-layer Effect-TS, Svelte 5 Runes).
  - For large changes, split into smaller, logically-scoped edits.
  - Tests: update or add tests when changing behavior.

- Documentation Changes
  - Only create new documentation when explicitly requested by the user.
  - Keep rule files under 12,000 characters each. Split into coherent modules when needed.

- Safety & UX
  - Never start the application yourself during user sessions (it can disrupt their environment).
  - Prefer minimal, incremental changes that are easy to review.

## Quick Links (Essential Reading)

- Development Guidelines: `documentation/ai/rules/development-guidelines.md`
- Architecture Patterns (7-layer): `documentation/ai/rules/architecture-patterns.md`
- Testing Framework (index): `documentation/ai/rules/testing-framework.md`
  - Backend Tryorama: `documentation/ai/rules/testing-backend-tryorama.md`
  - Frontend Unit: `documentation/ai/rules/testing-frontend-unit.md`
  - Components & Integration: `documentation/ai/rules/testing-component-integration.md`
  - Organization & Best Practices: `documentation/ai/rules/testing-organization-best-practices.md`
- Domain Implementation (index): `documentation/ai/rules/domain-implementation.md`
  - Admin & Access: `documentation/ai/rules/domain-implementation-admin-access.md`
  - Error Management: `documentation/ai/rules/domain-implementation-error-management.md`
  - Guard Composables: `documentation/ai/rules/domain-implementation-guards.md`
  - Utilities & Avatars: `documentation/ai/rules/domain-implementation-utilities.md`
- Error Patterns: `documentation/ai/rules/error-management-patterns.md`
- Environment Setup: `documentation/ai/rules/environment-setup.md`

## Architecture Overview (Snapshot)

- Backend: Holochain (Rust zomes: coordinator/integrity)
- Frontend: SvelteKit + Svelte 5 Runes + TailwindCSS + SkeletonUI
- Runtime: Bun (TypeScript/JavaScript)
- State/Async: Effect-TS
- Dev Environment: Nix (for DNA/zome development)

Follow the standardized 7-layer architecture:
1. Service Layer (Effect + Context.Tag)
2. Store Layer (Svelte 5 runes + standardized helpers)
3. Schema Validation (Effect Schema)
4. Error Handling (tagged errors + central contexts)
5. Composables (Effect-based logic)
6. Components (a11y-first, logic in composables)
7. Testing (Effect-TS across layers)

## Implementation Checklist

- [ ] Reviewed relevant documentation (index + quick reference)
- [ ] Changes align with 7-layer architecture
- [ ] Imports added at top; code runs without missing deps
- [ ] Tests exist and pass (or updated accordingly)
- [ ] Documentation references updated if necessary (avoid new docs unless asked)

## Test Approach (Required)

- Use package.json scripts to run tests; they ensure the right environment and prevent timeouts.
- Prefer unit and integration tests per the pyramid. Keep E2E minimal and critical-path only.
- Backend tests: `tests/` (Tryorama). Frontend unit/integration: `ui/tests/`.

See: `documentation/ai/rules/testing-framework.md` and split files for full details.

## Command Reference (Pointer)

To avoid duplication, see `CLAUDE.md` for detailed commands (environment, run, build, test). Use the same scripts from Windsurf. Do not run the app yourself during the session.

## Important Reminders

- Do exactly what is asked—nothing more, nothing less.
- Propose a short plan when tasks are non-trivial; then execute.
- Keep modifications small, focused, and reversible.
- Respect file size limits for rules (<12k chars), split when needed.
