/**
 * Exact decimals for exchange quantities.
 *
 * A quantity travels as a decimal string ("12.50", "1.5"), never as a float, so
 * "0.1" plus "0.2" is "0.3" and a currency amount cannot drift. The accepted
 * spelling is the one the exchanges integrity zome validates (`decimal_problem`
 * in `exchanges_integrity`): ASCII digits and at most one dot, up to nine
 * digits before it and six after, no sign, no exponent, no leading zero except
 * "0.x". Trailing zeros are kept as written, so two spellings of one amount
 * exist: compare with `decimalsEqual`, never with `===` on the strings.
 */

export const MAX_INTEGER_DIGITS = 9;
export const MAX_FRACTION_DIGITS = 6;

const DECIMAL = new RegExp(
  `^(0|[1-9][0-9]{0,${MAX_INTEGER_DIGITS - 1}})(\\.[0-9]{1,${MAX_FRACTION_DIGITS}})?$`
);

/** What is wrong with an amount's spelling, in a member's words; null when it is well formed. */
export function decimalProblem(value: string): string | null {
  if (DECIMAL.test(value)) return null;
  return `must be a plain number such as 12.50: digits and at most one dot, no sign, up to ${MAX_INTEGER_DIGITS} digits before the dot and ${MAX_FRACTION_DIGITS} after`;
}

/**
 * Reads what a member typed: blank is nothing, a decimal comma becomes a dot,
 * anything else is handed back as it was for `decimalProblem` to name.
 */
export function parseTypedDecimal(input: string | null | undefined): string | null {
  const typed = (input ?? '').trim();
  if (typed === '') return null;
  return /^[^,]*,[^,]*$/.test(typed) ? typed.replace(',', '.') : typed;
}

/** An amount as a whole number of its smallest step, so arithmetic is integer arithmetic. */
function scaled(value: string, fractionDigits: number): bigint {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole + fraction.padEnd(fractionDigits, '0'));
}

function fractionDigitsOf(...values: string[]): number {
  return Math.max(...values.map((v) => v.split('.')[1]?.length ?? 0));
}

/** Orders two well-formed amounts by value, whatever their trailing zeros. */
export function compareDecimal(a: string, b: string): -1 | 0 | 1 {
  const digits = fractionDigitsOf(a, b);
  const x = scaled(a, digits);
  const y = scaled(b, digits);
  return x < y ? -1 : x > y ? 1 : 0;
}

export function decimalsEqual(a: string, b: string): boolean {
  return compareDecimal(a, b) === 0;
}

export function isZeroDecimal(value: string): boolean {
  return compareDecimal(value, '0') === 0;
}

/** The exact sum of two well-formed amounts, without trailing zeros. */
export function addDecimal(a: string, b: string): string {
  const digits = fractionDigitsOf(a, b);
  const sum = (scaled(a, digits) + scaled(b, digits)).toString().padStart(digits + 1, '0');
  const whole = sum.slice(0, sum.length - digits);
  const fraction = sum.slice(sum.length - digits).replace(/0+$/, '');
  return fraction === '' ? whole : `${whole}.${fraction}`;
}

/** True for "1", "1.0", "1.00": the amounts a label writes in the singular. */
export function isOne(value: string): boolean {
  return decimalProblem(value) === null && decimalsEqual(value, '1');
}
