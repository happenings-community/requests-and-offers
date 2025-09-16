# Testing Framework: Overview & Philosophy

Comprehensive strategy with a 3-layer test architecture across the app stack.

## Architecture

1. Backend Integration Tests (`tests/`) – Holochain zome testing with Tryorama
2. Frontend Unit Tests (`ui/tests/unit/`) – Isolated component and service testing
3. Frontend Integration Tests (`ui/tests/integration/`) – Cross-component flow testing

## Core Philosophy

- Focus on Public APIs – Test behavior from consumer perspective
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

See split rule files for details:

- testing-backend-tryorama.md
- testing-frontend-unit.md
- testing-component-integration.md
- testing-organization-best-practices.md
