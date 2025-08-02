import type { Schema } from 'effect';
import type { AgentSchema, ResourceSpecificationSchema, ProposalSchema, IntentSchema } from '$lib/schemas/hrea.schemas';

export type Agent = Schema.Schema.Type<typeof AgentSchema>;
export type ResourceSpecification = Schema.Schema.Type<typeof ResourceSpecificationSchema>;
export type Proposal = Schema.Schema.Type<typeof ProposalSchema>;
export type Intent = Schema.Schema.Type<typeof IntentSchema>;
