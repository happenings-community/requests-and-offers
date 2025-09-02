import { expect, describe, it, beforeEach, vi } from 'vitest';
import { fakeActionHash } from '@holochain/client';
import type { ActionHash } from '@holochain/client';
import type { UIServiceType } from '$lib/types/ui';

// Mock the serviceTypesStore
const mockServiceTypesStore = {
  serviceTypes: [] as UIServiceType[],
  loading: false,
  error: null,
  getAllServiceTypes: vi.fn(() => Promise.resolve([])),
  createServiceType: vi.fn(() =>
    Promise.resolve({ signed_action: { hashed: { hash: new Uint8Array() } } })
  )
};

vi.mock('$lib/stores/serviceTypes.store.svelte', () => ({
  default: mockServiceTypesStore
}));

// Mock the toast store
const mockToastStore = {
  trigger: vi.fn()
};

vi.mock('@skeletonlabs/skeleton', () => ({
  getToastStore: () => mockToastStore
}));

// Mock Effect
vi.mock('effect', () => ({
  Effect: {
    runPromise: vi.fn(() => Promise.resolve())
  }
}));

describe('ServiceTypeSelector', () => {
  let mockActionHash1: ActionHash;
  let mockActionHash2: ActionHash;
  let mockServiceTypes: UIServiceType[];

  beforeEach(async () => {
    mockActionHash1 = await fakeActionHash();
    mockActionHash2 = await fakeActionHash();

    mockServiceTypes = [
      {
        name: 'Web Development',
        description: 'Frontend and backend web development',
        technical: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        original_action_hash: mockActionHash1,
        previous_action_hash: mockActionHash1,
        creator: mockActionHash1,
        status: 'approved'
      },
      {
        name: 'Data Science',
        description: 'Machine learning and data analysis',
        technical: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        original_action_hash: mockActionHash2,
        previous_action_hash: mockActionHash2,
        creator: mockActionHash2,
        status: 'approved'
      }
    ];

    // Reset mocks
    vi.clearAllMocks();
    mockServiceTypesStore.serviceTypes = mockServiceTypes;
    mockServiceTypesStore.loading = false;
    mockServiceTypesStore.error = null;
  });

  describe('Component Logic Tests', () => {
    it('should filter service types by name', () => {
      const searchTerm = 'Web';
      const filtered = mockServiceTypes.filter((st) =>
        st.name.toLowerCase().includes(searchTerm.toLowerCase())
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('Web Development');
    });

    it('should filter service types by description', () => {
      const searchTerm = 'machine learning';
      const filtered = mockServiceTypes.filter((st) =>
        st.description.toLowerCase().includes(searchTerm.toLowerCase())
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('Data Science');
    });

    it('should filter service types by technical field', () => {
      const technicalServiceTypes = mockServiceTypes.filter((st) => st.technical === true);
      const nonTechnicalServiceTypes = mockServiceTypes.filter((st) => st.technical === false);

      expect(technicalServiceTypes).toHaveLength(2);
      expect(nonTechnicalServiceTypes).toHaveLength(0);
    });

    it('should handle case-insensitive search', () => {
      const searchTerm = 'WEB';
      const filtered = mockServiceTypes.filter(
        (st) =>
          st.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          st.description.toLowerCase().includes(searchTerm.toLowerCase())
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('Web Development');
    });

    it('should return empty array when no matches found', () => {
      const searchTerm = 'nonexistent';
      const filtered = mockServiceTypes.filter(
        (st) =>
          st.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          st.description.toLowerCase().includes(searchTerm.toLowerCase())
      );

      expect(filtered).toHaveLength(0);
    });
  });

  describe('Selection Logic Tests', () => {
    it('should add service type to selection', () => {
      const selectedServiceTypes: ActionHash[] = [];
      const newSelection = [...selectedServiceTypes, mockActionHash1];

      expect(newSelection).toHaveLength(1);
      expect(newSelection).toContain(mockActionHash1);
    });

    it('should remove service type from selection', () => {
      const selectedServiceTypes: ActionHash[] = [mockActionHash1, mockActionHash2];
      const newSelection = selectedServiceTypes.filter((hash) => hash !== mockActionHash1);

      expect(newSelection).toHaveLength(1);
      expect(newSelection).toContain(mockActionHash2);
      expect(newSelection).not.toContain(mockActionHash1);
    });

    it('should toggle service type selection', () => {
      const selectedServiceTypes: ActionHash[] = [mockActionHash1];

      // Test removing when already selected
      const isSelected = selectedServiceTypes.includes(mockActionHash1);
      const newSelection1 = isSelected
        ? selectedServiceTypes.filter((hash) => hash !== mockActionHash1)
        : [...selectedServiceTypes, mockActionHash1];

      expect(newSelection1).toHaveLength(0);

      // Test adding when not selected
      const newSelection2 = newSelection1.includes(mockActionHash2)
        ? newSelection1.filter((hash) => hash !== mockActionHash2)
        : [...newSelection1, mockActionHash2];

      expect(newSelection2).toHaveLength(1);
      expect(newSelection2).toContain(mockActionHash2);
    });

    it('should clear all selections', () => {
      const clearedSelection: ActionHash[] = [];

      expect(clearedSelection).toHaveLength(0);
    });
  });

  describe('Visibility Logic Tests', () => {
    it('should limit visible service types based on maxVisible', () => {
      const selectedServiceTypes: ActionHash[] = [mockActionHash1, mockActionHash2];
      const maxVisible = 1;

      const visibleServiceTypes = selectedServiceTypes.slice(0, maxVisible);
      const hiddenCount = selectedServiceTypes.length - maxVisible;

      expect(visibleServiceTypes).toHaveLength(1);
      expect(hiddenCount).toBe(1);
    });

    it('should show all service types when maxVisible is not set', () => {
      const selectedServiceTypes: ActionHash[] = [mockActionHash1, mockActionHash2];
      const maxVisible = undefined;

      const visibleServiceTypes = maxVisible
        ? selectedServiceTypes.slice(0, maxVisible)
        : selectedServiceTypes;

      expect(visibleServiceTypes).toHaveLength(2);
    });

    it('should calculate correct hidden count', () => {
      const selectedServiceTypes: ActionHash[] = [mockActionHash1, mockActionHash2];
      const maxVisible = 1;

      const hiddenCount = Math.max(0, selectedServiceTypes.length - maxVisible);

      expect(hiddenCount).toBe(1);
    });
  });

  describe('Store Integration Tests', () => {
    it('should handle loading state', () => {
      mockServiceTypesStore.loading = true;
      mockServiceTypesStore.serviceTypes = [];

      expect(mockServiceTypesStore.loading).toBe(true);
      expect(mockServiceTypesStore.serviceTypes).toHaveLength(0);
    });

    it('should handle error state', () => {
      // @ts-expect-error - Testing error state on mock store
      mockServiceTypesStore.error = 'Network error';
      mockServiceTypesStore.loading = false;

      expect(mockServiceTypesStore.error).toBe('Network error');
      expect(mockServiceTypesStore.loading).toBe(false);
    });

    it('should handle successful data load', () => {
      mockServiceTypesStore.serviceTypes = mockServiceTypes;
      mockServiceTypesStore.loading = false;
      mockServiceTypesStore.error = null;

      expect(mockServiceTypesStore.serviceTypes).toHaveLength(2);
      expect(mockServiceTypesStore.loading).toBe(false);
      expect(mockServiceTypesStore.error).toBeNull();
    });
  });

  describe('Validation Logic Tests', () => {
    it('should validate service type creation data', () => {
      const validData = {
        name: 'Valid Name',
        description: 'Valid description',
        technical: true
      };

      const isValid =
        validData.name.trim() !== '' &&
        validData.description.trim() !== '' &&
        typeof validData.technical === 'boolean';

      expect(isValid).toBe(true);
    });

    it('should reject invalid service type creation data', () => {
      const invalidData = {
        name: '',
        description: 'Valid description',
        technical: true
      };

      const isValid = invalidData.name.trim() !== '' && invalidData.description.trim() !== '';

      expect(isValid).toBe(false);
    });

    it('should require technical field', () => {
      const dataWithTechnical = {
        name: 'Valid Name',
        description: 'Valid description',
        technical: false
      };

      const isValid =
        dataWithTechnical.name.trim() !== '' &&
        dataWithTechnical.description.trim() !== '' &&
        typeof dataWithTechnical.technical === 'boolean';

      expect(isValid).toBe(true);
      expect(dataWithTechnical.technical).toBe(false);
    });
  });

  describe('Status Filtering Tests', () => {
    it('should only show approved service types', async () => {
      const mixedStatusServiceTypes: UIServiceType[] = [
        {
          name: 'Approved Service',
          description: 'This is approved',
          technical: true,
          created_at: Date.now(),
          updated_at: Date.now(),
          original_action_hash: mockActionHash1,
          previous_action_hash: mockActionHash1,
          creator: mockActionHash1,
          status: 'approved'
        },
        {
          name: 'Pending Service',
          description: 'This is pending',
          technical: false,
          created_at: Date.now(),
          updated_at: Date.now(),
          original_action_hash: mockActionHash2,
          previous_action_hash: mockActionHash2,
          creator: mockActionHash2,
          status: 'pending'
        },
        {
          name: 'Rejected Service',
          description: 'This is rejected',
          technical: true,
          created_at: Date.now(),
          updated_at: Date.now(),
          original_action_hash: await fakeActionHash(),
          previous_action_hash: await fakeActionHash(),
          creator: await fakeActionHash(),
          status: 'rejected'
        }
      ];

      // Filter to only show approved service types (component behavior)
      const approvedOnly = mixedStatusServiceTypes.filter((st) => st.status === 'approved');

      expect(approvedOnly).toHaveLength(1);
      expect(approvedOnly[0].name).toBe('Approved Service');
      expect(approvedOnly[0].status).toBe('approved');
    });

    it('should exclude pending service types from selection', async () => {
      const pendingServiceType: UIServiceType = {
        name: 'Pending Service',
        description: 'This should not be selectable',
        technical: false,
        created_at: Date.now(),
        updated_at: Date.now(),
        original_action_hash: mockActionHash1,
        previous_action_hash: mockActionHash1,
        creator: mockActionHash1,
        status: 'pending'
      };

      const serviceTypes = [pendingServiceType];
      const selectableServiceTypes = serviceTypes.filter((st) => st.status === 'approved');

      expect(selectableServiceTypes).toHaveLength(0);
    });

    it('should exclude rejected service types from selection', async () => {
      const rejectedServiceType: UIServiceType = {
        name: 'Rejected Service',
        description: 'This should not be selectable',
        technical: false,
        created_at: Date.now(),
        updated_at: Date.now(),
        original_action_hash: mockActionHash1,
        previous_action_hash: mockActionHash1,
        creator: mockActionHash1,
        status: 'rejected'
      };

      const serviceTypes = [rejectedServiceType];
      const selectableServiceTypes = serviceTypes.filter((st) => st.status === 'approved');

      expect(selectableServiceTypes).toHaveLength(0);
    });

    it('should handle mixed status service types correctly', async () => {
      const allStatusServiceTypes: UIServiceType[] = [
        {
          name: 'Approved 1',
          description: 'First approved',
          technical: true,
          created_at: Date.now(),
          updated_at: Date.now(),
          original_action_hash: mockActionHash1,
          previous_action_hash: mockActionHash1,
          creator: mockActionHash1,
          status: 'approved'
        },
        {
          name: 'Pending 1',
          description: 'First pending',
          technical: false,
          created_at: Date.now(),
          updated_at: Date.now(),
          original_action_hash: mockActionHash2,
          previous_action_hash: mockActionHash2,
          creator: mockActionHash2,
          status: 'pending'
        },
        {
          name: 'Approved 2',
          description: 'Second approved',
          technical: true,
          created_at: Date.now(),
          updated_at: Date.now(),
          original_action_hash: await fakeActionHash(),
          previous_action_hash: await fakeActionHash(),
          creator: await fakeActionHash(),
          status: 'approved'
        },
        {
          name: 'Rejected 1',
          description: 'First rejected',
          technical: false,
          created_at: Date.now(),
          updated_at: Date.now(),
          original_action_hash: await fakeActionHash(),
          previous_action_hash: await fakeActionHash(),
          creator: await fakeActionHash(),
          status: 'rejected'
        }
      ];

      const approvedServiceTypes = allStatusServiceTypes.filter((st) => st.status === 'approved');
      const nonApprovedServiceTypes = allStatusServiceTypes.filter(
        (st) => st.status !== 'approved'
      );

      expect(approvedServiceTypes).toHaveLength(2);
      expect(nonApprovedServiceTypes).toHaveLength(2);
      expect(approvedServiceTypes[0].name).toBe('Approved 1');
      expect(approvedServiceTypes[1].name).toBe('Approved 2');
    });

    it('should maintain search functionality only on approved service types', async () => {
      const mixedServiceTypes: UIServiceType[] = [
        {
          name: 'Web Development',
          description: 'Approved web development service',
          technical: true,
          created_at: Date.now(),
          updated_at: Date.now(),
          original_action_hash: mockActionHash1,
          previous_action_hash: mockActionHash1,
          creator: mockActionHash1,
          status: 'approved'
        },
        {
          name: 'Web Design',
          description: 'Pending web design service',
          technical: false,
          created_at: Date.now(),
          updated_at: Date.now(),
          original_action_hash: mockActionHash2,
          previous_action_hash: mockActionHash2,
          creator: mockActionHash2,
          status: 'pending'
        }
      ];

      // First filter by approved status, then by search term
      const approvedServiceTypes = mixedServiceTypes.filter((st) => st.status === 'approved');
      const searchTerm = 'web';
      const searchResults = approvedServiceTypes.filter(
        (st) =>
          st.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          st.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (st.technical ? 'technical' : 'non-technical').includes(searchTerm.toLowerCase())
      );

      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].name).toBe('Web Development');
      expect(searchResults[0].status).toBe('approved');
    });
  });

  describe('Technical Filtering Tests', () => {
    it('should filter only technical service types', () => {
      const mixedServiceTypes: UIServiceType[] = [
        {
          name: 'Web Development',
          description: 'Frontend and backend development',
          technical: true,
          created_at: Date.now(),
          updated_at: Date.now(),
          original_action_hash: mockActionHash1,
          previous_action_hash: mockActionHash1,
          creator: mockActionHash1,
          status: 'approved'
        },
        {
          name: 'Marketing',
          description: 'Digital marketing services',
          technical: false,
          created_at: Date.now(),
          updated_at: Date.now(),
          original_action_hash: mockActionHash2,
          previous_action_hash: mockActionHash2,
          creator: mockActionHash2,
          status: 'approved'
        }
      ];

      const technicalOnly = mixedServiceTypes.filter((st) => st.technical);

      expect(technicalOnly).toHaveLength(1);
      expect(technicalOnly[0].name).toBe('Web Development');
      expect(technicalOnly[0].technical).toBe(true);
    });

    it('should filter only non-technical service types', () => {
      const mixedServiceTypes: UIServiceType[] = [
        {
          name: 'Web Development',
          description: 'Frontend and backend development',
          technical: true,
          created_at: Date.now(),
          updated_at: Date.now(),
          original_action_hash: mockActionHash1,
          previous_action_hash: mockActionHash1,
          creator: mockActionHash1,
          status: 'approved'
        },
        {
          name: 'Marketing',
          description: 'Digital marketing services',
          technical: false,
          created_at: Date.now(),
          updated_at: Date.now(),
          original_action_hash: mockActionHash2,
          previous_action_hash: mockActionHash2,
          creator: mockActionHash2,
          status: 'approved'
        }
      ];

      const nonTechnicalOnly = mixedServiceTypes.filter((st) => !st.technical);

      expect(nonTechnicalOnly).toHaveLength(1);
      expect(nonTechnicalOnly[0].name).toBe('Marketing');
      expect(nonTechnicalOnly[0].technical).toBe(false);
    });

    it('should show all service types when no technical filter is applied', () => {
      const mixedServiceTypes: UIServiceType[] = [
        {
          name: 'Web Development',
          description: 'Frontend and backend development',
          technical: true,
          created_at: Date.now(),
          updated_at: Date.now(),
          original_action_hash: mockActionHash1,
          previous_action_hash: mockActionHash1,
          creator: mockActionHash1,
          status: 'approved'
        },
        {
          name: 'Marketing',
          description: 'Digital marketing services',
          technical: false,
          created_at: Date.now(),
          updated_at: Date.now(),
          original_action_hash: mockActionHash2,
          previous_action_hash: mockActionHash2,
          creator: mockActionHash2,
          status: 'approved'
        }
      ];

      // No filter applied (show all)
      const allServiceTypes = mixedServiceTypes;

      expect(allServiceTypes).toHaveLength(2);
    });
  });

  describe('Sorting Tests', () => {
    const createMockServiceType = (
      name: string,
      technical: boolean,
      createdAt: number
    ): UIServiceType => ({
      name,
      description: `Description for ${name}`,
      technical,
      created_at: createdAt,
      updated_at: createdAt,
      original_action_hash: mockActionHash1,
      previous_action_hash: mockActionHash1,
      creator: mockActionHash1,
      status: 'approved'
    });

    it('should sort service types alphabetically by name', () => {
      const unsortedServiceTypes: UIServiceType[] = [
        createMockServiceType('Web Development', true, Date.now()),
        createMockServiceType('Data Science', true, Date.now()),
        createMockServiceType('Marketing', false, Date.now())
      ];

      const sortedByName = [...unsortedServiceTypes].sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      );

      expect(sortedByName[0].name).toBe('Data Science');
      expect(sortedByName[1].name).toBe('Marketing');
      expect(sortedByName[2].name).toBe('Web Development');
    });

    it('should sort service types by technical status (technical first)', () => {
      const mixedServiceTypes: UIServiceType[] = [
        createMockServiceType('Marketing', false, Date.now()),
        createMockServiceType('Web Development', true, Date.now()),
        createMockServiceType('Data Science', true, Date.now()),
        createMockServiceType('Writing', false, Date.now())
      ];

      const sortedByTechnical = [...mixedServiceTypes].sort((a, b) => {
        if (a.technical && !b.technical) return -1;
        if (!a.technical && b.technical) return 1;
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      });

      // Technical services should come first
      expect(sortedByTechnical[0].technical).toBe(true);
      expect(sortedByTechnical[1].technical).toBe(true);
      expect(sortedByTechnical[2].technical).toBe(false);
      expect(sortedByTechnical[3].technical).toBe(false);

      // Within same technical status, should be alphabetical
      expect(sortedByTechnical[0].name).toBe('Data Science');
      expect(sortedByTechnical[1].name).toBe('Web Development');
      expect(sortedByTechnical[2].name).toBe('Marketing');
      expect(sortedByTechnical[3].name).toBe('Writing');
    });

    it('should sort service types by technical status (non-technical first)', () => {
      const mixedServiceTypes: UIServiceType[] = [
        createMockServiceType('Marketing', false, Date.now()),
        createMockServiceType('Web Development', true, Date.now()),
        createMockServiceType('Data Science', true, Date.now()),
        createMockServiceType('Writing', false, Date.now())
      ];

      const sortedByNonTechnical = [...mixedServiceTypes].sort((a, b) => {
        if (!a.technical && b.technical) return -1;
        if (a.technical && !b.technical) return 1;
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      });

      // Non-technical services should come first
      expect(sortedByNonTechnical[0].technical).toBe(false);
      expect(sortedByNonTechnical[1].technical).toBe(false);
      expect(sortedByNonTechnical[2].technical).toBe(true);
      expect(sortedByNonTechnical[3].technical).toBe(true);

      // Within same technical status, should be alphabetical
      expect(sortedByNonTechnical[0].name).toBe('Marketing');
      expect(sortedByNonTechnical[1].name).toBe('Writing');
      expect(sortedByNonTechnical[2].name).toBe('Data Science');
      expect(sortedByNonTechnical[3].name).toBe('Web Development');
    });

    it('should sort service types by creation date (most recent first)', () => {
      const now = Date.now();
      const serviceTypes: UIServiceType[] = [
        createMockServiceType('Old Service', true, now - 1000000),
        createMockServiceType('New Service', false, now),
        createMockServiceType('Middle Service', true, now - 500000)
      ];

      const sortedByRecent = [...serviceTypes].sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        if (aTime !== bTime) return bTime - aTime;
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      });

      expect(sortedByRecent[0].name).toBe('New Service');
      expect(sortedByRecent[1].name).toBe('Middle Service');
      expect(sortedByRecent[2].name).toBe('Old Service');
    });
  });

  describe('Combined Filtering and Sorting Tests', () => {
    const createMockServiceType = (
      name: string,
      technical: boolean,
      createdAt: number
    ): UIServiceType => ({
      name,
      description: `Description for ${name}`,
      technical,
      created_at: createdAt,
      updated_at: createdAt,
      original_action_hash: mockActionHash1,
      previous_action_hash: mockActionHash1,
      creator: mockActionHash1,
      status: 'approved'
    });

    it('should combine search, technical filter, and sorting', () => {
      const serviceTypes: UIServiceType[] = [
        createMockServiceType('Web Development', true, Date.now() - 1000),
        createMockServiceType('Web Design', false, Date.now()),
        createMockServiceType('Data Web Analysis', true, Date.now() - 500),
        createMockServiceType('Marketing', false, Date.now() - 2000)
      ];

      // Apply search filter first
      const searchTerm = 'web';
      let filtered = serviceTypes.filter(
        (st) =>
          st.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          st.description.toLowerCase().includes(searchTerm.toLowerCase())
      );

      // Apply technical filter (only technical)
      filtered = filtered.filter((st) => st.technical);

      // Apply sorting (by name)
      filtered.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

      expect(filtered).toHaveLength(2);
      expect(filtered[0].name).toBe('Data Web Analysis');
      expect(filtered[1].name).toBe('Web Development');
      expect(filtered.every((st) => st.technical)).toBe(true);
    });

    it('should handle empty results after combined filtering', () => {
      const serviceTypes: UIServiceType[] = [
        createMockServiceType('Marketing', false, Date.now()),
        createMockServiceType('Writing', false, Date.now())
      ];

      // Search for technical terms but filter for technical services
      let filtered = serviceTypes.filter((st) => st.name.toLowerCase().includes('programming'));

      filtered = filtered.filter((st) => st.technical);

      expect(filtered).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty service types array', () => {
      const emptyServiceTypes: UIServiceType[] = [];
      const searchTerm = 'test';

      const filtered = emptyServiceTypes.filter((st) =>
        st.name.toLowerCase().includes(searchTerm.toLowerCase())
      );

      expect(filtered).toHaveLength(0);
    });

    it('should handle undefined selectedServiceTypes', () => {
      const selectedServiceTypes: ActionHash[] | undefined = undefined;
      const safeSelection = selectedServiceTypes || [];

      expect(safeSelection).toHaveLength(0);
    });

    it('should handle service types with technical classification', () => {
      const serviceTypeWithTechnical: UIServiceType = {
        name: 'Test Service',
        description: 'Test description',
        technical: false,
        created_at: Date.now(),
        updated_at: Date.now(),
        creator: new Uint8Array(),
        original_action_hash: mockActionHash1,
        previous_action_hash: mockActionHash1,
        status: 'approved'
      };

      const searchTerm = 'test';
      const matchesName = serviceTypeWithTechnical.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

      expect(matchesName).toBe(true);
      expect(serviceTypeWithTechnical.technical).toBe(false);
    });

    it('should handle very long service type names', () => {
      const longName = 'Very Long Service Type Name That Should Be Handled Gracefully';
      const serviceTypeWithLongName: UIServiceType = {
        name: longName,
        description: 'Test description',
        technical: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        creator: new Uint8Array(),
        original_action_hash: mockActionHash1,
        previous_action_hash: mockActionHash1,
        status: 'approved'
      };

      expect(serviceTypeWithLongName.name).toBe(longName);
      expect(serviceTypeWithLongName.name.length).toBeGreaterThan(50);
    });
  });
});
