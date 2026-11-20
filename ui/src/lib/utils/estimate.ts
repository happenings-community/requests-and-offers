import { isOne } from '$lib/utils/decimal';

/**
 * A listing's time estimate as a member reads it (#380, #525): the decimal as it was
 * written, so 1.1 reads 1.1 hours, never the float a number would round it to. Zero is
 * an estimate too, and reads 0 hours. The request page, its modal and the hREA proposal
 * note all print it through here.
 */
export function estimateLabel(hours: string): string {
  return `${hours} ${isOne(hours) ? 'hour' : 'hours'}`;
}
