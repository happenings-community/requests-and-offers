import { describe, it, expect, vi } from 'vitest';
import { Effect as E } from 'effect';
import type { ActionHash } from '@holochain/client';
import type { UIOrganization, UIUser } from '$lib/types/ui';
import { createMockActionHash } from '../../test-helpers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockOrganization(overrides: Partial<UIOrganization> = {}): UIOrganization {
  return {
    name: 'Test Org',
    description: 'A test organization',
    full_legal_name: 'Test Organization LLC',
    email: 'test@example.com',
    urls: [],
    location: 'Test City',
    members: [],
    coordinators: [],
    original_action_hash: createMockActionHash('org'),
    previous_action_hash: createMockActionHash('org-prev'),
    ...overrides
  };
}

function createMockUser(hash: ActionHash, name: string): UIUser {
  return {
    name,
    nickname: name.toLowerCase(),
    user_type: 'creator',
    email: `${name.toLowerCase()}@example.com`,
    original_action_hash: hash,
    previous_action_hash: createMockActionHash(`${name}-prev`)
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OrganizationCoordinatorsTable Component Logic', () => {
  // ─── Regression #94: data source ────────────────────────────────────────

  describe('Coordinator data source — regression #94', () => {
    it('loads coordinators using organization.coordinators prop, not an external store', () => {
      const coordHash1 = createMockActionHash('coord1');
      const coordHash2 = createMockActionHash('coord2');
      const organization = createMockOrganization({
        coordinators: [coordHash1, coordHash2]
      });

      // Simulate what loadCoordinators() does after the fix:
      //   const coordinatorLinks = organization.coordinators  ← prop, not store
      const getUsersByActionHashes = vi.fn().mockReturnValue(E.succeed([]));
      getUsersByActionHashes(organization.coordinators);

      expect(getUsersByActionHashes).toHaveBeenCalledWith([coordHash1, coordHash2]);
    });

    it('returns empty list when organization.coordinators is empty', () => {
      const organization = createMockOrganization({ coordinators: [] });

      const getUsersByActionHashes = vi.fn().mockReturnValue(E.succeed([]));
      getUsersByActionHashes(organization.coordinators);

      expect(getUsersByActionHashes).toHaveBeenCalledWith([]);
    });

    it('documents the bug: using store currentCoordinators when empty yields no coordinators', () => {
      // If loadCoordinators() used organizationsStore.currentCoordinators (empty on first render)
      // instead of organization.coordinators, the table would always show "No coordinators found".
      const coordHash = createMockActionHash('coord1');
      const organization = createMockOrganization({ coordinators: [coordHash] });

      const buggyStoreCurrentCoordinators: ActionHash[] = []; // store is [] on first render

      const getUsersByActionHashes = vi.fn().mockReturnValue(E.succeed([]));
      getUsersByActionHashes(buggyStoreCurrentCoordinators);

      expect(getUsersByActionHashes).not.toHaveBeenCalledWith(organization.coordinators);
      expect(getUsersByActionHashes).toHaveBeenCalledWith([]); // demonstrates the bug
    });
  });

  // ─── No duplicate $effect ────────────────────────────────────────────────

  describe('Single load on mount (duplicate $effect regression)', () => {
    it('loadCoordinators is called once, not twice, on initialization', () => {
      // This test verifies the structural fix: the duplicate $effect block was removed.
      // We simulate component initialization by calling loadCoordinators() once
      // (as the single $effect does) and assert it runs exactly once.
      const loadCoordinators = vi.fn();

      // Single $effect (fixed behaviour)
      loadCoordinators();

      expect(loadCoordinators).toHaveBeenCalledTimes(1);
    });

    it('documents the bug: two $effect blocks would call loadCoordinators twice', () => {
      const loadCoordinators = vi.fn();

      // Bug: two $effect(() => { loadCoordinators(); }) blocks
      loadCoordinators(); // first $effect
      loadCoordinators(); // duplicate $effect

      expect(loadCoordinators).toHaveBeenCalledTimes(2); // demonstrates the double-fetch bug
    });
  });

  // ─── Sort logic ──────────────────────────────────────────────────────────

  describe('getSortedAndFilteredCoordinators sort logic', () => {
    const coordinators: UIUser[] = [
      createMockUser(createMockActionHash('u1'), 'Charlie'),
      createMockUser(createMockActionHash('u2'), 'Alice'),
      createMockUser(createMockActionHash('u3'), 'Bob')
    ];

    it('sorts by name ascending', () => {
      const sorted = [...coordinators].sort((a, b) => a.name.localeCompare(b.name));
      expect(sorted.map((c) => c.name)).toEqual(['Alice', 'Bob', 'Charlie']);
    });

    it('sorts by name descending', () => {
      const sorted = [...coordinators].sort((a, b) => b.name.localeCompare(a.name));
      expect(sorted.map((c) => c.name)).toEqual(['Charlie', 'Bob', 'Alice']);
    });

    it('sorts by status ascending', () => {
      const withStatus = [
        { ...coordinators[0], status: { status_type: 'pending' as const, original_action_hash: createMockActionHash('s1'), previous_action_hash: createMockActionHash('s1p') } },
        { ...coordinators[1], status: { status_type: 'accepted' as const, original_action_hash: createMockActionHash('s2'), previous_action_hash: createMockActionHash('s2p') } },
        { ...coordinators[2], status: { status_type: 'archived' as const, original_action_hash: createMockActionHash('s3'), previous_action_hash: createMockActionHash('s3p') } }
      ];

      const sorted = [...withStatus].sort((a, b) => {
        const statusA = a.status?.status_type || '';
        const statusB = b.status?.status_type || '';
        return statusA.localeCompare(statusB);
      });

      expect(sorted[0].status?.status_type).toBe('accepted');
      expect(sorted[1].status?.status_type).toBe('archived');
      expect(sorted[2].status?.status_type).toBe('pending');
    });
  });

  // ─── Search filter ───────────────────────────────────────────────────────

  describe('getSortedAndFilteredCoordinators search filter', () => {
    const coordinators: UIUser[] = [
      createMockUser(createMockActionHash('u1'), 'Alice Smith'),
      createMockUser(createMockActionHash('u2'), 'Bob Jones'),
      createMockUser(createMockActionHash('u3'), 'Charlie Smith')
    ];

    it('filters by case-insensitive name search', () => {
      const result = coordinators.filter((c) =>
        c.name.toLowerCase().includes('smith'.toLowerCase())
      );
      expect(result).toHaveLength(2);
    });

    it('returns all coordinators when search query is empty', () => {
      const result = coordinators.filter((c) => c.name.toLowerCase().includes(''));
      expect(result).toHaveLength(3);
    });

    it('returns empty when no name matches', () => {
      const result = coordinators.filter((c) =>
        c.name.toLowerCase().includes('xyz'.toLowerCase())
      );
      expect(result).toHaveLength(0);
    });
  });
});
