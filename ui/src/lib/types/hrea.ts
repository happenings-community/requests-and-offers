import type { Schema } from 'effect';
import type {
  AgentSchema,
  ResourceSpecificationSchema,
  ProposalSchema,
  IntentSchema
} from '$lib/schemas/hrea.schemas';

export type Agent = Schema.Schema.Type<typeof AgentSchema>;
export type ResourceSpecification = Schema.Schema.Type<typeof ResourceSpecificationSchema>;
export type Proposal = Schema.Schema.Type<typeof ProposalSchema>;
export type Intent = Schema.Schema.Type<typeof IntentSchema>;

// Internal GraphQL response interfaces (used only by service layer for normalization)
export interface GraphQLIntentResponse {
  id: string;
  revisionId?: string;
  action: { id: string } | string;
  provider?: { id: string; name?: string } | string | null;
  receiver?: { id: string; name?: string } | string | null;
  resourceConformsTo?: { id: string; name?: string } | null;
  resourceSpecifiedBy?: string;
  resourceQuantity?: {
    hasNumericalValue: number;
    hasUnit: { id: string; label?: string; symbol?: string } | string;
  } | null;
  note?: string;
}

export interface GraphQLProposalResponse {
  id: string;
  name: string;
  note?: string;
  created?: string;
  revisionId?: string;
  hasBeginning?: string;
  hasEnd?: string;
  unitBased?: boolean;
  publishes?: GraphQLIntentResponse[];
  reciprocal?: GraphQLIntentResponse[];
}
