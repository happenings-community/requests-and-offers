# Testing Framework

Concise index of the project's testing strategy and split rule set.

## Testing Architecture Overview

Three-layer strategy:

1. Backend Integration Tests (`tests/`) – Holochain zome testing with Tryorama
2. Frontend Unit Tests (`ui/tests/unit/`) – Isolated component and service testing
3. Frontend Integration Tests (`ui/tests/integration/`) – Cross-component UI flow testing

## Core Testing Philosophy

- Focus on Public APIs – Behavior over implementation details
- Isolation – Tests independent with no external dependencies
- Predictability – Consistent results on every run
- Fast Feedback – Quick execution for rapid cycles

## Testing Pyramid

```
    E2E Tests (Few)
   ▲ Slow, Expensive, Brittle
  ▲ ▲ Integration Tests (Some)
 ▲ ▲ ▲ Fast, Reliable, Focused
Unit Tests (Many)
```

## Split Rule Set (see details)

- Backend with Tryorama: `testing-backend-tryorama.md`
- Frontend Unit (Effect-TS + Stores): `testing-frontend-unit.md`
- Components & Integration: `testing-component-integration.md`
- Organization & Best Practices: `testing-organization-best-practices.md`

These focused documents supersede the long-form guide and keep this index concise (<12k chars).
