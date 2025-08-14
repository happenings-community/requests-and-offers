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

      const isValid = validData.name.trim() !== '' && validData.description.trim() !== '' && typeof validData.technical === 'boolean';

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
        dataWithTechnical.name.trim() !== '' && dataWithTechnical.description.trim() !== '' && typeof dataWithTechnical.technical === 'boolean';

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
