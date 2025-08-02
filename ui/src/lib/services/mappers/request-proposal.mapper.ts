import { Effect as E, pipe } from 'effect';
import { HreaError } from '$lib/errors';
import { HREA_CONTEXTS } from '$lib/errors/error-contexts';
import type { UIRequest } from '$lib/types/ui';
import type { Agent, ResourceSpecification, Proposal, Intent } from '$lib/types/hrea';

/**
 * Request to hREA Proposal + Intents Mapping Infrastructure
 *
 * This module implements the critical business logic for mapping application requests
 * to hREA economic proposals with the two-intent reciprocal pattern:
 *
 * Request → Proposal with:
 * 1. Service Intent: action='work', receiver=requester, resourceSpecifiedBy=serviceType
 * 2. Payment Intent: action='transfer', provider=requester, resourceSpecifiedBy=mediumOfExchange
 *
 * This creates the proper economic reciprocity that hREA requires for value flow modeling.
 */

export interface RequestProposalMappingParams {
  request: UIRequest;
  requesterAgent: Agent;
  serviceTypeResourceSpecs: ResourceSpecification[];
  mediumOfExchangeResourceSpec: ResourceSpecification;
}

export interface RequestProposalMappingResult {
  proposal: Proposal;
  serviceIntents: Intent[];
  paymentIntent: Intent;
  allIntents: Intent[];
}

/**
 * Core mapping function that converts a Request to a Proposal + Intents
 * following the two-intent reciprocal pattern.
 *
 * Business Logic:
 * - Creates a single proposal with descriptive name from request
 * - Creates one service intent per service type requested (receiver=requester)
 * - Creates one payment intent for the medium of exchange (provider=requester)
 * - Links all intents to the proposal via proposeIntent
 */
export const createProposalFromRequest = (
  params: RequestProposalMappingParams
): E.Effect<RequestProposalMappingResult, HreaError> =>
  E.gen(function* () {
    const { request, requesterAgent, serviceTypeResourceSpecs, mediumOfExchangeResourceSpec } =
      params;

    // Validate input parameters
    if (!request.title?.trim()) {
      return yield* E.fail(
        HreaError.fromError(
          new Error('Request title is required for proposal creation'),
          HREA_CONTEXTS.MAP_TO_HREA
        )
      );
    }

    if (serviceTypeResourceSpecs.length === 0) {
      return yield* E.fail(
        HreaError.fromError(
          new Error('At least one service type resource specification is required'),
          HREA_CONTEXTS.MAP_TO_HREA
        )
      );
    }

    // Create proposal with descriptive name and note
    const proposalName = `Request: ${request.title}`;
    const proposalNote = createProposalNote(request, requesterAgent);

    const proposal: Proposal = {
      id: '', // Will be set by hREA service
      name: proposalName,
      note: proposalNote,
      eligible: [requesterAgent.id], // Requester is eligible for this proposal
      created: new Date().toISOString()
    };

    // Create service intents (one per service type requested)
    const serviceIntents: Intent[] = serviceTypeResourceSpecs.map((resourceSpec, index) => ({
      id: '', // Will be set by hREA service
      action: 'work', // Service provision action
      receiver: requesterAgent.id, // Requester receives the service
      resourceSpecifiedBy: resourceSpec.id,
      resourceQuantity: request.time_estimate_hours
        ? {
            hasNumericalValue: request.time_estimate_hours,
            hasUnit: 'hour'
          }
        : undefined
    }));

    // Create payment intent (requester provides payment)
    const paymentIntent: Intent = {
      id: '', // Will be set by hREA service
      action: 'transfer', // Payment/transfer action
      provider: requesterAgent.id, // Requester provides the payment
      resourceSpecifiedBy: mediumOfExchangeResourceSpec.id
    };

    // Combine all intents
    const allIntents = [...serviceIntents, paymentIntent];

    return {
      proposal,
      serviceIntents,
      paymentIntent,
      allIntents
    };
  });

/**
 * Creates a comprehensive proposal note from request details
 */
function createProposalNote(request: UIRequest, requesterAgent: Agent): string {
  const lines: string[] = [];

  // Basic request information
  lines.push(`Description: ${request.description}`);
  lines.push(`Requested by: ${requesterAgent.name} (${requesterAgent.id})`);

  // Time and scheduling information
  if (request.time_estimate_hours) {
    lines.push(`Estimated time: ${request.time_estimate_hours} hours`);
  }

  if (request.time_preference) {
    lines.push(`Time preference: ${request.time_preference}`);
  }

  if (request.time_zone) {
    lines.push(`Time zone: ${request.time_zone}`);
  }

  if (request.date_range) {
    const startDate = request.date_range.start
      ? new Date(request.date_range.start).toLocaleDateString()
      : 'Not specified';
    const endDate = request.date_range.end
      ? new Date(request.date_range.end).toLocaleDateString()
      : 'Not specified';
    lines.push(`Date range: ${startDate} - ${endDate}`);
  }

  // Contact and interaction preferences
  if (request.contact_preference) {
    lines.push(`Contact preference: ${request.contact_preference}`);
  }

  if (request.interaction_type) {
    lines.push(`Interaction type: ${request.interaction_type}`);
  }

  // Additional links and resources
  if (request.links && request.links.length > 0) {
    lines.push(`Links: ${request.links.join(', ')}`);
  }

  // hREA mapping metadata
  lines.push('');
  lines.push('--- hREA Mapping ---');
  lines.push(`Original request hash: ${request.original_action_hash || 'N/A'}`);
  lines.push(`Created: ${new Date().toISOString()}`);

  return lines.join('\n');
}

/**
 * Helper function to validate that required hREA entities exist for mapping
 */
export const validateRequestMappingRequirements = (
  request: UIRequest,
  requesterAgent: Agent | null,
  serviceTypeResourceSpecs: ResourceSpecification[],
  mediumOfExchangeResourceSpec: ResourceSpecification | null
): E.Effect<void, HreaError> =>
  E.gen(function* () {
    const errors: string[] = [];

    if (!requesterAgent) {
      errors.push('Requester agent not found in hREA');
    }

    if (!request.service_type_hashes || request.service_type_hashes.length === 0) {
      errors.push('Request must have at least one service type');
    }

    if (serviceTypeResourceSpecs.length === 0) {
      errors.push('No service type resource specifications found in hREA');
    }

    if (!request.medium_of_exchange_hashes || request.medium_of_exchange_hashes.length === 0) {
      errors.push('Request must have a medium of exchange');
    }

    if (!mediumOfExchangeResourceSpec) {
      errors.push('Medium of exchange resource specification not found in hREA');
    }

    if (errors.length > 0) {
      return yield* E.fail(
        HreaError.fromError(
          new Error(`Request mapping validation failed: ${errors.join('; ')}`),
          HREA_CONTEXTS.MAP_TO_HREA
        )
      );
    }
  });

/**
 * Creates action hash reference for storing proposal ID in request
 */
export const createProposalReference = (proposalId: string): string => {
  return `ref:proposal:${proposalId}`;
};

/**
 * Extracts proposal ID from action hash reference
 */
export const extractProposalIdFromReference = (reference: string): string | null => {
  const match = reference.match(/^ref:proposal:(.+)$/);
  return match ? match[1] : null;
};
