import type { UIExchange } from '$lib/types/ui';
import type { ExchangeTerm, ResourceKind, Timeframe, TimeframePreset } from '$lib/types/holochain';
import { timeframeLabel } from '$lib/utils/counter-proposal';
import type { AgreementInput, CommitmentInput, EconomicEventInput } from '$lib/services/hrea.service';
import type { Commitment } from '$lib/types/hrea';
import { Effect as E, pipe } from 'effect';

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

/** Days a preset allows, counted from acceptance; Flexible sets no due date. */
const PRESET_DAYS: Record<TimeframePreset, number | null> = {
  WithinAFewDays: 3,
  WithinTwoWeeks: 14,
  WithinAMonth: 30,
  Flexible: null
};

/** The hREA Commitment dates a timeframe sets; all ISO strings, which the adapter turns into microseconds. */
export type CommitmentDates = { due?: string; hasBeginning?: string; hasEnd?: string };

/**
 * ValueFlows dates for a timeframe: due is a preset counted from the acceptance
 * time (milliseconds) or a window's end; a window with a start also sets
 * hasBeginning and hasEnd. Flexible sets none.
 */
export function datesFor(timeframe: Timeframe, acceptedAtMs: number): CommitmentDates {
  if ('Dates' in timeframe) {
    const { start, end } = timeframe.Dates;
    const due = iso(end);
    return start === null || start === undefined
      ? { due }
      : { due, hasBeginning: iso(start), hasEnd: due };
  }
  const days = PRESET_DAYS[timeframe.Preset];
  if (days === null) return {};
  return { due: new Date(acceptedAtMs + days * 24 * 60 * 60 * 1000).toISOString() };
}

/** True when a commitment input carries any of the three dates. */
export function carriesDates(input: CommitmentInput): boolean {
  return input.due !== undefined || input.hasBeginning !== undefined || input.hasEnd !== undefined;
}

/** The same input with the three dates left out, for the write hREA makes when it refuses them. */
export function withoutDates(input: CommitmentInput): CommitmentInput {
  const bare = { ...input };
  delete bare.due;
  delete bare.hasBeginning;
  delete bare.hasEnd;
  return bare;
}

/**
 * The conductor's wire error names a bad date can produce: the zome answered
 * and said no to the input itself (`ExternalApiWireError` in
 * `holochain_conductor_api`). Unauthorized and authentication failures
 * are answers too, but dates do not cause them, so a write without dates
 * cannot succeed; they fail as they are. A timeout or a dropped socket is
 * never on the list, by construction: those are not answers.
 */
const REFUSED_THE_INPUT = new Set(['ribosome_error', 'deserialization']);

/** Every `name` on the error and on what it wraps (cause, originalError, networkError, graphQLErrors), read by shape, never by class. */
function namesIn(error: unknown, depth = 0, seen = new Set<object>()): string[] {
  if (depth > 6 || error === null || typeof error !== 'object' || seen.has(error)) return [];
  seen.add(error);
  const e = error as {
    name?: unknown;
    cause?: unknown;
    originalError?: unknown;
    networkError?: unknown;
    graphQLErrors?: unknown;
  };
  const names = typeof e.name === 'string' ? [e.name] : [];
  const inner = [e.cause, e.originalError, e.networkError].concat(
    Array.isArray(e.graphQLErrors) ? e.graphQLErrors : []
  );
  return names.concat(...inner.map((x) => namesIn(x, depth + 1, seen)));
}

/**
 * True when hREA's zome answered and refused the input (a deserialize or
 * validation error). Refusal has to be earned by a positive match; a timeout
 * or a lost reply is not one, since the first write may have landed.
 */
export function isRecognisedRefusal(error: unknown): boolean {
  return namesIn(error).some((name) => REFUSED_THE_INPUT.has(name));
}

/**
 * Writes a Commitment, keeping the mirror when hREA refuses its dates: on a
 * recognised refusal the same input goes again without `due`, `hasBeginning`
 * and `hasEnd`, with a console warning. Anything else fails as it is, because
 * a retry after a timeout or a lost reply could write a duplicate Commitment.
 * An input without dates is written once, whatever happens.
 */
export function writeCommitment<Err>(
  create: (input: CommitmentInput) => E.Effect<Commitment, Err>,
  input: CommitmentInput,
  ref: string
): E.Effect<Commitment, Err> {
  if (!carriesDates(input)) return create(input);
  return pipe(
    create(input),
    E.catchAll((error) => {
      if (!isRecognisedRefusal(error)) return E.fail(error);
      console.warn(
        'hREA Store: commitment refused with its dates, writing it without them',
        ref,
        error
      );
      return create(withoutDates(input));
    })
  );
}

/** The R&O agreement hash as a string, used as agreedIn and as the map key. */
export function rnoAgreementRef(exchange: UIExchange): string {
  return exchange.agreement_hash.toString();
}

export function mapAgreementToHrea(
  exchange: UIExchange,
  parties: ResolvedParties,
  specs: ResolvedSpecs,
  acceptedAtMs: number = Date.now()
): MappedAgreement | null {
  const a = exchange.agreement;
  const dates = datesFor(a.delivery_timeframe, acceptedAtMs);
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
    // ValueFlows dates from the timeframe (#370): due from a preset counted
    // from acceptance or a window's end, hasBeginning/hasEnd for a window with
    // a start. The timeframe's label still travels in the note.
    ...dates,
    finished: false,
    note:
      [a.terms, `Timeframe: ${timeframeLabel(a.delivery_timeframe)}`, quantityText(a.primary)]
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
          ...dates,
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
