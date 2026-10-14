---
name: hREA Integration
description: This skill should be used when working with hREA GraphQL integration, ValueFlows ontology mapping, proposal/intent creation, prerequisite management, or the pending queue system
---

# hREA Integration

Patterns for the hREA (Holochain Resource-Event-Agent) GraphQL integration layer that maps local entities to ValueFlows economic ontology.

## Key Reference Files

- **hREA service**: `ui/src/lib/services/hrea.service.ts`
- **hREA store**: `ui/src/lib/stores/hrea.store.svelte.ts`
- **Request→Proposal mapper**: `ui/src/lib/services/mappers/request-proposal.mapper.ts`
- **Offer→Proposal mapper**: `ui/src/lib/services/mappers/offer-proposal.mapper.ts`
- **GraphQL queries**: `ui/src/lib/graphql/queries/`
- **GraphQL mutations**: `ui/src/lib/graphql/mutations/`
- **GraphQL fragments**: `ui/src/lib/graphql/fragments/`
- **hREA types**: `ui/src/lib/types/hrea.ts`
- **hREA store test**: `ui/tests/unit/stores/hrea.store.test.ts`

## Architecture Overview

```
Local Entities          hREA Store (mapping layer)        hREA DNA (GraphQL)
─────────────          ──────────────────────────        ──────────────────
UIUser          →  createPersonFromUser()          →  Agent
UIOrganization  →  createOrganizationFromOrg()     →  Agent
UIServiceType   →  createResourceSpecFromST()      →  ResourceSpecification
UIMediumOfExch  →  createResourceSpecFromMoE()     →  ResourceSpecification
UIRequest       →  createProposalFromRequest()     →  Proposal + 2 Intents
UIOffer         →  createProposalFromOffer()       →  Proposal + 2 Intents
```

The GraphQL layer uses `@valueflows/vf-graphql-holochain` + Apollo Client with `SchemaLink`.

## Three Prerequisites for Proposals

Proposals require **all three** prerequisites to exist before creation:

1. **User agent** — created when user is approved (`handleUserAccepted` event)
2. **Service type resource specs** — created when service type is approved
3. **Medium of exchange resource specs** — created when MoE is approved

If any prerequisite is missing, the request/offer is **queued** in `pendingRequestQueue` / `pendingOfferQueue`.

## Pending Queue Mechanism

```typescript
// When createProposalFromRequest fails due to missing prerequisites:
// → request is added to pendingRequestQueue
// → E.catchAll returns null (no error propagation)

// When ANY prerequisite is created (agent, resource spec):
// → retryPendingProposals() is called
// → all queued items are retried

// Event flow:
// user approved → createPerson() → retryPendingProposals()
// service type approved → createResourceSpec() → retryPendingProposals()
// MoE approved → createResourceSpec() → retryPendingProposals()
```

## Request→Proposal Mapping (Two-Intent Reciprocal Pattern)

Each request/offer creates a Proposal with TWO intents:

```
Request "I need web development"
  → Proposal: name="Request: I need web development"
  → Intent 1 (primary): action="transfer", provider=requester's agent
      resourceConformsTo = service type resource spec
  → Intent 2 (reciprocal): action="transfer", receiver=requester's agent
      resourceConformsTo = medium of exchange resource spec
```

The intent linking uses `proposeIntent` mutation with `reciprocal: false` for primary intent and `reciprocal: true` for payment intent.

## Action Hash Reference Format

Mappings between local entities and hREA entities use `note` fields:

```
ref:user:<actionHash>              — on Agent.note
ref:organization:<actionHash>      — on Agent.note
ref:serviceType:<actionHash>       — on ResourceSpecification.note
ref:mediumOfExchange:<actionHash>  — on ResourceSpecification.note
```

Lookup: `extractActionHashFromNote(note, entityType)` extracts the hash.

## Error Handling

- **Missing zome functions**: hREA DNA may not have `get_all_intents` / `get_all_proposals` — service uses `E.catchAll` to return empty arrays
- **Prerequisite detection**: `createProposalFromRequest` / `createProposalFromOffer` use `E.catchAll` (not `E.tapError`) — queue on failure, return `null`
- **Initialization**: `createPerson()` calls `initialize()` internally — don't call separately
- **GraphQL normalization**: Responses need `normalizeIntentResponse()` / `normalizeProposalResponse()` because GraphQL returns nested objects

## Store State

```typescript
// Mapping stores (local hash → hREA ID)
userAgentMappings: Map<string, string>                    // userHash → agentId
organizationAgentMappings: Map<string, string>            // orgHash → agentId
serviceTypeResourceSpecMappings: Map<string, string>      // stHash → resourceSpecId
mediumOfExchangeResourceSpecMappings: Map<string, string> // moeHash → resourceSpecId
requestProposalMappings: Map<string, string>              // requestHash → proposalId
offerProposalMappings: Map<string, string>                // offerHash → proposalId

// Entity arrays
agents: Agent[]
resourceSpecifications: ResourceSpecification[]
proposals: Proposal[]
intents: Intent[]

// Queue (pending items waiting for prerequisites)
pendingRequestQueue: Map<string, UIRequest>
pendingOfferQueue: Map<string, UIOffer>
```

## Event-Driven Architecture

The hREA store subscribes to `storeEventBus` events:

| Event | Handler | hREA Action |
|-------|---------|-------------|
| `user:accepted` | `handleUserAccepted` | `createPerson()` → `retryPendingProposals()` |
| `organization:accepted` | `handleOrganizationAccepted` | `createOrganization()` → `retryPendingProposals()` |
| `serviceType:approved` | `handleServiceTypeApproved` | `createResourceSpec()` → `retryPendingProposals()` |
| `mediumOfExchange:approved` | `handleMediumOfExchangeApproved` | `createResourceSpec()` → `retryPendingProposals()` |
| `request:created` | `handleRequestCreated` | `createProposalFromRequest()` |
| `offer:created` | `handleOfferCreated` | `createProposalFromOffer()` |

## Testing hREA

Tests need module mocks for external dependencies:

```typescript
vi.mock('@valueflows/vf-graphql-holochain', () => ({
  createHolochainSchema: vi.fn()
}));
vi.mock('@apollo/client/link/schema', () => ({
  SchemaLink: vi.fn()
}));
```

Note: `hrea.service.ts` `createPerson()` calls `initialize()` internally — don't call it separately in tests.
