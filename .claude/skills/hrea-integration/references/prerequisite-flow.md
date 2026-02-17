# Prerequisite Flow

## Overview

hREA proposals require three prerequisites. Each is created reactively when its source entity is approved.

## Prerequisite 1: User Agent

```
User created → (pending approval)
User approved → storeEventBus emits 'user:accepted'
  → handleUserAccepted(user)
    → createPersonFromUser(user)
      → hreaService.createPerson({ name, note: "ref:user:<hash>" })
      → agent created in hREA
      → userAgentMappings.set(userHash, agentId)
      → retryPendingProposals()
```

## Prerequisite 2: Service Type Resource Specification

```
Service type created → (pending approval)
Service type approved → storeEventBus emits 'serviceType:approved'
  → handleServiceTypeApproved(serviceType)
    → createResourceSpecificationFromServiceType(serviceType)
      → hreaService.createResourceSpecification({
          name: serviceType.name,
          note: "ref:serviceType:<hash>"
        })
      → resource spec created in hREA
      → serviceTypeResourceSpecMappings.set(stHash, resourceSpecId)
      → retryPendingProposals()
```

## Prerequisite 3: Medium of Exchange Resource Specification

```
Medium of exchange created → (pending approval)
MoE approved → storeEventBus emits 'mediumOfExchange:approved'
  → handleMediumOfExchangeApproved(mediumOfExchange)
    → createResourceSpecificationFromMediumOfExchange(mediumOfExchange)
      → hreaService.createResourceSpecification({
          name: mediumOfExchange.name,
          note: "ref:mediumOfExchange:<hash>"
        })
      → resource spec created in hREA
      → mediumOfExchangeResourceSpecMappings.set(moeHash, resourceSpecId)
      → retryPendingProposals()
```

## Proposal Creation Flow

When a request or offer is created:

```
Request created → storeEventBus emits 'request:created'
  → handleRequestCreated(request)
    → createProposalFromRequest(request)
      → Check prerequisites:
        1. Find agent for request creator (userAgentMappings)
        2. Find resource specs for service types (serviceTypeResourceSpecMappings)
        3. Find resource specs for mediums of exchange (mediumOfExchangeResourceSpecMappings)
      → If ALL found:
        → Create Proposal via GraphQL
        → Create primary Intent (service transfer)
        → Create reciprocal Intent (payment transfer)
        → Link intents to proposal via proposeIntent mutation
        → requestProposalMappings.set(requestHash, proposalId)
      → If ANY missing:
        → E.catchAll catches the error
        → Request added to pendingRequestQueue
        → Returns null (no error propagation)
```

## Retry Mechanism

```typescript
retryPendingProposals():
  1. Get all items from pendingRequestQueue and pendingOfferQueue
  2. For each pending request:
     → Call createProposalFromRequest(request)
     → If success: request removed from queue (inside createProposalFromRequest)
     → If fail: stays in queue for next retry
  3. For each pending offer:
     → Call createProposalFromOffer(offer)
     → If success: offer removed from queue
     → If fail: stays in queue for next retry
```

## Complete Timeline Example

```
1. Alice's profile is created (pending)
2. "Web Development" service type is created (pending)
3. "Hours" medium of exchange is created (pending)
4. Admin approves Alice → createPerson() → agent created
5. Alice creates request "I need web dev" → QUEUED (no service type spec yet)
6. Admin approves "Web Development" → createResourceSpec() → retryPendingProposals()
   → Retry request → QUEUED (no MoE spec yet)
7. Admin approves "Hours" → createResourceSpec() → retryPendingProposals()
   → Retry request → SUCCESS: Proposal + 2 Intents created
```

## Key Implementation Details

- `createProposalFromRequest` uses `E.catchAll` to silently queue on failure
- Queue maps use `string` keys (action hash as string)
- `retryPendingProposals` is fire-and-forget (uses `.catch()` for error logging)
- Each event handler calls `retryPendingProposals()` via `.then()` after its main operation
