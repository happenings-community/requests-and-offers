import {
  decimalProblem,
  isOne,
  isZeroDecimal,
  parseTypedDecimal,
  typedDecimalProblem
} from '$lib/utils/decimal';

/**
 * A listing's time estimate as a member reads it (#380, #525): the decimal as it was
 * written, so 1.1 reads 1.1 hours, never the float a number would round it to. The request
 * page, its modal and the hREA proposal note all print it through here; the page and the
 * modal only when `hasEstimate` says there is one.
 */
export function estimateLabel(hours: string): string {
  return `${hours} ${isOne(hours) ? 'hour' : 'hours'}`;
}

/**
 * Whether a listing carries an estimate to show. Zero hours is no estimate: the proposal
 * page and the hREA mirror already read it that way, and the request page printed
 * "0 hours" (dogfooding of 21 November, F19). A zero written before the form refused it
 * is shown as none.
 */
export function hasEstimate(hours: string | null | undefined): hours is string {
  return hours != null && decimalProblem(hours) === null && !isZeroDecimal(hours);
}

/**
 * What a member typed in "Estimated time in hours": blank is no estimate, a decimal comma
 * reads as a dot, and zero is refused with a way out, since it would mean no estimate
 * anyway (F19). The form runs this when the field is left and again on submit.
 */
export function readEstimate(typed: string | null | undefined): {
  value: string | null;
  error: string | null;
} {
  const estimate = parseTypedDecimal(typed);
  if (estimate === null) return { value: null, error: null };
  const problem = typedDecimalProblem(estimate);
  if (problem) return { value: null, error: `The estimated time ${problem}.` };
  if (isZeroDecimal(estimate)) {
    return {
      value: null,
      error: 'The estimated time must be more than 0 hours; leave it blank if you have no estimate.'
    };
  }
  return { value: estimate, error: null };
}
