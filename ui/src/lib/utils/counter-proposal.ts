import type { AgreementInDHT, CreateAgreementInput, ExchangeTerm } from '$lib/types/holochain';

/**
 * A counter-proposal: the proposal it answers, with only the quantities and the
 * timeframe changed.
 *
 * A first proposal takes its terms from published listings. A counter takes them
 * from the proposal it answers, which is the published record that backs it, so
 * only what is open to negotiation can move: the hours or amount on each side, and
 * when. The listing, the medium, both services and any proposal text are carried
 * across unchanged. Changing those means a new listing (#332).
 */

/** The timeframes the propose page offers, in its order. */
export const COUNTER_TIMEFRAMES = [
  'Within a few days',
  'Within 2 weeks',
  'Within a month',
  'Flexible'
] as const;

/** What a member has typed. A blank number input reads as null or undefined. */
export interface CounterEdits {
  primary: number | null | undefined;
  reciprocal: number | null | undefined;
  timeframe: string;
}

export type CounterField = 'primary' | 'reciprocal' | 'timeframe';

/**
 * Which kind of figure the return side can carry, if any.
 *
 * Validation refuses a quantity on a gift or a term still to be discussed, so
 * those sides have nothing to change.
 */
export function reciprocalFigure(term: ExchangeTerm): 'hours' | 'amount' | null {
  if (term.resource_kind === 'Currency') return 'amount';
  if (term.resource_kind === 'Service') return 'hours';
  return null;
}

/** Zero and blank mean the same thing: no quantity. */
export function normaliseQuantity(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(value) || value === 0) return null;
  return value;
}

export function startingEdits(agreement: AgreementInDHT): CounterEdits {
  return {
    primary: agreement.primary.quantity?.value ?? null,
    reciprocal: agreement.reciprocal.quantity?.value ?? null,
    timeframe: agreement.delivery_timeframe
  };
}

/** The timeframe list, keeping the proposal's own wording if it is not one of ours. */
export function timeframeOptions(current: string): string[] {
  const list: string[] = [...COUNTER_TIMEFRAMES];
  return current && !list.includes(current) ? [current, ...list] : list;
}

function unitFor(term: ExchangeTerm, figure: 'hours' | 'amount'): string {
  if (term.quantity?.unit) return term.quantity.unit;
  return figure === 'amount' ? term.resource_conforms_to : 'hours';
}

function withQuantity(
  term: ExchangeTerm,
  figure: 'hours' | 'amount' | null,
  value: number | null | undefined
): ExchangeTerm {
  if (!figure) return term;
  const v = normaliseQuantity(value);
  return { ...term, quantity: v === null ? null : { value: v, unit: unitFor(term, figure) } };
}

/** The fields the member has changed, comparing zero and blank as equal. */
export function changedFields(agreement: AgreementInDHT, edits: CounterEdits): CounterField[] {
  const changed: CounterField[] = [];
  if (normaliseQuantity(edits.primary) !== normaliseQuantity(agreement.primary.quantity?.value)) {
    changed.push('primary');
  }
  if (
    reciprocalFigure(agreement.reciprocal) &&
    normaliseQuantity(edits.reciprocal) !== normaliseQuantity(agreement.reciprocal.quantity?.value)
  ) {
    changed.push('reciprocal');
  }
  if (edits.timeframe !== agreement.delivery_timeframe) changed.push('timeframe');
  return changed;
}

function negativeProblem(value: number | null | undefined, what: string): string | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return `${what} must be a number.`;
  if (value < 0) return `${what} can't be negative. Use 0 or leave it blank for none.`;
  return null;
}

export const NOTHING_CHANGED =
  'Change the hours, the amount or the timeframe to send a counter-proposal.';

/** The first thing stopping this counter from being sent, in the member's words. */
export function counterProblem(agreement: AgreementInDHT, edits: CounterEdits): string | null {
  const figure = reciprocalFigure(agreement.reciprocal);
  return (
    negativeProblem(edits.primary, 'Hours') ??
    (figure
      ? negativeProblem(edits.reciprocal, figure === 'amount' ? 'The amount' : 'Return hours')
      : null) ??
    (changedFields(agreement, edits).length === 0 ? NOTHING_CHANGED : null)
  );
}

/** The new proposal: a copy of the countered one with only the edits applied. */
export function buildCounter(agreement: AgreementInDHT, edits: CounterEdits): CreateAgreementInput {
  return {
    listing: agreement.listing,
    listing_type: agreement.listing_type,
    interest: agreement.interest,
    primary: withQuantity(agreement.primary, 'hours', edits.primary),
    reciprocal: withQuantity(
      agreement.reciprocal,
      reciprocalFigure(agreement.reciprocal),
      edits.reciprocal
    ),
    medium: agreement.medium,
    terms: agreement.terms,
    delivery_timeframe: edits.timeframe
  };
}

/** A quantity as the form shows what it was. */
export function describeQuantity(
  value: number | null | undefined,
  figure: 'hours' | 'amount',
  unit = ''
): string {
  const v = normaliseQuantity(value);
  if (v === null) return figure === 'amount' ? 'No amount' : 'No time estimate';
  if (figure === 'amount') return `${v} ${unit}`.trim();
  return `${v} ${v === 1 ? 'hour' : 'hours'}`;
}
