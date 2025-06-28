import type { Schema } from 'effect';
import type { AgentSchema } from '$lib/schemas/hrea.schemas';

export type Agent = Schema.Schema.Type<typeof AgentSchema>;
