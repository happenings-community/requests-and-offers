import type { UIExchange } from '$lib/types/ui';
import type { ExchangeTerm, ResourceKind, Timeframe, TimeframePreset } from '$lib/types/holochain';
import type {
  AgreementInput,
  CommitmentInput,
  EconomicEventInput
} from '$lib/services/hrea.service';
import { timeframeLabel } from '$lib/utils/timeframe';

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

/** The hREA ids an accepted R&O agreement was mirrored as. */
export type HreaAgreementRefs = {
  agreementId: string;
  primaryCommitmentId: string;
  primaryRevisionId?: string;
  reciprocalCommitmentId?: string;
  reciprocalRevisionId?: string;
};

type AgreementRecord = { id: string; note?: string | null };
type CommitmentRecord = { id: string; revisionId?: string; provider: string; clauseOf?: string };

/**
 * Rebuilds an R&O agreement's hREA ids from hREA's own records, for when the
 * in-memory mapping is gone (a reload). The Agreement is the one whose note is
 * the R&O hash; its Commitments are its clauses, the primary one provided by
 * the provider and the reciprocal one by the receiver (mapAgreementToHrea).
 * Null when hREA holds no such Agreement, or no primary Commitment for it.
 * Several Agreements with the same note: the first with a primary Commitment.
 */
export function agreementRefsFromHrea(
  ref: string,
  parties: ResolvedParties,
  agreements: ReadonlyArray<AgreementRecord>,
  commitments: ReadonlyArray<CommitmentRecord>
): HreaAgreementRefs | null {
  // More than one Agreement can carry the hash when an earlier mirror was cut
  // short after its Agreement: the one with a primary Commitment is the mirror.
  for (const agreement of agreements.filter((a) => a.note === ref)) {
    const clauses = commitments.filter((c) => c.clauseOf === agreement.id);
    const primary = clauses.find((c) => c.provider === parties.providerAgentId);
    if (!primary) continue;
    const reciprocal = clauses.find((c) => c.provider === parties.receiverAgentId);
    return {
      agreementId: agreement.id,
      primaryCommitmentId: primary.id,
      primaryRevisionId: primary.revisionId,
      reciprocalCommitmentId: reciprocal?.id,
      reciprocalRevisionId: reciprocal?.revisionId
    };
  }
  return null;
}

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

/**
 * Label-to-Unit-id registry from the Units on the network (#441). Two members
 * starting together can each seed the same label, so a label may be held by
 * several Units. Every member must resolve it to the same one whatever order
 * the Units arrive in: the lowest id wins, compared by code unit rather than
 * locale, so the choice is the same on every machine.
 */
export function unitRegistryFrom(
  units: ReadonlyArray<{ id: string; label: string }>
): Record<string, string> {
  const registry: Record<string, string> = {};
  for (const unit of units) {
    const held = registry[unit.label];
    if (held === undefined || unit.id < held) registry[unit.label] = unit.id;
  }
  return registry;
}

/**
 * A quantity as an hREA measure: the Unit id the label resolves to, or none while
 * the label has no seeded Unit. Exchanges and request estimates both come through
 * here, so they name the same Unit; a label is never sent as `hasUnit`, hREA
 * rejects it and the whole write with it.
 */
export function measureFor(
  value: string,
  unitLabel: string
): { hasNumericalValue: number; hasUnit: string } | undefined {
  const unitId = unitRegistry[unitLabel];
  // The one place a quantity becomes a float. hREA stores
  // `has_numerical_value` as f64 and R&O's hREA schema is `Schema.Number`, so the
  // exact decimal string is converted here and nowhere else, until hREA stores
  // decimals itself: https://github.com/h-REA/hREA/issues/382. The zome caps a
  // quantity at 15 significant digits, which an f64 round-trips.
  return unitId ? { hasNumericalValue: Number(value), hasUnit: unitId } : undefined;
}

/** Structured measure when the label maps to a seeded hREA Unit id. */
export function measureOf(
  term: ExchangeTerm
): { hasNumericalValue: number; hasUnit: string } | undefined {
  if (!term.quantity) return undefined;
  return measureFor(term.quantity.value, term.quantity.unit);
}

/** Prose fallback, only for labels with no seeded Unit. */
export function quantityText(term: ExchangeTerm): string | undefined {
  if (!term.quantity) return undefined;
  if (unitRegistry[term.quantity.unit]) return undefined;
  return `Quantity: ${term.quantity.value} ${term.quantity.unit}`;
}

/**
 * Whether hREA's adapter can carry this date: it sends `getTime() * 1000` to the zome
 * as an i64, and a number past `MAX_SAFE_INTEGER` goes as a float the zome cannot
 * decode. That is any date before about 1685 or after about 2255.
 */
function encodable(ms: number): boolean {
  return Number.isSafeInteger(Math.round(ms) * 1000);
}

/**
 * A Holochain timestamp (microseconds) as an ISO date, or null when hREA could not
 * carry it. Validation bounds a window's end (after the action that writes it, within
 * 365 days) but not its start, so a hand-written start can be out of range, and
 * `toISOString` throws on a date it cannot hold.
 */
function iso(micros: number): string | null {
  const date = new Date(micros / 1000);
  return Number.isNaN(date.getTime()) || !encodable(date.getTime()) ? null : date.toISOString();
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
    if (due === null) return {};
    const beginning = start === null || start === undefined ? null : iso(start);
    return beginning === null ? { due } : { due, hasBeginning: beginning, hasEnd: due };
  }
  const days = PRESET_DAYS[timeframe.Preset];
  if (days === null) return {};
  return { due: new Date(acceptedAtMs + days * 24 * 60 * 60 * 1000).toISOString() };
}

/**
 * What is wrong with a Commitment input, in our own words, before hREA sees it; null
 * when nothing is. hREA cannot say this itself: a zome that cannot decode its input
 * answers with the input's bytes, not the field it stopped at. So the mirror checks
 * what it built (ids present, a quantity that is a finite number above zero, dates
 * that are dates) and fails with a reason a reader can act on.
 */
export function commitmentProblem(input: CommitmentInput): string | null {
  for (const field of ['action', 'provider', 'receiver'] as const) {
    if (!input[field]) return `the Commitment has no ${field}`;
  }
  const q = input.resourceQuantity;
  if (q) {
    if (!Number.isFinite(q.hasNumericalValue) || q.hasNumericalValue <= 0) {
      return `the Commitment's quantity ${q.hasNumericalValue} is not a number above zero`;
    }
    if (!q.hasUnit) return "the Commitment's quantity has no unit";
  }
  for (const field of ['due', 'hasBeginning', 'hasEnd'] as const) {
    const value = input[field];
    if (value === undefined) continue;
    const ms = Date.parse(value);
    if (Number.isNaN(ms)) return `the Commitment's ${field} "${value}" is not a date`;
    if (!encodable(ms)) return `the Commitment's ${field} "${value}" is out of range for hREA`;
  }
  return null;
}

/**
 * The accepted exchanges this member should mirror and has no record of mirroring:
 * those whose acceptance they wrote. The member who accepts is the agreement's
 * counterparty (`respond_to_agreement` refuses anyone else), and the mirror is
 * written from their app when they accept, so a repair is theirs too: an
 * administrator never writes a party's Commitments for them, and two parties never
 * race to write the same Agreement. `known` holds the refs already mirrored or
 * already tried in this session.
 *
 * An exchange either side has marked done is left out: its completion was recorded
 * without an Agreement, and a repaired Commitment would stay open with nothing to
 * fulfil it. A cancelled one is kept, and the caller finishes its Commitments.
 */
export function exchangesToMirror(
  exchanges: UIExchange[],
  me: string,
  known: ReadonlySet<string>
): UIExchange[] {
  return exchanges.filter(
    (ex) =>
      ex.response?.accepted === true &&
      !ex.provider_done &&
      !ex.receiver_done &&
      actionForKind(ex.agreement.primary.resource_kind) !== null &&
      ex.agreement.counterparty.toString() === me &&
      !known.has(rnoAgreementRef(ex))
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
    // ValueFlows dates from the timeframe (#380): due from a preset counted
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
  at: number,
  /** The Commitment of this side, which the event fulfills. */
  commitmentId?: string
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
    realizationOf: hreaAgreementId,
    fulfills: commitmentId ? [commitmentId] : undefined
  };
}
