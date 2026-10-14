import { describe, it, expect, beforeEach } from 'vitest';
import { fakeActionHash } from '@holochain/client';
import type { ActionHash } from '@holochain/client';
import type { UIServiceType } from '$lib/types/ui';
import { useServiceTypeSearch } from '$lib/composables/search/useServiceTypeSearch.svelte';

describe('useServiceTypeSearch with Sorting', () => {
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

  describe('Search with Sorting Enabled', () => {
    it('should integrate sorting with search/filter functionality', () => {
      const search = useServiceTypeSearch({
        enableSorting: true,
        initialSortField: 'type',
        initialSortDirection: 'asc'
      });

      expect(search.sorting).toBeDefined();
      expect(search.sorting?.sortState.field).toBe('type');
      expect(search.sorting?.sortState.direction).toBe('asc');
    });

    it('should apply sorting to filtered results', () => {
      const search = useServiceTypeSearch({
        enableSorting: true,
        initialSortField: 'type',
        initialSortDirection: 'asc'
      });

      const filtered = search.filterServiceTypes(mockServiceTypes);

      // Should be sorted by type (non-technical first)
      expect(filtered[0].name).toBe('Accounting'); // Non-technical first
      expect(filtered[0].technical).toBe(false);
      expect(filtered[1].name).toBe('Data Science'); // Technical, alphabetically first
      expect(filtered[1].technical).toBe(true);
      expect(filtered[2].name).toBe('Web Development'); // Technical, alphabetically second
      expect(filtered[2].technical).toBe(true);
    });

    it('should apply both filtering and sorting', () => {
      const search = useServiceTypeSearch({
        enableSorting: true,
        initialSortField: 'name',
        initialSortDirection: 'asc'
      });

      // Filter to only technical services
      search.updateTechnicalFilter('technical');

      const filtered = search.filterServiceTypes(mockServiceTypes);

      // Should only include technical services, sorted by name
      expect(filtered).toHaveLength(2);
      expect(filtered[0].name).toBe('Data Science'); // Alphabetically first
      expect(filtered[0].technical).toBe(true);
      expect(filtered[1].name).toBe('Web Development'); // Alphabetically second
      expect(filtered[1].technical).toBe(true);
    });

    it('should apply search term filtering with sorting', () => {
      const search = useServiceTypeSearch({
        enableSorting: true,
        initialSortField: 'name',
        initialSortDirection: 'desc'
      });

      // Search for services containing "development"
      search.updateSearchTerm('development');

      const filtered = search.filterServiceTypes(mockServiceTypes);

      // Should only include services with "development" in name or description
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('Web Development');
    });
  });

  describe('Search without Sorting', () => {
    it('should work without sorting enabled', () => {
      const search = useServiceTypeSearch({
        enableSorting: false
      });

      expect(search.sorting).toBeUndefined();

      const filtered = search.filterServiceTypes(mockServiceTypes);

      // Should maintain original order when no sorting
      expect(filtered).toHaveLength(3);
      expect(filtered[0].name).toBe('Web Development'); // Original order
      expect(filtered[1].name).toBe('Accounting');
      expect(filtered[2].name).toBe('Data Science');
    });
  });

  describe('Sorting Integration', () => {
    it('should allow changing sort field and direction', () => {
      const search = useServiceTypeSearch({
        enableSorting: true,
        initialSortField: 'type',
        initialSortDirection: 'asc'
      });

      expect(search.sorting?.sortState.field).toBe('type');
      expect(search.sorting?.sortState.direction).toBe('asc');

      // Change to sort by name
      search.sorting?.updateSort('name', 'desc');

      expect(search.sorting?.sortState.field).toBe('name');
      expect(search.sorting?.sortState.direction).toBe('desc');

      const filtered = search.filterServiceTypes(mockServiceTypes);

      // Should be sorted by name descending
      expect(filtered[0].name).toBe('Web Development');
      expect(filtered[1].name).toBe('Data Science');
      expect(filtered[2].name).toBe('Accounting');
    });

    it('should support toggling sort direction', () => {
      const search = useServiceTypeSearch({
        enableSorting: true,
        initialSortField: 'name',
        initialSortDirection: 'asc'
      });

      let filtered = search.filterServiceTypes(mockServiceTypes);

      // Initial ascending order
      expect(filtered[0].name).toBe('Accounting');
      expect(filtered[1].name).toBe('Data Science');
      expect(filtered[2].name).toBe('Web Development');

      // Toggle to descending
      search.sorting?.toggleSort('name');

      filtered = search.filterServiceTypes(mockServiceTypes);

      // Should now be descending order
      expect(filtered[0].name).toBe('Web Development');
      expect(filtered[1].name).toBe('Data Science');
      expect(filtered[2].name).toBe('Accounting');
    });
  });
});
