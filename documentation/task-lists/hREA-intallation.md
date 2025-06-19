# hREA Integration Guide

## Overview

This document outlines the integration of hREA (Holochain Resource-Event-Agent) into the Requests and Offers application, implementing a feedback-driven economic flow that maps our entities to proper hREA structures.

## hREA Economic Flow Mapping

Based on the hREA mapping diagram, our application implements the following flow:

```
Alice (Agent) --make--> Proposal (Request/Offer) --represent--> Resource Specifications
                                    ↓ bundle
Bob (Agent) --make--> Agreement --bundle--> Commitments --fulfills--> Economic Event
                         ↑                                                ↓
                    Feedback ←--ask for--← Bob                    Commitment Completion
                         ↓
              if feedback is positive → fulfills commitments
```

### Entity Mapping

- **Agents**: Users and Organizations in our system
- **Proposals**: Our Requests and Offers (bundled as proposals)
- **Resource Specifications**: Service Types with tags
- **Intents**: Service needs (Requests) and Service provisions (Offers)
- **Agreements**: Mutual acceptance between agents
- **Commitments**: Formalized obligations to fulfill services
- **Economic Events**: Actual service delivery records (conditional on positive feedback)
- **Feedback**: Quality assurance mechanism that enables fulfillment

## Dependencies and Installation

### Core Dependencies

Replace legacy dependencies with current hREA packages:

```json
{
  "@valueflows/vf-graphql-holochain": "latest",
  "@apollo/client": "^3.8.0",
  "svelte-apollo": "^0.5.0"
}
```

### hREA DNA Integration

- **hREA DNA**: https://github.com/h-REA/hREA/releases/tag/happ-0.3.1-beta
- **External Zome Integration**: https://holochain-open-dev.github.io/profiles/?path=/docs/introduction--docs
- **Documentation**: https://github.com/h-REA/graphql-developer-docs

## Implementation Setup

### Apollo Client Configuration

```typescript
import { createHolochainSchema } from '@valueflows/vf-graphql-holochain';
import { SchemaLink } from '@apollo/client/link/schema';
import { ApolloClient, InMemoryCache } from "@apollo/client/core";
import { setClient } from 'svelte-apollo';

// Create Apollo Client with hREA schema
const cache = new InMemoryCache();
const apolloClient = new ApolloClient({
    cache
});

// Configure hREA schema
const schema = createHolochainSchema({
    appWebSocket: appWebSocket,
    roleName: 'hrea'
});

apolloClient.setLink(new SchemaLink({ schema }));

// Set client for Svelte Apollo
setClient(apolloClient);
```

## Economic Flow Implementation

### 1. Proposal Creation (Requests/Offers)

Requests and Offers are created as hREA Proposals that bundle Intents:

```typescript
// Request Intent (service needed)
const createRequestIntent = {
    action: 'work',
    resourceClassifiedAs: serviceTypeIds, // Links to approved Service Types
    provider: null, // To be determined
    receiver: currentAgent
};

// Offer Intent (service provided)  
const createOfferIntent = {
    action: 'work',
    resourceClassifiedAs: serviceTypeIds,
    provider: currentAgent,
    receiver: null // To be determined
};
```

### 2. Agreement Formation

When Requests and Offers match, create hREA Agreements:

```typescript
const createAgreement = {
    name: `Service Agreement: ${requestTitle}`,
    created: new Date(),
    involvedAgents: [requestAgent, offerAgent]
};
```

### 3. Commitment Creation

Agreements bundle Commitments for both parties:

```typescript
// Commitment from service provider
const providerCommitment = {
    action: 'work',
    provider: offerAgent,
    receiver: requestAgent,
    resourceClassifiedAs: serviceTypeIds,
    plannedWithin: agreementId
};

// Commitment for feedback (from receiver)
const feedbackCommitment = {
    action: 'work', // Feedback as work
    provider: requestAgent,
    receiver: offerAgent,
    resourceClassifiedAs: ['feedback'],
    plannedWithin: agreementId
};
```

### 4. Feedback-Driven Fulfillment

Economic Events are created conditionally based on positive feedback:

```typescript
// After work completion, request feedback
const requestFeedback = async (commitmentId: string, fromAgent: string) => {
    // Notify agent that feedback is requested
    // Wait for feedback response
};

// Create Economic Event only if feedback is positive
const createEconomicEvent = async (feedback: FeedbackEntry) => {
    if (feedback.rating === 'positive') {
        return {
            action: 'work',
            provider: providerAgent,
            receiver: receiverAgent,
            fulfills: [commitmentId],
            hasPointInTime: new Date()
        };
    }
    // Handle negative feedback through resolution process
};
```

## Service Types as Resource Specifications

Our Service Types map to hREA Resource Specifications:

```typescript
const serviceTypeAsResourceSpec = {
    name: serviceType.name,
    note: serviceType.description,
    classifiedAs: serviceType.tags, // Tags become classifications
    defaultUnitOfResource: 'hour' // Default time-based measurement
};
```

## GraphQL Query Examples

Reference implementations: https://github.com/Carbon-Farm-Network/app-carbon-farm-network/tree/main/ui/src/lib/graphql

### Create Proposal with Intent

```graphql
mutation CreateProposal($proposal: ProposalCreateParams!) {
    createProposal(proposal: $proposal) {
        proposal {
            id
            name
            created
            publishes {
                id
                action { id }
                resourceClassifiedAs
            }
        }
    }
}
```

### Query Agreements

```graphql
query GetAgreements($filter: AgreementFilterParams) {
    agreements(filter: $filter) {
        edges {
            node {
                id
                name
                created
                involvedAgents {
                    id
                    name
                }
                commitments {
                    id
                    action { id }
                    provider { id name }
                    receiver { id name }
                }
            }
        }
    }
}
```

### Create Economic Event

```graphql
mutation CreateEconomicEvent($event: EconomicEventCreateParams!) {
    createEconomicEvent(event: $event) {
        economicEvent {
            id
            action { id }
            provider { id name }
            receiver { id name }
            fulfills {
                id
                action { id }
            }
        }
    }
}
```

## Development and Testing

### hREA Explorer
Run development server: https://github.com/h-REA
```bash
bun dev
```

### Integration Testing
Test the complete flow:
1. Create Proposals (Requests/Offers)
2. Form Agreements
3. Generate Commitments  
4. Complete work and request feedback
5. Create Economic Events based on positive feedback
6. Track Resource impacts

## Feedback System Integration

The feedback system operates as a quality gate:

- **Feedback Providers**: Agents who receive services
- **Feedback Requesters**: Agents who provide services
- **Conditional Fulfillment**: Economic Events created only after positive feedback
- **Resolution Process**: Handle negative feedback through mediation

This ensures quality assurance while maintaining the integrity of the hREA economic model.