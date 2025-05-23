---
trigger: model_decision
description: When working with the DNA/Zome with the Nix environment.
globs: 
---
# Nix Environment Guidelines

## Core Principles

- Nix environment is specifically for DNA/Zome development and testing
- Not required for UI development work
- Ensures consistent development environment across team members

## Usage Guidelines

- ✅ **DO:** Use Nix for:
  - DNA/Zome development
  - Running tests
  - Building WASM
  - Holochain conductor operations
  
- ❌ **DON'T:** Use Nix for:
  - UI development
  - Frontend testing
  - Package management for UI dependencies
  - Frontend builds

## Command Execution

- ✅ **DO:** Run commands in Nix environment using:

  ```bash
  nix develop --command [your-command]
  ```
  
- ❌ **DON'T:** Run DNA-related commands outside Nix environment:

  ```bash
  # Bad example - will likely fail
  cargo build --target wasm32-unknown-unknown
  ```

## Testing

- All DNA/Zome tests must be run within the Nix environment
- Use the following format for running tests:

  ```bash
  nix develop --command [test command]
  ```

## Common Operations

- Building zomes:

  ```bash
  nix develop --command bun run build:zomes
  ```

- Running tests:

  ```bash
  nix develop --command bun test
  ```

- Packaging happ:

  ```bash
  nix develop --command hc app pack
  ```

## Important Notes

- The Nix environment provides all necessary dependencies for Holochain development
- Switching between Nix and non-Nix environments may require terminal restart
- Keep UI development separate from DNA development workflows
