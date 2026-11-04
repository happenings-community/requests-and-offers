import { describe, expect, it } from 'vitest';
import { createWriteGuard } from '$lib/utils/store-helpers/write-guard';

describe('createWriteGuard (#359, the Admin badge poll)', () => {
  it('keeps a read when nothing was written while it was on its way', () => {
    const guard = createWriteGuard();
    const keep = guard.begin();
    expect(keep()).toBe(true);
  });

  it('drops a read that started before a write', () => {
    // The poll reads, the administrator suspends a member, the poll answers:
    // its answer has the member still accepted, so it must not be applied.
    const guard = createWriteGuard();
    const keep = guard.begin();
    guard.wrote();
    expect(keep()).toBe(false);
  });

  it('keeps a read that started after the write', () => {
    const guard = createWriteGuard();
    guard.wrote();
    const keep = guard.begin();
    expect(keep()).toBe(true);
  });

  it('judges each read by its own start', () => {
    const guard = createWriteGuard();
    const early = guard.begin();
    guard.wrote();
    const late = guard.begin();
    expect(early()).toBe(false);
    expect(late()).toBe(true);
  });
});
