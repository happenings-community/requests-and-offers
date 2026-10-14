/**
 * Unit tests for messaging-actions — the sequences where the order is the rule.
 */

import { describe, it, expect, vi } from 'vitest';
import { postListingFromConversation } from '$lib/utils/messaging-actions';

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
