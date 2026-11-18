import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import NavBar from '$lib/components/shared/NavBar.svelte';

/**
 * **Each nav bar's network details have a name of their own.** Skeleton's popup finds its
 * panel once, by name, anywhere in the page, and the app has two nav bars (the admin pages
 * draw their own). With one shared name a bar could bind to the other bar's panel, which
 * then went away, and its status dot opened nothing until the bar was drawn again.
 *
 * The panel is the real one here, so its `data-popup` is what the popup would look up.
 */

const { targets } = vi.hoisted(() => ({ targets: [] as string[] }));

vi.mock('@skeletonlabs/skeleton', () => ({
  getDrawerStore: () => ({ open: vi.fn(), close: vi.fn() }),
  // Records the name each status dot will look its panel up by.
  popup: (_node: HTMLElement, settings: { target: string }) => {
    targets.push(settings.target);
    return { destroy: vi.fn() };
  }
}));
vi.mock('$lib/context/connection-status.context.svelte', () => ({
  getConnectionStatusContext: () => undefined
}));
vi.mock('$lib/services/messagingPresence.svelte', () => ({ default: { isAbsent: true } }));
vi.mock('$lib/extensions/unread-count', async (importActual) => ({
  ...(await importActual<typeof import('$lib/extensions/unread-count')>()),
  getUnreadCount: () => () => undefined
}));
vi.mock('$lib/stores/users.store.svelte', () => ({ default: { currentUser: null } }));
vi.mock('$lib/stores/administration.store.svelte', () => ({
  default: { agentIsAdministrator: false }
}));
vi.mock('$lib/stores/exchanges.store.svelte', () => ({
  default: { exchanges: [], refreshMyExchanges: () => ({}) }
}));
vi.mock('$lib/utils/effect', () => ({ runEffect: () => Promise.resolve() }));

afterEach(() => {
  cleanup();
  targets.length = 0;
});

describe("the status dot's network details", () => {
  it('gives each nav bar on the page its own panel, and each dot finds only its own', () => {
    // Two bars on the page at once, as when the app moves into or out of the admin pages.
    render(NavBar);
    render(NavBar);

    expect(targets).toHaveLength(2);
    expect(new Set(targets).size, 'the two dots look for different names').toBe(2);
    for (const target of targets) {
      expect(document.querySelectorAll(`[data-popup="${target}"]`)).toHaveLength(1);
    }
  });
});
