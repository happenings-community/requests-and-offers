# Review & Reputation System

## Overview

The Review & Reputation System provides trust signals for users based on exchange outcomes. It is the **only custom Rust zome** required for the exchange process, since hREA/ValueFlows covers the economic coordination flow but has no concept of subjective quality ratings.

This system is tightly coupled with the [Exchange Process](./exchange-process.md): reviews are triggered after both parties fulfill their Commitments in an hREA Agreement, and positive feedback acts as a conditional gate for final economic fulfillment confirmation.

### Scope

- **Exchange Reviews**: Post-completion feedback between exchange parties (core)
- **Reputation Scoring**: Aggregated trust metrics derived from review data
- **Moderation**: Quality control, spam prevention, dispute handling
- **Privacy & Fairness**: Bias prevention and data protection

## Review System

### Data Model

#### Backend (Custom Zome)

```rust
// Integrity zome: reviews_integrity

#[hdk_entry_helper]
struct ExchangeReview {
    agreement_id: ActionHash,       // References the hREA Agreement
    reviewer: AgentPubKey,
    reviewed: AgentPubKey,
    rating: u8,                     // 1-5 stars
    on_time: bool,
    as_agreed: bool,
    comments: Option<String>,       // Max 200 chars
}

// Link types:
// - AgreementToReview: find reviews for a given exchange
// - AgentToReview: find all reviews for a given user (reputation queries)
```

#### Frontend Types

```typescript
interface ExchangeReview {
  id: ActionHash;
  agreementId: string;              // hREA Agreement ID
  reviewer: AgentPubKey;
  reviewed: AgentPubKey;
  rating: number;                   // 1-5 stars
  feedback: {
    onTime: boolean;
    asAgreed: boolean;
    comments?: string;              // Max 200 chars
  };
  createdAt: Timestamp;
}
```

### Rating Structure

- **Star Rating**: 1-5 scale for overall service quality
- **On Time**: Boolean -- was the exchange completed within the agreed timeframe?
- **As Agreed**: Boolean -- did the outcome match what was committed?
- **Comments**: Optional free-text feedback (max 200 characters)

### Review Criteria

| Criterion | Measured By | Weight |
|---|---|---|
| Quality of service | Star rating (1-5) | High |
| Timeliness | `onTime` boolean | Medium |
| Reliability | `asAgreed` boolean | Medium |
| Overall feedback | Comments | Qualitative |

### Review Workflow

1. Both parties fulfill their Commitments (EconomicEvents recorded in hREA)
2. Exchange enters "Review Phase" -- both parties are prompted to submit reviews
3. Reviews are submitted independently (mutual review requirement)
4. Positive feedback confirms final economic fulfillment
5. Negative feedback triggers the resolution process before fulfillment is confirmed
6. Ratings are aggregated into the user's reputation score

### Feedback-Conditional Fulfillment

As documented in the [hREA Integration Specification](../../architecture/hrea-integration.md):

- **Positive feedback** confirms that the EconomicEvent truly fulfills the Commitment
- **Negative feedback** triggers a resolution pathway -- the exchange is not considered fully closed until resolved
- This creates a quality assurance layer within the hREA economic flow

## Reputation Metrics

### Individual Metrics

```typescript
interface UserReputation {
  userId: AgentPubKey;
  totalExchanges: number;
  averageRating: number;            // Weighted average of all star ratings
  completionRate: number;           // Percentage of agreements fulfilled
  onTimeRate: number;               // Percentage of exchanges completed on time
  asAgreedRate: number;             // Percentage of exchanges completed as agreed
  badges: ReputationBadge[];
  trustScore: number;               // Composite calculated metric
}
```

| Metric | Source | Calculation |
|---|---|---|
| Average rating | Star ratings | Weighted mean across all reviews received |
| Completion rate | hREA Fulfillment data | Fulfilled Commitments / Total Commitments |
| On-time rate | `onTime` flags | Positive `onTime` / Total reviews |
| As-agreed rate | `asAgreed` flags | Positive `asAgreed` / Total reviews |
| Trust score | Composite | Weighted combination of all metrics above |

### Community Metrics (Future)

- Peer endorsements
- Community contributions
- Leadership roles in organizations
- Mentorship activities

### Achievement Badges

| Badge | Criteria |
|---|---|
| Newcomer | First completed exchange |
| Reliable | 10+ exchanges with 90%+ completion rate |
| Trusted | 25+ exchanges with 4.5+ average rating |
| On Time | 20+ exchanges with 95%+ on-time rate |
| Community Builder | Active in 3+ organizations |

## Technical Architecture

### Custom Zome Structure

```
dnas/requests_and_offers/zomes/
├── integrity/reviews/
│   └── src/lib.rs
│       ├── ExchangeReview entry definition
│       ├── Validation rules:
│       │   ├── Reviewer must be a party to the Agreement
│       │   ├── Rating must be 1-5
│       │   ├── Comments max 200 chars
│       │   ├── One review per reviewer per Agreement
│       │   └── Agreement must have fulfilled Commitments
│       └── Link types: AgreementToReview, AgentToReview
│
└── coordinator/reviews/
    └── src/lib.rs
        ├── create_review(input) -> ExchangeReview
        ├── get_reviews_for_agreement(agreement_id) -> Vec<ExchangeReview>
        ├── get_reviews_for_agent(agent_pub_key) -> Vec<ExchangeReview>
        └── get_reputation(agent_pub_key) -> UserReputation
```

### Frontend Service (Effect-TS)

```typescript
export const ReviewService = Context.GenericTag<ReviewService>("ReviewService");

export const makeReviewService = Effect.gen(function* () {
  const client = yield* HolochainClientService;

  const submitReview = (input: CreateReviewInput) =>
    client.callZome({
      zome_name: "reviews",
      fn_name: "create_review",
      payload: input,
    }).pipe(
      Effect.mapError((error) => new ReviewError({ cause: error }))
    );

  const getReviewsForAgreement = (agreementId: ActionHash) =>
    client.callZome({
      zome_name: "reviews",
      fn_name: "get_reviews_for_agreement",
      payload: agreementId,
    });

  const getReviewsForAgent = (agentPubKey: AgentPubKey) =>
    client.callZome({
      zome_name: "reviews",
      fn_name: "get_reviews_for_agent",
      payload: agentPubKey,
    });

  const getReputation = (agentPubKey: AgentPubKey) =>
    client.callZome({
      zome_name: "reviews",
      fn_name: "get_reputation",
      payload: agentPubKey,
    });

  return { submitReview, getReviewsForAgreement, getReviewsForAgent, getReputation };
});
```

### Frontend Components

```
components/exchanges/reviews/
├── ReviewForm.svelte           # Star rating + feedback form
├── StarRating.svelte           # Reusable 1-5 star input/display
├── ReputationDisplay.svelte    # User reputation card with metrics
└── ReviewCard.svelte           # Individual review display
```

### Cross-DNA References

The reviews zome lives in the `requests_and_offers` DNA but references hREA Agreement IDs (which live in the `hrea` DNA). This cross-DNA reference is handled by storing the Agreement's `ActionHash` as a field in the `ExchangeReview` entry. Queries go through the frontend service layer, which orchestrates calls to both DNAs.

## Moderation

### Review Quality

- **Validation at zome level**: Reviewer must be a party to the Agreement; one review per party per Agreement
- **Rating bounds**: Enforced 1-5 range in integrity zome validation
- **Comment length**: Enforced 200-char max in integrity zome validation
- **Spam prevention**: Cannot review an Agreement you're not part of

### Dispute Resolution

- **Negative feedback pathway**: Triggers resolution process before economic fulfillment is confirmed
- **Appeal process**: Disputed reviews can be flagged for admin moderation (integrates with existing `administration` zome)
- **Statistical outlier detection**: Reviews significantly deviating from a user's average can be flagged

## Privacy & Fairness

### Bias Prevention

- **Mutual review requirement**: Both parties must submit reviews, reducing retaliation bias
- **Statistical outlier detection**: Identifies potential review manipulation
- **Recalibration mechanisms**: Reputation scores account for review volume (low sample size = lower confidence)

### Data Protection

- **Aggregation**: Reputation scores are computed aggregates, not exposing individual review details unnecessarily
- **Individual privacy**: Reviews are linked to Agreements, not publicly browsable outside exchange context
- **Data portability**: Reputation data is stored on the user's source chain, portable by design (Holochain architecture)

## Implementation Priority

This system is part of **Phase 2** of the exchange process implementation roadmap (see [Exchange Process](./exchange-process.md#implementation-roadmap)):

1. Implement `reviews` integrity + coordinator zome
2. Add `ReviewService` (Effect-TS) and review store (Svelte 5 Runes)
3. Build review UI components (ReviewForm, StarRating, ReputationDisplay)
4. Integrate feedback-conditional fulfillment gate with hREA flow
5. Add reputation aggregation and display

### Dependencies

- hREA Agreement system must be operational (Phase 1 of exchange process)
- Existing `administration` zome for moderation integration
- Existing user/organization system for agent identity

## Related Issues

- [#90](https://github.com/happenings-community/requests-and-offers/issues/90) — hREA Exchange Process (reviews are Phase 2 of exchange roadmap)
- [#91](https://github.com/happenings-community/requests-and-offers/issues/91) — Chat System (exchange context for reviews originates from conversations)
- [#92](https://github.com/happenings-community/requests-and-offers/issues/92) — Unyt Smart Agreements Exploration (future automated fulfillment gates)
