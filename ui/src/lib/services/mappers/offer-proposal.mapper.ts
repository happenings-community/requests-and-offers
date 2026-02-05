import { Effect as E, pipe } from 'effect';
import { HreaError } from '$lib/errors';
import { HREA_CONTEXTS } from '$lib/errors/error-contexts';
import type { UIOffer } from '$lib/types/ui';
import type { Agent, ResourceSpecification, Proposal, Intent } from '$lib/types/hrea';

/**
 * Offer to hREA Proposal + Intents Mapping Infrastructure
 *
 * This module implements the critical business logic for mapping application offers
 * to hREA economic proposals with the two-intent reciprocal pattern:
 *
 * Offer → Proposal with:
 * 1. Service Intent: action='work', provider=offerer, resourceSpecifiedBy=serviceType
 * 2. Payment Intent: action='transfer', receiver=offerer, resourceSpecifiedBy=mediumOfExchange
 *
 * This creates the proper economic reciprocity that hREA requires for value flow modeling.
 * Note the role reversal compared to requests: offerer provides service and receives payment.
 */

export interface OfferProposalMappingParams {
  offer: UIOffer;
  offererAgent: Agent;
  serviceTypeResourceSpecs: ResourceSpecification[];
  mediumOfExchangeResourceSpec: ResourceSpecification;
}

export interface MappedIntent extends Intent {
  isReciprocal: boolean;
}

export interface OfferProposalMappingResult {
  proposal: Proposal;
  serviceIntents: MappedIntent[];
  paymentIntent: MappedIntent;
  allIntents: MappedIntent[];
}

/**
 * Core mapping function that converts an Offer to a Proposal + Intents
 * following the two-intent reciprocal pattern.
 *
 * Business Logic:
 * - Creates a single proposal with descriptive name from offer
 * - Creates one service intent per service type offered (provider=offerer)
 * - Creates one payment intent for the medium of exchange (receiver=offerer)
 * - Links all intents to the proposal via proposeIntent
 */
export const createProposalFromOffer = (
  params: OfferProposalMappingParams
): E.Effect<OfferProposalMappingResult, HreaError> =>
  E.gen(function* () {
    const { offer, offererAgent, serviceTypeResourceSpecs, mediumOfExchangeResourceSpec } = params;

    // Validate input parameters
    if (!offer.title?.trim()) {
      return yield* E.fail(
        HreaError.fromError(
          new Error('Offer title is required for proposal creation'),
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
    const proposalName = `Offer: ${offer.title}`;
    const proposalNote = createProposalNote(offer, offererAgent);

    const proposal: Proposal = {
      id: '', // Will be set by hREA service
      name: proposalName,
      note: proposalNote,
      eligible: [], // Open to any potential receivers
      created: new Date().toISOString()
    };

    // Create service intents (one per service type offered) — primary intents, not reciprocal
    const serviceIntents: MappedIntent[] = serviceTypeResourceSpecs.map((resourceSpec) => ({
      id: '', // Will be set by hREA service
      action: 'work', // Service provision action
      provider: offererAgent.id, // Offerer provides the service
      resourceSpecifiedBy: resourceSpec.id,
      // Note: Offers don't typically specify exact hours, so no resourceQuantity
      isReciprocal: false
    }));

    // Create payment intent (offerer receives payment) — reciprocal intent
    const paymentIntent: MappedIntent = {
      id: '', // Will be set by hREA service
      action: 'transfer', // Payment/transfer action
      receiver: offererAgent.id, // Offerer receives the payment
      resourceSpecifiedBy: mediumOfExchangeResourceSpec.id,
      isReciprocal: true
    };

    // Combine all intents
    const allIntents: MappedIntent[] = [...serviceIntents, paymentIntent];

    return {
      proposal,
      serviceIntents,
      paymentIntent,
      allIntents
    };
  });

/**
 * Creates a comprehensive proposal note from offer details
 */
function createProposalNote(offer: UIOffer, offererAgent: Agent): string {
  const lines: string[] = [];

  // Basic offer information
  lines.push(`Description: ${offer.description}`);
  lines.push(`Offered by: ${offererAgent.name} (${offererAgent.id})`);

  // Time and scheduling information
  if (offer.time_preference) {
    lines.push(`Time preference: ${offer.time_preference}`);
  }

  if (offer.time_zone) {
    lines.push(`Time zone: ${offer.time_zone}`);
  }

  // Contact and interaction preferences
  if (offer.interaction_type) {
    lines.push(`Interaction type: ${offer.interaction_type}`);
  }

  // Additional links and resources
  if (offer.links && offer.links.length > 0) {
    lines.push(`Links: ${offer.links.join(', ')}`);
  }

  // hREA mapping metadata
  lines.push('');
  lines.push('--- hREA Mapping ---');
  lines.push(`Original offer hash: ${offer.original_action_hash || 'N/A'}`);
  lines.push(`Created: ${new Date().toISOString()}`);

  return lines.join('\n');
}

/**
 * Helper function to validate that required hREA entities exist for mapping
 */
export const validateOfferMappingRequirements = (
  offer: UIOffer,
  offererAgent: Agent | null,
  serviceTypeResourceSpecs: ResourceSpecification[],
  mediumOfExchangeResourceSpec: ResourceSpecification | null
): E.Effect<void, HreaError> =>
  E.gen(function* () {
    const errors: string[] = [];

    if (!offererAgent) {
      errors.push('Offerer agent not found in hREA');
    }

    if (!offer.service_type_hashes || offer.service_type_hashes.length === 0) {
      errors.push('Offer must have at least one service type');
    }

    if (serviceTypeResourceSpecs.length === 0) {
      errors.push('No service type resource specifications found in hREA');
    }

    if (!offer.medium_of_exchange_hashes || offer.medium_of_exchange_hashes.length === 0) {
      errors.push('Offer must have a medium of exchange');
    }

    if (!mediumOfExchangeResourceSpec) {
      errors.push('Medium of exchange resource specification not found in hREA');
    }

    if (errors.length > 0) {
      return yield* E.fail(
        HreaError.fromError(
          new Error(`Offer mapping validation failed: ${errors.join('; ')}`),
          HREA_CONTEXTS.MAP_TO_HREA
        )
      );
    }
  });

/**
 * Creates action hash reference for storing proposal ID in offer
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
