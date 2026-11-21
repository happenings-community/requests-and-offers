import { Effect as E, pipe } from 'effect';
import { HreaError } from '$lib/errors';
import { HREA_CONTEXTS } from '$lib/errors/error-contexts';
import type { UIRequest } from '$lib/types/ui';
import { decimalProblem, isZeroDecimal } from '$lib/utils/decimal';
import { estimateLabel } from '$lib/utils/estimate';
import { timeframeLabel } from '$lib/utils/timeframe';
import type { Agent, ResourceSpecification, Proposal, Intent } from '$lib/types/hrea';
import type { ListingReciprocalAction } from './listing-medium';

/**
 * Request to hREA Proposal + Intents Mapping Infrastructure
 *
 * This module implements the critical business logic for mapping application requests
 * to hREA economic proposals with the two-intent reciprocal pattern:
 *
 * Request → Proposal with:
 * 1. Service Intent: action='work', receiver=requester, resourceSpecifiedBy=serviceType
 * 2. Reciprocal Intent: provider=requester, resourceSpecifiedBy=mediumOfExchange, its action
 *    set by the medium (listing-medium.ts): transfer for a currency, work for Service
 *    Exchange, and no reciprocal intent for a medium that expects nothing back
 *
 * This creates the proper economic reciprocity that hREA requires for value flow modeling.
 */

/**
 * A request's estimate as an hREA intent quantity, or none.
 *
 * hREA's `hasNumericalValue` is a float, so the exact decimal becomes a number only
 * here, in the mirror; the record of truth stays the string. A zero estimate, or one
 * that is not a decimal, gives no quantity: an intent for no hours says nothing.
 */
function estimateForHrea(
  hours: string | null | undefined
): { hasNumericalValue: number; hasUnit: string } | undefined {
  if (hours == null || decimalProblem(hours) !== null || isZeroDecimal(hours)) return undefined;
  return { hasNumericalValue: Number(hours), hasUnit: 'hour' };
}

export interface RequestProposalMappingParams {
  request: UIRequest;
  requesterAgent: Agent;
  serviceTypeResourceSpecs: ResourceSpecification[];
  mediumOfExchangeResourceSpec: ResourceSpecification;
  /**
   * What the reciprocal intent records, from the listing's medium
   * (`listingReciprocalAction`): `transfer` for a currency, `work` for Service
   * Exchange, null for a medium that expects nothing back, when no reciprocal intent
   * is published. Defaults to `transfer`, what every listing wrote before.
   */
  reciprocalAction?: ListingReciprocalAction;
  /**
   * A reciprocal intent for each of the listing's other mediums, after the first: its
   * specification and its action, a medium expecting nothing back left out. A listing
   * accepts any of its mediums, so an exchange may settle in any one of them.
   */
  otherReciprocals?: { resourceSpecifiedBy: string; action: 'transfer' | 'work' }[];
}

export interface MappedIntent extends Intent {
  isReciprocal: boolean;
}

export interface RequestProposalMappingResult {
  proposal: Proposal;
  serviceIntents: MappedIntent[];
  /** The first medium's reciprocal intent, or null for a medium that expects nothing back. */
  paymentIntent: MappedIntent | null;
  /** Every reciprocal intent, one per medium that expects something back. */
  reciprocalIntents: MappedIntent[];
  allIntents: MappedIntent[];
}

/**
 * Core mapping function that converts a Request to a Proposal + Intents
 * following the two-intent reciprocal pattern.
 *
 * Business Logic:
 * - Creates a single proposal with descriptive name from request
 * - Creates one service intent per service type requested (receiver=requester)
 * - Creates one payment intent for the medium of exchange (provider=requester)
 * - The store creates these intents first, then the proposal that publishes them (proposal-links.ts)
 */
export const createProposalFromRequest = (
  params: RequestProposalMappingParams
): E.Effect<RequestProposalMappingResult, HreaError> =>
  E.gen(function* () {
    const {
      request,
      requesterAgent,
      serviceTypeResourceSpecs,
      mediumOfExchangeResourceSpec,
      reciprocalAction = 'transfer',
      otherReciprocals = []
    } = params;

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

    // Create service intents (one per service type requested) — primary intents, not reciprocal
    const serviceIntents: MappedIntent[] = serviceTypeResourceSpecs.map((resourceSpec) => ({
      id: '', // Will be set by hREA service
      action: 'work', // Service provision action
      receiver: requesterAgent.id, // Requester receives the service
      resourceSpecifiedBy: resourceSpec.id,
      resourceQuantity: estimateForHrea(request.time_estimate_hours),
      isReciprocal: false
    }));

    // Create payment intent (requester provides payment) — reciprocal intent
    const paymentIntent: MappedIntent | null =
      reciprocalAction === null
        ? null
        : {
            id: '', // Will be set by hREA service
            action: reciprocalAction,
            provider: requesterAgent.id, // Requester gives what goes back
            resourceSpecifiedBy: mediumOfExchangeResourceSpec.id,
            isReciprocal: true
          };

    const reciprocalIntents: MappedIntent[] = [
      ...(paymentIntent ? [paymentIntent] : []),
      ...otherReciprocals.map((r) => ({
        id: '',
        action: r.action,
        provider: requesterAgent.id, // Requester gives what goes back
        resourceSpecifiedBy: r.resourceSpecifiedBy,
        isReciprocal: true
      }))
    ];

    // Combine all intents
    const allIntents: MappedIntent[] = [...serviceIntents, ...reciprocalIntents];

    return {
      proposal,
      serviceIntents,
      paymentIntent,
      reciprocalIntents,
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
  // The listing's estimate, printed as written (#525): zero is an estimate too.
  if (request.time_estimate_hours != null) {
    lines.push(`Estimated time: ${estimateLabel(request.time_estimate_hours)}`);
  }

  if (request.time_preference) {
    lines.push(`Time preference: ${request.time_preference}`);
  }

  if (request.time_zone) {
    lines.push(`Time zone: ${request.time_zone}`);
  }

  if (request.timeframe) {
    lines.push(`Timeframe: ${timeframeLabel(request.timeframe)}`);
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

    if (!request.service_type_hash) {
      errors.push('Request must name a service type');
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
