import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * **"Not loaded" must never read as "none".**
 *
 * A listing's services and mediums are separate records fetched after the listing, so an
 * empty array means "not yet" as often as it means "none". The propose page believed the
 * empty case: it showed "this listing names no service", and "no medium of exchange, so
 * this is a gift", while the records were still in flight. Pressing Send at that moment
 * would have proposed a gift for something that wanted paying.
 *
 * **This reads the component source, which is weaker than mounting it.** The project has
 * no component-mounting setup, and the alternative was to leave the rule unguarded, so
 * this asserts the one thing that actually went wrong: each of those two messages sits
 * behind `termsLoad === 'ready'`, and so does Send. The rendered behaviour is in the
 * hand test.
 */
const SOURCE = 'src/routes/(public)/exchanges/propose/+page.svelte';
const source = readFileSync(SOURCE, 'utf8');

/** The `{#if ...}` or `{:else if ...}` condition the given text sits under. */
function guardAbove(text: string): string {
  const at = source.indexOf(text);
  expect(at, `"${text.slice(0, 40)}" is in ${SOURCE}`).toBeGreaterThan(-1);
  const conditions = [...source.slice(0, at).matchAll(/\{[:#]?(?:else )?if ([^}]+)\}/g)];
  return conditions[conditions.length - 1]?.[1] ?? '';
}

describe('the propose page tells loading apart from empty', () => {
  /**
   * **To make this go red:** drop the `termsLoad === 'ready'` guard from the gift
   * message. It shows again while the mediums are loading, which is the state in which
   * Send would have turned a swap into a gift.
   */
  it('the gift message waits until the mediums are known', () => {
    expect(guardAbove('so this is a gift: nothing is expected in')).toContain(
      "termsLoad === 'ready'"
    );
  });

  it('the no-service message waits too', () => {
    expect(guardAbove('This listing names no service')).toContain("termsLoad === 'ready'");
  });

  it('Send is refused until the terms have been read', () => {
    const from = source.slice(source.indexOf('const canSubmit'));
    expect(from.slice(0, from.indexOf(');'))).toContain("termsLoad === 'ready'");
  });

  /**
   * A hash the listing names but that will not resolve is a failure, not a shorter list.
   * `filter(Boolean)` over the lookups hid that, so a partial failure proposed against
   * terms that were not all there.
   */
  it('a term that will not resolve marks the read as failed', () => {
    expect(source).toContain('const everyTermRead =');
    expect(source).toMatch(/termsLoad = everyTermRead \? 'ready' : 'failed'/);
  });

  it('the failure says so and offers a retry, never the empty-case wording', () => {
    const from = source.slice(source.indexOf("{#if termsLoad === 'failed'}"));
    const block = from.slice(0, from.indexOf('{/if}'));
    expect(block).toContain('S.form.termsFailed');
    expect(block).toContain('S.form.termsRetry');
    expect(block).not.toContain('gift');
  });
});
