import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import ReachPerson from '$lib/components/exchanges/ReachPerson.svelte';

/**
 * **A read that did not answer is a fault, and a fault has to be recoverable.**
 *
 * With no conversation to offer, this component falls back to the person's contact
 * details, which it has to read. If that read fails it says so rather than reporting
 * somebody as unreachable, and offers to try again — and trying again has to actually read
 * again, which is the part that was broken: the effect that reads tracked only who to
 * reach, so clearing the message left it nothing to notice and the area went blank.
 *
 * This mounts the component, which nothing in this project had done before. The two stubs
 * below are the whole of the setup: a modal store, because the pop-up is opened through
 * one, and a user read we can make fail on demand.
 */

const getUserByActionHash = vi.fn();

vi.mock('@skeletonlabs/skeleton', () => ({
  getModalStore: () => ({ trigger: vi.fn() })
}));

vi.mock('$lib/stores/users.store.svelte', () => ({
  default: {
    getUserByActionHash: (hash: unknown) => getUserByActionHash(hash)
  }
}));

/** The real one runs an Effect; these stubs hand back promises, so this is identity. */
vi.mock('$lib/utils/effect', () => ({
  runEffect: <T>(value: T) => value
}));

const PERSON = new Uint8Array(Array(39).fill(7));
const REACHABLE = { name: 'Anita Rossi', email: 'anita@example.org' };

beforeEach(() => {
  cleanup();
  getUserByActionHash.mockReset();
});

describe('reaching someone when there is no conversation to offer', () => {
  it('shows the contact button once their details are read', async () => {
    getUserByActionHash.mockResolvedValue(REACHABLE);
    render(ReachPerson, { props: { person: PERSON } });

    expect(await screen.findByTestId('contact-person')).toBeTruthy();
  });

  it('says so, rather than reporting them unreachable, when the read fails', async () => {
    getUserByActionHash.mockRejectedValue(new Error('conductor unavailable'));
    render(ReachPerson, { props: { person: PERSON } });

    const said = await screen.findByRole('alert');
    expect(said.textContent).toContain('conductor unavailable');
    expect(screen.queryByTestId('contact-unavailable'), 'which is a different thing').toBeNull();
  });

  /**
   * **The one that was broken.** Pressing Try again cleared the message and nothing read
   * again, so the member was left with a blank space and no way forward but a reload.
   *
   * **To make this go red:** stop the button changing something the read tracks, by
   * dropping the attempt counter it bumps. The second read never happens and the contact
   * button never appears.
   */
  it('reads again when Try again is pressed, and shows what it found', async () => {
    getUserByActionHash
      .mockRejectedValueOnce(new Error('conductor unavailable'))
      .mockResolvedValueOnce(REACHABLE);

    render(ReachPerson, { props: { person: PERSON } });

    const retry = await screen.findByTestId('contact-retry');
    expect(getUserByActionHash).toHaveBeenCalledTimes(1);

    retry.click();

    expect(await screen.findByTestId('contact-person')).toBeTruthy();
    expect(getUserByActionHash, 'the button has to cause a second read').toHaveBeenCalledTimes(2);
  });

  it('and the button says what it does, for anyone not seeing the arrow', async () => {
    getUserByActionHash.mockRejectedValue(new Error('conductor unavailable'));
    render(ReachPerson, { props: { person: PERSON } });

    const retry = await screen.findByTestId('contact-retry');
    expect(retry.getAttribute('aria-label')).toBe('Try again');
    expect(retry.getAttribute('title')).toBe('Try again');
  });

  it('reads nothing at all when there is nobody to reach', () => {
    render(ReachPerson, { props: { person: undefined } });
    expect(getUserByActionHash).not.toHaveBeenCalled();
  });
});
