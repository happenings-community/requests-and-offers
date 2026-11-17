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
 *
 * A comma is not read as a decimal comma when it is followed by exactly three
 * digits (unless the number starts "0,", which no thousands figure does), or
 * when the number also has a dot: "1,000" is a thousand in an
 * English hand and one in a French one, and read as 1.000 it would send an
 * amount a thousand times too small; "12,500.50" has a thousands comma. Such
 * input is handed back, so it is refused (`typedDecimalProblem` says how to
 * write it) and the member types it again.
 */
export function parseTypedDecimal(input: string | null | undefined): string | null {
  const typed = (input ?? '').trim();
  if (typed === '') return null;
  const decimalComma =
    /^[^,.]*,[^,.]*$/.test(typed) && (!/,[0-9]{3}$/.test(typed) || /^0,/.test(typed));
  return decimalComma ? typed.replace(',', '.') : typed;
}

/**
 * What is wrong with what a member typed, once read by `parseTypedDecimal`, in
 * their words; null when it is a good amount. A number written with thousands
 * commas is told how to write it, when that way is itself a good amount;
 * anything else gets `decimalProblem`.
 */
export function typedDecimalProblem(typed: string): string | null {
  if (decimalProblem(typed) === null) return null;
  const plain = typed.replace(/,/g, '');
  if (/^[1-9][0-9]{0,2}(,[0-9]{3})+(\.[0-9]+)?$/.test(typed) && decimalProblem(plain) === null) {
    return `must be written without the comma, as ${plain}`;
  }
  return decimalProblem(typed);
}

/**
 * A number from elsewhere (a listing's `time_estimate_hours`) as a quantity's
 * decimal string, or null when no quantity can carry it. `String(n)` is not
 * safe: 0.1 + 0.2 gives "0.30000000000000004" and 1e21 gives "1e+21", which the
 * zome refuses. The listing stores hours as an f32, which holds about seven
 * significant digits, and the client reads its exact value (33.29999923706055
 * for 33.3), so a number an f32 can hold is first spelled with the fewest
 * significant digits that give back the same f32: "33.3" for 33.3, every digit
 * of 999999.75. Then rounded to the six places a quantity allows, trailing
 * zeros dropped; zero, negative, non-finite and over-long values give null.
 */
export function decimalFromNumber(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  const value = Math.fround(n) === n ? shortestF32(n) : n;
  const fixed = value.toFixed(MAX_FRACTION_DIGITS);
  const spelled = fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed;
  return decimalProblem(spelled) === null && !isZeroDecimal(spelled) ? spelled : null;
}

/** The fewest significant digits (nine always suffice) that read back as the f32 `n`. */
function shortestF32(n: number): number {
  for (let digits = 1; digits < 9; digits++) {
    const spelled = Number(n.toPrecision(digits));
    if (Math.fround(spelled) === n) return spelled;
  }
  return Number(n.toPrecision(9));
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
