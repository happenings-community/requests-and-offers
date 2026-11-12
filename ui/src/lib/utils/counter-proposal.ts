import type { ActionHash } from '@holochain/client';
import type { AgreementInDHT, CounterAgreementInput, ExchangeTerm } from '$lib/types/holochain';
import {
  decimalProblem,
  decimalsEqual,
  isOne,
  isZeroDecimal,
  parseTypedDecimal
} from '$lib/utils/decimal';

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

/**
 * What a member has typed, as text. Amounts are exact decimals, so they stay
 * strings from the input to the zome call and never pass through a float.
 * A blank input reads as an empty string, null or undefined.
 */
export interface CounterEdits {
  primary: string | null | undefined;
  reciprocal: string | null | undefined;
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

/**
 * Zero (in any spelling) and blank mean the same thing: no quantity.
 *
 * Anything else comes back trimmed and with a decimal comma read as a dot, even
 * when it is not a well-formed amount, so `counterProblem` can say what is wrong.
 */
export function normaliseQuantity(value: string | null | undefined): string | null {
  const typed = parseTypedDecimal(value);
  if (typed === null) return null;
  if (decimalProblem(typed) === null && isZeroDecimal(typed)) return null;
  return typed;
}

/** Two normalised quantities are the same amount; a malformed one equals nothing but itself. */
function sameQuantity(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return a === b;
  if (decimalProblem(a) !== null || decimalProblem(b) !== null) return a === b;
  return decimalsEqual(a, b);
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
  value: string | null | undefined
): ExchangeTerm {
  if (!figure) return term;
  const v = normaliseQuantity(value);
  return { ...term, quantity: v === null ? null : { value: v, unit: unitFor(term, figure) } };
}

/** The fields the member has changed, comparing zero and blank as equal. */
export function changedFields(agreement: AgreementInDHT, edits: CounterEdits): CounterField[] {
  const changed: CounterField[] = [];
  if (
    !sameQuantity(
      normaliseQuantity(edits.primary),
      normaliseQuantity(agreement.primary.quantity?.value)
    )
  ) {
    changed.push('primary');
  }
  if (
    reciprocalFigure(agreement.reciprocal) &&
    !sameQuantity(
      normaliseQuantity(edits.reciprocal),
      normaliseQuantity(agreement.reciprocal.quantity?.value)
    )
  ) {
    changed.push('reciprocal');
  }
  if (edits.timeframe !== agreement.delivery_timeframe) changed.push('timeframe');
  return changed;
}

/** What stops a typed amount from being sent, in the member's words; null when it is fine or blank. */
function amountProblem(value: string | null | undefined, what: string): string | null {
  const typed = normaliseQuantity(value);
  if (typed === null) return null;
  if (decimalProblem(typed) === null) return null;
  // A minus sign in front of an otherwise good number is a negative, not a typo.
  if (typed.startsWith('-') && decimalProblem(typed.slice(1)) === null) {
    return `${what} can't be negative. Use 0 or leave it blank for none.`;
  }
  return `${what} ${decimalProblem(typed)}.`;
}

export const NOTHING_CHANGED =
  'Change the hours, the amount or the timeframe to send a counter-proposal.';

/** The first thing stopping this counter from being sent, in the member's words. */
export function counterProblem(agreement: AgreementInDHT, edits: CounterEdits): string | null {
  const figure = reciprocalFigure(agreement.reciprocal);
  return (
    amountProblem(edits.primary, 'Hours') ??
    (figure
      ? amountProblem(edits.reciprocal, figure === 'amount' ? 'The amount' : 'Return hours')
      : null) ??
    (changedFields(agreement, edits).length === 0 ? NOTHING_CHANGED : null)
  );
}

/**
 * The `counter_agreement` input: the proposal being countered and the three
 * things a counter may change. The zome copies everything else from the proposal.
 */
export function buildCounter(
  countered: ActionHash,
  agreement: AgreementInDHT,
  edits: CounterEdits
): CounterAgreementInput {
  return {
    agreement: countered,
    primary_quantity: withQuantity(agreement.primary, 'hours', edits.primary).quantity,
    reciprocal_quantity: withQuantity(
      agreement.reciprocal,
      reciprocalFigure(agreement.reciprocal),
      edits.reciprocal
    ).quantity,
    delivery_timeframe: edits.timeframe
  };
}

/** A quantity as the form shows what it was. */
export function describeQuantity(
  value: string | null | undefined,
  figure: 'hours' | 'amount',
  unit = ''
): string {
  const v = normaliseQuantity(value);
  if (v === null) return figure === 'amount' ? 'No amount' : 'No time estimate';
  if (figure === 'amount') return `${v} ${unit}`.trim();
  return `${v} ${isOne(v) ? 'hour' : 'hours'}`;
}
