import { describe, expect, it, vi, beforeEach } from 'vitest';

// The one store every component shares, as Skeleton's getToastStore() returns it.
const { store, received } = vi.hoisted(() => {
  const received: Array<{ message: string; action?: { label: string } }> = [];
  const store = {
    trigger: (settings: { message: string; action?: { label: string } }) => {
      received.push(settings);
      return 'id';
    }
  };
  return { store, received };
});

vi.mock('@skeletonlabs/skeleton', () => ({ getToastStore: () => store }));

import { initializeToast, showToast } from '$lib/utils/toast';

const HOSTILE = '<img src=x onerror="alert(1)">';

describe('toasts are escaped before Skeleton renders them as HTML', () => {
  beforeEach(() => {
    received.length = 0;
    initializeToast();
  });

  it('escapes what showToast is given', () => {
    showToast(`Failed: ${HOSTILE}`, 'error');
    expect(received[0].message).not.toContain('<img');
    expect(received[0].message).toContain('&lt;img');
  });

  it("escapes a component's direct trigger on the shared store", () => {
    store.trigger({ message: HOSTILE });
    expect(received[0].message).not.toContain('<img');
  });

  it('escapes an action label', () => {
    showToast('Saved', 'success', 5000, { label: HOSTILE, response: () => {} });
    expect(received[0].action?.label).not.toContain('<img');
  });

  it('escapes once, however many times it is set up', () => {
    initializeToast();
    store.trigger({ message: 'Tom & Jerry' });
    expect(received[0].message).toBe('Tom &amp; Jerry');
  });
});
