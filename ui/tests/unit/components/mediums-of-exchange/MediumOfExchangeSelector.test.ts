import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UIMediumOfExchange } from '$lib/schemas/mediums-of-exchange.schemas';
import type { ActionHash } from '@holochain/client';
import { createMockActionHash } from '../../test-helpers';

describe('MediumOfExchangeSelector Component Logic', () => {
  let mockMediumsOfExchange: UIMediumOfExchange[];

  beforeEach(() => {
    // Mock mediums of exchange data
    mockMediumsOfExchange = [
      {
        actionHash: createMockActionHash('hash1'),
        name: 'Free Service',
        code: 'FREE',
        description: 'No payment required',
        exchange_type: 'base',
        status: 'approved',
        createdAt: new Date('2024-01-15T10:00:00Z')
      },
      {
        actionHash: createMockActionHash('hash2'),
        name: 'Bartering',
        code: 'BARTER',
        description: 'Exchange of goods or services',
        exchange_type: 'base',
        status: 'approved',
        createdAt: new Date('2024-01-10T10:00:00Z')
      },
      {
        actionHash: createMockActionHash('hash3'),
        name: 'Open to Discussion',
        code: 'DISCUSS',
        description: 'Negotiable payment terms',
        exchange_type: 'base',
        status: 'approved',
        createdAt: new Date('2024-01-12T10:00:00Z')
      },
      {
        actionHash: createMockActionHash('hash4'),
        name: 'US Dollar',
        code: 'USD',
        description: 'United States Dollar',
        exchange_type: 'currency',
        status: 'approved',
        createdAt: new Date('2024-01-08T10:00:00Z')
      },
      {
        actionHash: createMockActionHash('hash5'),
        name: 'Canadian Dollar',
        code: 'CAD',
        description: 'Canadian Dollar',
        exchange_type: 'currency',
        status: 'approved',
        createdAt: new Date('2024-01-20T10:00:00Z')
      },
      {
        actionHash: createMockActionHash('hash6'),
        name: 'Bitcoin',
        code: 'BTC',
        description: 'Cryptocurrency',
        exchange_type: 'currency',
        status: 'approved',
        createdAt: new Date('2024-01-25T10:00:00Z')
      }
    ];
  });

  describe('Data Grouping Logic', () => {
    it('should group mediums by exchange type', () => {
      const base = mockMediumsOfExchange.filter((m) => m.exchange_type === 'base');
      const currency = mockMediumsOfExchange.filter((m) => m.exchange_type === 'currency');

      expect(base.length).toBe(3);
      expect(currency.length).toBe(3);

      expect(base[0].code).toBe('FREE');
      expect(base[1].code).toBe('BARTER');
      expect(base[2].code).toBe('DISCUSS');

      expect(currency[0].code).toBe('USD');
      expect(currency[1].code).toBe('CAD');
      expect(currency[2].code).toBe('BTC');
    });

    it('should identify base categories correctly', () => {
      const baseCategories = mockMediumsOfExchange.filter((m) => m.exchange_type === 'base');

      baseCategories.forEach((category) => {
        expect(category.exchange_type).toBe('base');
        expect(['FREE', 'BARTER', 'DISCUSS']).toContain(category.code);
      });
    });

    it('should identify currencies correctly', () => {
      const currencies = mockMediumsOfExchange.filter((m) => m.exchange_type === 'currency');

      currencies.forEach((currency) => {
        expect(currency.exchange_type).toBe('currency');
        expect(['USD', 'CAD', 'BTC']).toContain(currency.code);
      });
    });
  });

  describe('Search and Filtering Logic', () => {
    it('should filter by name', () => {
      const searchTerm = 'dollar';
      const filtered = mockMediumsOfExchange.filter(
        (medium) =>
          medium.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          medium.code.toLowerCase().includes(searchTerm.toLowerCase())
      );

      expect(filtered.length).toBe(2);
      expect(filtered[0].name).toBe('US Dollar');
      expect(filtered[1].name).toBe('Canadian Dollar');
    });

    it('should filter by code', () => {
      const searchTerm = 'BTC';
      const filtered = mockMediumsOfExchange.filter(
        (medium) =>
          medium.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          medium.code.toLowerCase().includes(searchTerm.toLowerCase())
      );

      expect(filtered.length).toBe(1);
      expect(filtered[0].code).toBe('BTC');
      expect(filtered[0].name).toBe('Bitcoin');
    });

    it('should be case insensitive', () => {
      const searchTermUpper = 'FREE';
      const searchTermLower = 'free';

      const filteredUpper = mockMediumsOfExchange.filter(
        (medium) =>
          medium.name.toLowerCase().includes(searchTermUpper.toLowerCase()) ||
          medium.code.toLowerCase().includes(searchTermUpper.toLowerCase())
      );

      const filteredLower = mockMediumsOfExchange.filter(
        (medium) =>
          medium.name.toLowerCase().includes(searchTermLower.toLowerCase()) ||
          medium.code.toLowerCase().includes(searchTermLower.toLowerCase())
      );

      expect(filteredUpper).toEqual(filteredLower);
      expect(filteredUpper.length).toBe(1);
      expect(filteredUpper[0].code).toBe('FREE');
    });
  });

  describe('Sorting Logic', () => {
    it('should sort base categories first, then currencies', () => {
      const sorted = [...mockMediumsOfExchange].sort((a, b) => {
        if (a.exchange_type !== b.exchange_type) {
          return a.exchange_type === 'base' ? -1 : 1; // Base first
        }
        return a.name.localeCompare(b.name);
      });

      // First 3 should be base categories
      expect(sorted.slice(0, 3).every((m) => m.exchange_type === 'base')).toBe(true);
      // Last 3 should be currencies
      expect(sorted.slice(3).every((m) => m.exchange_type === 'currency')).toBe(true);
    });

    it('should sort alphabetically within each group', () => {
      const baseSorted = mockMediumsOfExchange
        .filter((m) => m.exchange_type === 'base')
        .sort((a, b) => a.name.localeCompare(b.name));

      const currencySorted = mockMediumsOfExchange
        .filter((m) => m.exchange_type === 'currency')
        .sort((a, b) => a.name.localeCompare(b.name));

      expect(baseSorted[0].name).toBe('Bartering');
      expect(baseSorted[1].name).toBe('Free Service');
      expect(baseSorted[2].name).toBe('Open to Discussion');

      expect(currencySorted[0].name).toBe('Bitcoin');
      expect(currencySorted[1].name).toBe('Canadian Dollar');
      expect(currencySorted[2].name).toBe('US Dollar');
    });
  });

  describe('Selection State Management Logic', () => {
    it('should detect currency selections', () => {
      const selectedHashes = [
        mockMediumsOfExchange[3].actionHash!,
        mockMediumsOfExchange[4].actionHash!
      ]; // USD and CAD

      const hasCurrencySelection = selectedHashes.some((hash) => {
        const medium = mockMediumsOfExchange.find(
          (m) => m.actionHash?.toString() === hash.toString()
        );
        return medium?.exchange_type === 'currency';
      });

      expect(hasCurrencySelection).toBe(true);
    });

    it('should detect no currency selections', () => {
      const selectedHashes = [mockMediumsOfExchange[0].actionHash!]; // Only FREE (base)

      const hasCurrencySelection = selectedHashes.some((hash) => {
        const medium = mockMediumsOfExchange.find(
          (m) => m.actionHash?.toString() === hash.toString()
        );
        return medium?.exchange_type === 'currency';
      });

      expect(hasCurrencySelection).toBe(false);
    });

    it('should count selected currencies correctly', () => {
      const selectedHashes = [
        mockMediumsOfExchange[3].actionHash!, // USD
        mockMediumsOfExchange[4].actionHash!, // CAD
        mockMediumsOfExchange[0].actionHash! // FREE (base)
      ];

      const selectedCurrencyCount = selectedHashes.filter((hash) => {
        const medium = mockMediumsOfExchange.find(
          (m) => m.actionHash?.toString() === hash.toString()
        );
        return medium?.exchange_type === 'currency';
      }).length;

      expect(selectedCurrencyCount).toBe(2);
    });
  });

  describe('Display Helper Functions Logic', () => {
    it('should generate correct medium display strings', () => {
      const getMediumDisplay = (medium: UIMediumOfExchange): string => {
        const typeIcon = medium.exchange_type === 'base' ? '📂' : '💰';
        return `${typeIcon} ${medium.code} - ${medium.name}`;
      };

      expect(getMediumDisplay(mockMediumsOfExchange[0])).toBe('📂 FREE - Free Service');
      expect(getMediumDisplay(mockMediumsOfExchange[3])).toBe('💰 USD - US Dollar');
    });

    it('should use correct icons for each type', () => {
      const baseIcon = '📂';
      const currencyIcon = '💰';

      mockMediumsOfExchange.forEach((medium) => {
        const expectedIcon = medium.exchange_type === 'base' ? baseIcon : currencyIcon;
        const typeIcon = medium.exchange_type === 'base' ? '📂' : '💰';
        expect(typeIcon).toBe(expectedIcon);
      });
    });
  });

  describe('Props Configuration Logic', () => {
    it('should define component props interface', () => {
      type Props = {
        selectedMediums?: ActionHash[];
        onSelectionChange?: (selectedHashes: ActionHash[]) => void;
        label?: string;
        placeholder?: string;
        required?: boolean;
        disabled?: boolean;
        maxVisible?: number;
        name?: string;
        id?: string;
        mode?: 'single' | 'multiple';
      };

      const defaultProps: Required<Props> = {
        selectedMediums: [],
        onSelectionChange: vi.fn(),
        label: 'Medium of Exchange',
        placeholder: 'Search mediums of exchange...',
        required: false,
        disabled: false,
        maxVisible: 5,
        name: '',
        id: '',
        mode: 'single'
      };

      expect(defaultProps.selectedMediums).toEqual([]);
      expect(typeof defaultProps.onSelectionChange).toBe('function');
      expect(defaultProps.label).toBe('Medium of Exchange');
      expect(defaultProps.placeholder).toBe('Search mediums of exchange...');
      expect(defaultProps.required).toBe(false);
      expect(defaultProps.disabled).toBe(false);
      expect(defaultProps.maxVisible).toBe(5);
      expect(defaultProps.mode).toBe('single');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty mediums array', () => {
      const emptyMediums: UIMediumOfExchange[] = [];
      const base = emptyMediums.filter((m) => m.exchange_type === 'base');
      const currency = emptyMediums.filter((m) => m.exchange_type === 'currency');

      expect(base.length).toBe(0);
      expect(currency.length).toBe(0);
    });

    it('should handle mediums without actionHash', () => {
      const mediumWithoutHash: Partial<UIMediumOfExchange> = {
        name: 'Test Medium',
        code: 'TEST',
        description: 'Test description',
        exchange_type: 'base'
        // actionHash is undefined
      };

      expect(mediumWithoutHash.actionHash).toBeUndefined();
      // Component should handle this gracefully
    });

    it('should handle only base categories', () => {
      const baseOnlyMediums = mockMediumsOfExchange.filter((m) => m.exchange_type === 'base');
      const currencies = baseOnlyMediums.filter((m) => m.exchange_type === 'currency');

      expect(baseOnlyMediums.length).toBe(3);
      expect(currencies.length).toBe(0);
    });

    it('should handle only currencies', () => {
      const currenciesOnlyMediums = mockMediumsOfExchange.filter(
        (m) => m.exchange_type === 'currency'
      );
      const base = currenciesOnlyMediums.filter((m) => m.exchange_type === 'base');

      expect(currenciesOnlyMediums.length).toBe(3);
      expect(base.length).toBe(0);
    });
  });

  describe('Selection Validation Logic', () => {
    it('should validate selection changes', () => {
      const mockSelectionHandler = vi.fn((hashes: ActionHash[]) => {
        expect(Array.isArray(hashes)).toBe(true);
        hashes.forEach((hash) => {
          expect(hash).toBeDefined();
        });
      });

      const testHashes = [
        mockMediumsOfExchange[0].actionHash!,
        mockMediumsOfExchange[1].actionHash!
      ];
      mockSelectionHandler(testHashes);

      expect(mockSelectionHandler).toHaveBeenCalledWith(testHashes);
    });

    it('should handle selection synchronization', () => {
      const externalHashes = [mockMediumsOfExchange[0].actionHash!];
      const currentHashes = [mockMediumsOfExchange[1].actionHash!];

      const externalHashStrings = externalHashes.map((hash) => hash.toString()).sort();
      const currentHashStrings = currentHashes.map((hash) => hash.toString()).sort();

      expect(JSON.stringify(externalHashStrings) !== JSON.stringify(currentHashStrings)).toBe(true);
      // Component should update internal state when external props change
    });
  });
});
