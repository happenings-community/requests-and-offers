import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import FirstContactLink from '$lib/components/messaging/FirstContactLink.svelte';
import { goto } from '../../../mocks/app-navigation';

/**
 * **Said once, before the first time, and never again.**
 *
 * A member is told what a proposal or a message puts on the network before they write
 * one, and can stop. Afterwards it would be news rather than a choice, and every time
 * afterwards it would be noise, so the link behaves like a link from then on.
 */

const trigger = vi.fn();
const noticeSeen = vi.fn();
const markNoticeSeen = vi.fn();

vi.mock('@skeletonlabs/skeleton', () => ({
  getModalStore: () => ({ trigger: (...a: unknown[]) => trigger(...a), close: vi.fn() })
}));

vi.mock('$lib/stores/messaging.store.svelte', () => ({
  default: {
    noticeSeen: () => noticeSeen(),
    markNoticeSeen: () => markNoticeSeen()
  }
}));

const HREF = '/exchanges/propose?listing=abc';

const press = (link: Element) => {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true });
  link.dispatchEvent(event);
  return event;
};

/** Whatever the notice was opened with, so its answer can be given. */
const answer = (said: boolean) => {
  const settings = trigger.mock.calls[0][0] as { response: (go: boolean) => void };
  settings.response(said);
};

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  noticeSeen.mockReturnValue(false);
});

const mount = () =>
  render(FirstContactLink, {
    props: { kind: 'proposal', href: HREF, label: 'Make a proposal', name: 'Anita' }
  });

describe('the link that says a word first', () => {
  it('holds the first press and says it, taking the member nowhere yet', async () => {
    mount();
    const event = press(await screen.findByTestId('first-contact-link'));

    expect(event.defaultPrevented, 'the press is held').toBe(true);
    expect(trigger).toHaveBeenCalledTimes(1);
    expect(goto, 'nothing moves until they answer').not.toHaveBeenCalled();
  });

  it('carries on where they asked to, and remembers that they were told', async () => {
    mount();
    press(await screen.findByTestId('first-contact-link'));
    answer(true);

    expect(markNoticeSeen).toHaveBeenCalledTimes(1);
    expect(goto).toHaveBeenCalledWith(HREF);
  });

  /**
   * Somebody who reads it and stops has not acted on anything, so they are owed it again.
   */
  it('goes nowhere and remembers nothing when they say not now', async () => {
    mount();
    press(await screen.findByTestId('first-contact-link'));
    answer(false);

    expect(goto).not.toHaveBeenCalled();
    expect(markNoticeSeen).not.toHaveBeenCalled();
  });

  /**
   * **To make this go red:** drop the check on whether they have been told. The notice
   * holds every press from then on, which is the noise that teaches people to dismiss it
   * without reading.
   */
  it('is an ordinary link once they have been told', async () => {
    noticeSeen.mockReturnValue(true);
    mount();
    const event = press(await screen.findByTestId('first-contact-link'));

    expect(trigger, 'nothing left to say').not.toHaveBeenCalled();
    expect(event.defaultPrevented, 'so the link is just a link').toBe(false);
    // jsdom prints "Not implemented: navigation" for this one press, because nothing
    // stops it. That line in the log is the assertion above, working.
  });
});
