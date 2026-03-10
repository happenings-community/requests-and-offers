---
name: TestingPatterns
description: Testing patterns for Effect-TS services, Svelte 5 stores, and Holochain zomes. USE WHEN writing or debugging unit tests, integration tests, mocking Effect-TS services, testing Svelte 5 stores, or setting up Tryorama multi-agent scenarios.
---

# TestingPatterns

Patterns for testing this project's Effect-TS services, Svelte 5 stores, and Holochain zomes.

## Voice Notification

**Before executing a workflow:** send voice curl + output text:
```bash
curl -s -X POST http://localhost:8888/notify -H "Content-Type: application/json" \
  -d '{"message": "Running WORKFLOWNAME in TestingPatterns"}' > /dev/null 2>&1 &
```
`Running the **WorkflowName** workflow in the **TestingPatterns** skill...`

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **WriteServiceTest** | service test, mock callZome, Effect service | `Workflows/WriteServiceTest.md` |
| **WriteStoreTest** | store test, Svelte store, administrationStore | `Workflows/WriteStoreTest.md` |
| **WriteTryoramaTest** | integration test, Tryorama, multi-agent | `Workflows/WriteTryoramaTest.md` |

## Examples

**Example 1: Service test**
```
User: "Write a unit test for the users service"
→ Invokes WriteServiceTest workflow
→ Loads ServiceTestPatterns.md, creates Promise-based callZome mocks
→ Returns success + error tests ready to run
```

**Example 2: Store test with module mock**
```
User: "Add tests for the serviceTypes store"
→ Invokes WriteStoreTest workflow
→ Detects module-level administrationStore, mocks before import
→ Creates Effect-based service mocks, writes store method tests
```

**Example 3: Tryorama integration test**
```
User: "Write a Tryorama test for create_request"
→ Invokes WriteTryoramaTest workflow
→ Uses runScenarioWithTwoAgents, inserts dhtSync between agents
```
