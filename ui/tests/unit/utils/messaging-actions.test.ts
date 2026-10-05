/**
 * Unit tests for messaging-actions — the sequences where the order is the rule.
 */

import { describe, it, expect, vi } from 'vitest';
import { postListingFromConversation, showInterestAndOpen } from '$lib/utils/messaging-actions';

describe('showInterestAndOpen', () => {
  /**
   * **To make this go red:** call `open()` before `createInterest()`, or move it outside
   * the try so it runs whatever happened. Either flips one of the assertions below.
   */
  it('records the interest first, then opens the conversation', async () => {
    const order: string[] = [];
    const result = await showInterestAndOpen({
      createInterest: async () => {
        order.push('interest');
      },
      open: async () => {
        order.push('open');
      }
    });

    expect(result).toEqual({ ok: true });
    expect(order).toEqual(['interest', 'open']);
  });

  /**
   * The failure that matters: an empty conversation with no card in it, and an author
   * who never learns anyone was interested.
   */
  it('opens nothing when the interest could not be recorded, and says why', async () => {
    const open = vi.fn(async () => {});
    const result = await showInterestAndOpen({
      createInterest: async () => {
        throw new Error('Your member profile is not accepted yet');
      },
      open
    });

    expect(open, 'the conversation must not open').not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toContain('not accepted yet');
  });

  it('survives something thrown that is not an Error', async () => {
    const open = vi.fn(async () => {});
    const result = await showInterestAndOpen({
      createInterest: async () => {
        throw 'a bare string';
      },
      open
    });
    expect(open).not.toHaveBeenCalled();
    expect(result.ok === false && result.reason).toBe('a bare string');
  });
});

describe('postListingFromConversation', () => {
  /**
   * Posting from the picker returns the member to the conversation, with the listing
   * they just published as what it shows.
   *
   * **To make this go red:** call `reload()` before `create()`, or return the posted
   * listing without waiting for the create to resolve. The order assertion fails.
   */
  it('creates the listing, then reloads the conversation, and reports what was posted', async () => {
    const order: string[] = [];
    const result = await postListingFromConversation({
      type: 'Request',
      title: 'Help moving a piano',
      create: async () => {
        order.push('create');
      },
      reload: async () => {
        order.push('reload');
      }
    });

    expect(order).toEqual(['create', 'reload']);
    expect(result).toEqual({
      ok: true,
      posted: { type: 'Request', title: 'Help moving a piano' }
    });
  });

  /**
   * A failed post must keep the member in the form they filled in, not drop them back
   * into the conversation wondering whether their listing exists.
   */
  it('does not reload, and posts nothing, when the listing could not be created', async () => {
    const reload = vi.fn(async () => {});
    const result = await postListingFromConversation({
      type: 'Offer',
      title: 'Bike repairs',
      create: async () => {
        throw new Error('A listing needs at least one service type');
      },
      reload
    });

    expect(reload, 'the conversation must not reload').not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toContain('service type');
  });
});
