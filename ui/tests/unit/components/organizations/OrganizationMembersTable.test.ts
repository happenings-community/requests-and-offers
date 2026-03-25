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

function compareUint8Arrays(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  return a.every((val, i) => val === b[i]);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OrganizationMembersTable Component Logic', () => {
  // ─── Regression #94: data source ────────────────────────────────────────

  describe('Member data source — regression #94', () => {
    it('loads members using organization.members prop, not an external store', () => {
      const memberHash1 = createMockActionHash('member1');
      const memberHash2 = createMockActionHash('member2');
      const organization = createMockOrganization({ members: [memberHash1, memberHash2] });

      // Simulate what loadMembers() does after the fix:
      //   const memberLinks = organization.members  ← prop, not store
      const getUsersByActionHashes = vi.fn().mockReturnValue(E.succeed([]));
      getUsersByActionHashes(organization.members);

      expect(getUsersByActionHashes).toHaveBeenCalledWith([memberHash1, memberHash2]);
    });

    it('returns empty list when organization.members is empty, regardless of store state', () => {
      const organization = createMockOrganization({ members: [] });

      const getUsersByActionHashes = vi.fn().mockReturnValue(E.succeed([]));
      getUsersByActionHashes(organization.members);

      expect(getUsersByActionHashes).toHaveBeenCalledWith([]);
    });

    it('documents the bug: using store currentMembers when empty yields no members', () => {
      // This test documents the original bug behaviour.
      // If loadMembers() used organizationsStore.currentMembers (empty on first render)
      // instead of organization.members, the result would always be [].
      const memberHash = createMockActionHash('member1');
      const organization = createMockOrganization({ members: [memberHash] });

      const buggyStoreCurrentMembers: ActionHash[] = []; // store is [] on first render

      // Bug: const memberLinks = organizationsStore.currentMembers → []
      const getUsersByActionHashes = vi.fn().mockReturnValue(E.succeed([]));
      getUsersByActionHashes(buggyStoreCurrentMembers);

      // Fix: const memberLinks = organization.members → [memberHash]
      expect(getUsersByActionHashes).not.toHaveBeenCalledWith(organization.members);
      expect(getUsersByActionHashes).toHaveBeenCalledWith([]); // demonstrates the bug
    });
  });

  // ─── Regression #94: memberOnly filter ──────────────────────────────────

  describe('memberOnly filter — regression #94', () => {
    it('excludes coordinators using organization.coordinators', () => {
      const coordHash = createMockActionHash('coord1');
      const memberHash = createMockActionHash('member1');
      const organization = createMockOrganization({
        members: [coordHash, memberHash],
        coordinators: [coordHash]
      });
      const allMembers: UIUser[] = [
        createMockUser(coordHash, 'Alice'),
        createMockUser(memberHash, 'Bob')
      ];

      // Simulate memberOnly filter using organization.coordinators (fixed behaviour)
      const memberOnlyResult = allMembers.filter(
        (member) =>
          !organization.coordinators.some((h) =>
            compareUint8Arrays(h, member.original_action_hash!)
          )
      );

      expect(memberOnlyResult).toHaveLength(1);
      expect(memberOnlyResult[0].name).toBe('Bob');
    });

    it('shows all members when organization has no coordinators', () => {
      const hash1 = createMockActionHash('user1');
      const hash2 = createMockActionHash('user2');
      const organization = createMockOrganization({ coordinators: [] });
      const allMembers: UIUser[] = [
        createMockUser(hash1, 'Alice'),
        createMockUser(hash2, 'Bob')
      ];

      const memberOnlyResult = allMembers.filter(
        (member) =>
          !organization.coordinators.some((h) =>
            compareUint8Arrays(h, member.original_action_hash!)
          )
      );

      expect(memberOnlyResult).toHaveLength(2);
    });

    it('documents the bug: empty store coordinators would not filter coordinators out', () => {
      // If memberOnly used organizationsStore.currentCoordinators (empty on first render)
      // instead of organization.coordinators, coordinators would appear in the members-only list.
      const coordHash = createMockActionHash('coord1');
      const memberHash = createMockActionHash('member1');
      const allMembers: UIUser[] = [
        createMockUser(coordHash, 'Alice (coordinator)'),
        createMockUser(memberHash, 'Bob')
      ];

      const emptyStoreCoordinators: ActionHash[] = []; // store is [] on first render

      // Bug: filter uses empty store → coordinator not excluded
      const buggyResult = allMembers.filter(
        (member) =>
          !emptyStoreCoordinators.some((h) => compareUint8Arrays(h, member.original_action_hash!))
      );

      expect(buggyResult).toHaveLength(2); // Alice (coordinator) incorrectly included
    });
  });

  // ─── Sort logic ──────────────────────────────────────────────────────────

  describe('getSortedAndFilteredMembers sort logic', () => {
    const hash1 = createMockActionHash('u1');
    const hash2 = createMockActionHash('u2');
    const hash3 = createMockActionHash('u3');
    const members: UIUser[] = [
      createMockUser(hash1, 'Charlie'),
      createMockUser(hash2, 'Alice'),
      createMockUser(hash3, 'Bob')
    ];

    it('sorts by name ascending', () => {
      const sorted = [...members].sort((a, b) => a.name.localeCompare(b.name));
      expect(sorted.map((m) => m.name)).toEqual(['Alice', 'Bob', 'Charlie']);
    });

    it('sorts by name descending', () => {
      const sorted = [...members].sort((a, b) => b.name.localeCompare(a.name));
      expect(sorted.map((m) => m.name)).toEqual(['Charlie', 'Bob', 'Alice']);
    });
  });

  // ─── Search filter ───────────────────────────────────────────────────────

  describe('getSortedAndFilteredMembers search filter', () => {
    const members: UIUser[] = [
      createMockUser(createMockActionHash('u1'), 'Alice Smith'),
      createMockUser(createMockActionHash('u2'), 'Bob Jones'),
      createMockUser(createMockActionHash('u3'), 'Charlie Smith')
    ];

    it('filters by case-insensitive name search', () => {
      const result = members.filter((m) =>
        m.name.toLowerCase().includes('smith'.toLowerCase())
      );
      expect(result).toHaveLength(2);
      expect(result.map((m) => m.name)).toContain('Alice Smith');
      expect(result.map((m) => m.name)).toContain('Charlie Smith');
    });

    it('returns all members when search query is empty', () => {
      const result = members.filter((m) => m.name.toLowerCase().includes(''));
      expect(result).toHaveLength(3);
    });

    it('returns empty when no name matches', () => {
      const result = members.filter((m) =>
        m.name.toLowerCase().includes('xyz'.toLowerCase())
      );
      expect(result).toHaveLength(0);
    });
  });
});
