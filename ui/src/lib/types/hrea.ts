import type { Schema } from 'effect';
import type { AgentSchema, ResourceSpecificationSchema } from '$lib/schemas/hrea.schemas';

export type Agent = Schema.Schema.Type<typeof AgentSchema>;
export type ResourceSpecification = Schema.Schema.Type<typeof ResourceSpecificationSchema>;
