import type { UIExchange } from '$lib/types/ui';
import type { ExchangeTerm, ResourceKind } from '$lib/types/holochain';
import type { AgreementInput, CommitmentInput, EconomicEventInput } from '$lib/services/hrea.service';

/**
 * Pure mapping from an accepted R&O exchange to hREA inputs. Everything here
 * is resolved by the caller: agent ids from the user-agent map, spec ids by
 * name. The R&O agreement hash rides in agreedIn on every commitment and
 * event, which is how R&O keeps the fulfilment join on its own side
 * (EXCHANGE_PUBLICATION.md 5.2).
 */

export type ResolvedParties = {
  providerAgentId: string;
  receiverAgentId: string;
};

export type ResolvedSpecs = {
  primarySpecId?: string;
  reciprocalSpecId?: string;
};

export type MappedAgreement = {
  agreement: AgreementInput;
  primary: CommitmentInput;
  reciprocal: CommitmentInput | null;
};

/** work matches the existing intent mapper; see the scaffold note on deliverService. */
export function actionForKind(kind: ResourceKind): string | null {
  switch (kind) {
    case 'Service':
      return 'work';
    case 'Currency':
    case 'Gift':
      return 'transfer';
    case 'Tbd':
      return null;
  }
}

/**
 * Label-to-Unit-id registry, filled by the hREA store after seeding units.
 * Module-level rather than threaded through signatures: a deliberate
 * trade-off, flagged for review.
 */
let unitRegistry: Record<string, string> = {};

export function setUnitRegistry(registry: Record<string, string>): void {
  unitRegistry = registry;
}

/** Structured measure when the label maps to a seeded hREA Unit id. */
export function measureOf(
  term: ExchangeTerm
): { hasNumericalValue: number; hasUnit: string } | undefined {
  if (!term.quantity) return undefined;
  const unitId = unitRegistry[term.quantity.unit];
  return unitId ? { hasNumericalValue: term.quantity.value, hasUnit: unitId } : undefined;
}

/** Prose fallback, only for labels with no seeded Unit. */
export function quantityText(term: ExchangeTerm): string | undefined {
  if (!term.quantity) return undefined;
  if (unitRegistry[term.quantity.unit]) return undefined;
  return `Quantity: ${term.quantity.value} ${term.quantity.unit}`;
}

function iso(micros: number): string {
  // Holochain timestamps are microseconds; Date wants milliseconds.
  return new Date(micros / 1000).toISOString();
}

/** The R&O agreement hash as a string, used as agreedIn and as the map key. */
export function rnoAgreementRef(exchange: UIExchange): string {
  return exchange.agreement_hash.toString();
}

export function mapAgreementToHrea(
  exchange: UIExchange,
  parties: ResolvedParties,
  specs: ResolvedSpecs
): MappedAgreement | null {
  const a = exchange.agreement;
  const primaryAction = actionForKind(a.primary.resource_kind);
  if (!primaryAction) return null;

  const ref = rnoAgreementRef(exchange);
  const agreement: AgreementInput = {
    name: `${a.listing_type}: ${a.primary.resource_conforms_to}`,
    // No created field: hREA's zome rejects client-supplied timestamps here
    // (Deserialize error at rea_agreement.rs) and stamps its own. The R&O
    // acceptance time lives in the R&O DHT, reachable via the note ref.
    note: ref
  };

  const primary: CommitmentInput = {
    action: primaryAction,
    provider: parties.providerAgentId,
    receiver: parties.receiverAgentId,
    resourceConformsTo: specs.primarySpecId,
    resourceQuantity: measureOf(a.primary),
    // due is a DateTime in hREA; R&O's delivery_timeframe is free text
    // ("Within 2 weeks"), so it travels in the note instead. due is only
    // ever sent once R&O captures actual dates.
    finished: false,
    note:
      [a.terms, a.delivery_timeframe && `Timeframe: ${a.delivery_timeframe}`, quantityText(a.primary)]
        .filter(Boolean)
        .join(' | ') || undefined,
    agreedIn: ref
  };

  const reciprocalAction = actionForKind(a.reciprocal.resource_kind);
  const reciprocal: CommitmentInput | null =
    reciprocalAction && a.reciprocal.resource_kind !== 'Gift'
      ? {
          action: reciprocalAction,
          provider: parties.receiverAgentId,
          receiver: parties.providerAgentId,
          resourceConformsTo: specs.reciprocalSpecId,
          resourceQuantity: measureOf(a.reciprocal),
          finished: false,
          note: [a.medium, quantityText(a.reciprocal)].filter(Boolean).join(' | ') || undefined,
          agreedIn: ref
        }
      : null;

  return { agreement, primary, reciprocal };
}

export type CompletionSide = 'provider' | 'receiver';

/**
 * The completing party's event. The provider's completion is the primary flow
 * delivered; the receiver's completion is the reciprocal flow delivered. A
 * receiver completing a gift exchange has no reciprocal flow and no event.
 */
export function mapCompletionToEvent(
  exchange: UIExchange,
  side: CompletionSide,
  parties: ResolvedParties,
  specs: ResolvedSpecs,
  hreaAgreementId: string | undefined,
  at: number
): EconomicEventInput | null {
  const a = exchange.agreement;
  const term = side === 'provider' ? a.primary : a.reciprocal;
  if (side === 'receiver' && a.reciprocal.resource_kind === 'Gift') return null;
  const action = actionForKind(term.resource_kind);
  if (!action) return null;

  const forward = side === 'provider';
  return {
    action,
    provider: forward ? parties.providerAgentId : parties.receiverAgentId,
    receiver: forward ? parties.receiverAgentId : parties.providerAgentId,
    resourceConformsTo: forward ? specs.primarySpecId : specs.reciprocalSpecId,
    resourceQuantity: measureOf(term),
    // No hasPointInTime: timestamp fields have bounced at three hREA zomes
    // today; completion time lives in the R&O DHT, reachable via agreedIn.
    agreedIn: rnoAgreementRef(exchange),
    realizationOf: hreaAgreementId
  };
}
