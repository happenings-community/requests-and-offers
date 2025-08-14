import { describe, it, expect, beforeEach } from 'vitest';
import { fakeActionHash } from '@holochain/client';
import type { ActionHash } from '@holochain/client';
import type { UIServiceType } from '$lib/types/ui';
import { useServiceTypeSorting } from '$lib/composables/search/useServiceTypeSorting.svelte';

describe('useServiceTypeSorting', () => {
  let mockServiceTypes: UIServiceType[];
  let mockActionHash1: ActionHash;
  let mockActionHash2: ActionHash;
  let mockActionHash3: ActionHash;

  beforeEach(async () => {
    mockActionHash1 = await fakeActionHash();
    mockActionHash2 = await fakeActionHash();
    mockActionHash3 = await fakeActionHash();

    mockServiceTypes = [
      {
        name: 'Web Development',
        description: 'Frontend and backend web development',
        technical: true,
        created_at: Date.now() - 1000,
        updated_at: Date.now() - 500,
        original_action_hash: mockActionHash1,
        previous_action_hash: mockActionHash1,
        creator: mockActionHash1,
        status: 'approved'
      },
      {
        name: 'Accounting',
        description: 'Financial accounting services',
        technical: false,
        created_at: Date.now() - 2000,
        updated_at: Date.now() - 1000,
        original_action_hash: mockActionHash2,
        previous_action_hash: mockActionHash2,
        creator: mockActionHash2,
        status: 'approved'
      },
      {
        name: 'Data Science',
        description: 'Machine learning and data analysis',
        technical: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        original_action_hash: mockActionHash3,
        previous_action_hash: mockActionHash3,
        creator: mockActionHash3,
        status: 'approved'
      }
    ];
  });

  describe('Default Sorting (Type - Non-technical first)', () => {
    it('should sort by type with non-technical first by default', () => {
      const sorting = useServiceTypeSorting();
      const sorted = sorting.sortServiceTypes(mockServiceTypes);

      // Should be: Accounting (non-technical), then Data Science and Web Development (technical, sorted by name)
      expect(sorted[0].name).toBe('Accounting'); // Non-technical first
      expect(sorted[0].technical).toBe(false);
      expect(sorted[1].name).toBe('Data Science'); // Technical, alphabetically first
      expect(sorted[1].technical).toBe(true);
      expect(sorted[2].name).toBe('Web Development'); // Technical, alphabetically second
      expect(sorted[2].technical).toBe(true);
    });

    it('should have correct initial sort state', () => {
      const sorting = useServiceTypeSorting();
      
      expect(sorting.sortState.field).toBe('type');
      expect(sorting.sortState.direction).toBe('asc');
    });
  });

  describe('Sort by Name', () => {
    it('should sort by name alphabetically', () => {
      const sorting = useServiceTypeSorting('name', 'asc');
      const sorted = sorting.sortServiceTypes(mockServiceTypes);

      expect(sorted[0].name).toBe('Accounting');
      expect(sorted[1].name).toBe('Data Science');
      expect(sorted[2].name).toBe('Web Development');
    });

    it('should sort by name in reverse alphabetical order', () => {
      const sorting = useServiceTypeSorting('name', 'desc');
      const sorted = sorting.sortServiceTypes(mockServiceTypes);

      expect(sorted[0].name).toBe('Web Development');
      expect(sorted[1].name).toBe('Data Science');
      expect(sorted[2].name).toBe('Accounting');
    });
  });

  describe('Sort by Date', () => {
    it('should sort by created_at ascending (oldest first)', () => {
      const sorting = useServiceTypeSorting('created_at', 'asc');
      const sorted = sorting.sortServiceTypes(mockServiceTypes);

      // Oldest to newest: Accounting (-2000), Web Development (-1000), Data Science (0)
      expect(sorted[0].name).toBe('Accounting');
      expect(sorted[1].name).toBe('Web Development');
      expect(sorted[2].name).toBe('Data Science');
    });

    it('should sort by created_at descending (newest first)', () => {
      const sorting = useServiceTypeSorting('created_at', 'desc');
      const sorted = sorting.sortServiceTypes(mockServiceTypes);

      // Newest to oldest: Data Science (0), Web Development (-1000), Accounting (-2000)
      expect(sorted[0].name).toBe('Data Science');
      expect(sorted[1].name).toBe('Web Development');
      expect(sorted[2].name).toBe('Accounting');
    });
  });

  describe('Toggle Sorting', () => {
    it('should toggle direction for same field', () => {
      const sorting = useServiceTypeSorting('name', 'asc');
      
      expect(sorting.sortState.direction).toBe('asc');
      
      sorting.toggleSort('name');
      expect(sorting.sortState.direction).toBe('desc');
      
      sorting.toggleSort('name');
      expect(sorting.sortState.direction).toBe('asc');
    });

    it('should change field and set appropriate default direction', () => {
      const sorting = useServiceTypeSorting('name', 'asc');
      
      // Switch to type field
      sorting.toggleSort('type');
      expect(sorting.sortState.field).toBe('type');
      expect(sorting.sortState.direction).toBe('asc'); // type defaults to asc
      
      // Switch to created_at field
      sorting.toggleSort('created_at');
      expect(sorting.sortState.field).toBe('created_at');
      expect(sorting.sortState.direction).toBe('desc'); // dates default to desc
    });
  });

  describe('Sort Utilities', () => {
    it('should correctly identify sorted field', () => {
      const sorting = useServiceTypeSorting('type', 'asc');
      
      expect(sorting.isSortedBy('type')).toBe(true);
      expect(sorting.isSortedBy('name')).toBe(false);
      expect(sorting.isSortedBy('created_at')).toBe(false);
    });

    it('should return correct sort icons', () => {
      const sorting = useServiceTypeSorting('type', 'asc');
      
      expect(sorting.getSortIcon('type')).toBe('↑'); // Current field, asc
      expect(sorting.getSortIcon('name')).toBe('↕️'); // Not current field
      
      sorting.toggleSort('type'); // Change to desc
      expect(sorting.getSortIcon('type')).toBe('↓'); // Current field, desc
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty array', () => {
      const sorting = useServiceTypeSorting();
      const sorted = sorting.sortServiceTypes([]);
      
      expect(sorted).toEqual([]);
    });

    it('should handle missing date fields gracefully', () => {
      const serviceTypesWithMissingDates: UIServiceType[] = [
        {
          name: 'Test Service 1',
          description: 'Test',
          technical: true,
          created_at: undefined,
          updated_at: undefined,
          original_action_hash: mockActionHash1,
          previous_action_hash: mockActionHash1,
          creator: mockActionHash1,
          status: 'approved'
        },
        {
          name: 'Test Service 2',
          description: 'Test',
          technical: false,
          created_at: Date.now(),
          updated_at: Date.now(),
          original_action_hash: mockActionHash2,
          previous_action_hash: mockActionHash2,
          creator: mockActionHash2,
          status: 'approved'
        }
      ];

      const sorting = useServiceTypeSorting('created_at', 'asc');
      const sorted = sorting.sortServiceTypes(serviceTypesWithMissingDates);
      
      // Should handle gracefully without throwing errors
      expect(sorted).toHaveLength(2);
    });
  });
});