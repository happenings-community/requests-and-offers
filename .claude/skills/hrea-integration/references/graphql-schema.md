# GraphQL Schema Reference

## File Organization

```
ui/src/lib/graphql/
├── fragments/
│   ├── intent.fragments.ts
│   ├── proposal.fragments.ts
│   └── resourceSpecification.fragments.ts
├── queries/
│   ├── agent.queries.ts
│   ├── intent.queries.ts
│   ├── proposal.queries.ts
│   └── resourceSpecification.queries.ts
└── mutations/
    ├── agent.mutations.ts
    ├── intent.mutations.ts
    ├── proposal.mutations.ts
    └── resourceSpecification.mutations.ts
```

## Agent Operations

### Mutations

```graphql
# CREATE_PERSON_MUTATION
mutation CreatePerson($agent: AgentCreateParams!) {
  createPerson(agent: $agent) {
    agent { id name note image revisionId }
  }
}

# UPDATE_PERSON_MUTATION
mutation UpdatePerson($agent: AgentUpdateParams!) {
  updatePerson(agent: $agent) {
    agent { id name note image revisionId }
  }
}

# CREATE_ORGANIZATION_MUTATION
mutation CreateOrganization($agent: AgentCreateParams!) {
  createOrganization(agent: $agent) {
    agent { id name note image revisionId }
  }
}

# UPDATE_ORGANIZATION_MUTATION
mutation UpdateOrganization($agent: AgentUpdateParams!) {
  updateOrganization(agent: $agent) {
    agent { id name note image revisionId }
  }
}
```

### Queries

```graphql
# GET_AGENT_QUERY
query GetAgent($id: ID!) {
  agent(id: $id) { id name note image revisionId }
}

# GET_AGENTS_QUERY
query GetAgents {
  agents { edges { node { id name note image revisionId } } }
}
```

## ResourceSpecification Operations

### Mutations

```graphql
# CREATE_RESOURCE_SPECIFICATION_MUTATION
mutation CreateResourceSpecification($resourceSpecification: ResourceSpecificationCreateParams!) {
  createResourceSpecification(resourceSpecification: $resourceSpecification) {
    resourceSpecification { id name note revisionId }
  }
}

# UPDATE_RESOURCE_SPECIFICATION_MUTATION
mutation UpdateResourceSpecification($resourceSpecification: ResourceSpecificationUpdateParams!) {
  updateResourceSpecification(resourceSpecification: $resourceSpecification) {
    resourceSpecification { id name note revisionId }
  }
}

# DELETE_RESOURCE_SPECIFICATION_MUTATION
mutation DeleteResourceSpecification($revisionId: ID!) {
  deleteResourceSpecification(revisionId: $revisionId)
}
```

### Queries

```graphql
# GET_RESOURCE_SPECIFICATION_QUERY
query GetResourceSpecification($id: ID!) {
  resourceSpecification(id: $id) { id name note revisionId }
}

# GET_RESOURCE_SPECIFICATIONS_QUERY
query GetResourceSpecifications {
  resourceSpecifications { edges { node { id name note revisionId } } }
}

# GET_RESOURCE_SPECIFICATIONS_BY_CLASS_QUERY
query GetResourceSpecificationsByClass($classifiedAs: [URI!]) {
  resourceSpecifications(classifiedAs: $classifiedAs) {
    edges { node { id name note revisionId } }
  }
}
```

## Proposal Operations

### Mutations

```graphql
# CREATE_PROPOSAL_MUTATION
mutation CreateProposal($proposal: ProposalCreateParams!) {
  createProposal(proposal: $proposal) {
    proposal { id name note created revisionId hasBeginning hasEnd unitBased }
  }
}

# UPDATE_PROPOSAL_MUTATION
mutation UpdateProposal($proposal: ProposalUpdateParams!) {
  updateProposal(proposal: $proposal) {
    proposal { id name note created revisionId hasBeginning hasEnd unitBased }
  }
}

# DELETE_PROPOSAL_MUTATION
mutation DeleteProposal($revisionId: ID!) {
  deleteProposal(revisionId: $revisionId)
}
```

## Intent Operations

### Mutations

```graphql
# CREATE_INTENT_MUTATION
mutation CreateIntent($intent: IntentCreateParams!) {
  createIntent(intent: $intent) {
    intent {
      id
      action { id }
      provider { id name }
      receiver { id name }
      resourceConformsTo { id name }
      resourceQuantity { hasNumericalValue hasUnit { id label symbol } }
      revisionId
      note
    }
  }
}

# PROPOSE_INTENT_MUTATION (links intent to proposal)
mutation ProposeIntent($publishedIn: ID!, $publishes: ID!, $reciprocal: Boolean) {
  proposeIntent(publishedIn: $publishedIn, publishes: $publishes, reciprocal: $reciprocal) {
    proposedIntent {
      id
      reciprocal
      publishedIn { id name }
      publishes { id action { id } }
    }
  }
}

# UPDATE_INTENT_MUTATION
mutation UpdateIntent($intent: IntentUpdateParams!) {
  updateIntent(intent: $intent) {
    intent { id action { id } provider { id } receiver { id }
      resourceConformsTo { id } resourceQuantity { hasNumericalValue hasUnit { id } }
      revisionId note }
  }
}

# DELETE_INTENT_MUTATION
mutation DeleteIntent($revisionId: ID!) {
  deleteIntent(revisionId: $revisionId)
}
```

## Response Normalization

GraphQL returns nested objects that need flattening:

```typescript
// Raw GraphQL response
{ action: { id: "transfer" }, provider: { id: "agent123", name: "Alice" } }

// After normalizeIntentResponse():
{ action: "transfer", provider: "agent123" }

// normalizeProposalResponse() flattens similarly for proposals
```

## Two-Intent Proposal Pattern

Creating a proposal from a request/offer:

```typescript
// 1. Create proposal
const proposal = await apolloClient.mutate({
  mutation: CREATE_PROPOSAL_MUTATION,
  variables: { proposal: { name: `Request: ${request.title}`, note: request.description } }
});

// 2. Create primary intent (service)
const primaryIntent = await apolloClient.mutate({
  mutation: CREATE_INTENT_MUTATION,
  variables: { intent: {
    action: "transfer",
    provider: agentId,
    resourceConformsTo: serviceTypeResourceSpecId,
    note: `Primary intent for request: ${request.title}`
  }}
});

// 3. Create reciprocal intent (payment)
const reciprocalIntent = await apolloClient.mutate({
  mutation: CREATE_INTENT_MUTATION,
  variables: { intent: {
    action: "transfer",
    receiver: agentId,
    resourceConformsTo: mediumOfExchangeResourceSpecId,
    note: `Reciprocal intent for request: ${request.title}`
  }}
});

// 4. Link intents to proposal
await apolloClient.mutate({
  mutation: PROPOSE_INTENT_MUTATION,
  variables: { publishedIn: proposalId, publishes: primaryIntentId, reciprocal: false }
});
await apolloClient.mutate({
  mutation: PROPOSE_INTENT_MUTATION,
  variables: { publishedIn: proposalId, publishes: reciprocalIntentId, reciprocal: true }
});
```

## Key Notes

- All queries use Apollo Client with `SchemaLink` (in-process GraphQL, no HTTP)
- Schema comes from `@valueflows/vf-graphql-holochain`'s `createHolochainSchema()`
- Response types need normalization (nested objects → flat IDs)
- hREA DNA may lack `get_all_intents`/`get_all_proposals` — handle with `E.catchAll`
