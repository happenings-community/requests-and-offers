import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/svelte';
import { encodeHashToBase64 } from '@holochain/client';
import FaultRow from '$lib/components/messaging/FaultRow.svelte';

/**
 * A message that would not open, shown as a row a member can report.
 *
 * "Copy details" is for handing to an administrator, so what it copies has to be what an
 * administrator can look up: the hashes as base64, and no message content at all.
 */

const MESSAGE = new Uint8Array([132, 41, 36, ...Array(36).fill(7)]);
const FROM = new Uint8Array([132, 32, 36, ...Array(36).fill(9)]);
const AT = 1_760_000_000_000;
const writeText = vi.fn();

beforeEach(() => {
  cleanup();
  writeText.mockReset();
  writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

describe('a message that would not open', () => {
  it('copies the hashes as an administrator looks them up', async () => {
    render(FaultRow, { props: { fault: { hash: MESSAGE, from: FROM, at: AT }, name: 'Anita' } });
    await fireEvent.click(screen.getByRole('button', { name: /copy/i }));

    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const copied = writeText.mock.calls[0][0] as string;
    expect(copied).toContain(`Message: ${encodeHashToBase64(MESSAGE)}`);
    expect(copied).toContain(`From: ${encodeHashToBase64(FROM)}`);
    expect(copied).toContain(`At: ${new Date(AT).toISOString()}`);
    expect(copied, 'not as a list of bytes').not.toMatch(/\d+,\d+,\d+/);
  });

  it('names who it came from', () => {
    render(FaultRow, { props: { fault: { hash: MESSAGE, from: FROM, at: AT }, name: 'Anita' } });
    expect(screen.getByText(/Anita/)).toBeTruthy();
  });
});
