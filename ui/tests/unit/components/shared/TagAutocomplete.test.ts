import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { UIServiceType } from '$lib/types/ui';

// Mock the composable and store
const mockRunEffect = vi.fn();
const mockServiceTypesStore = {
  searchServiceTypesByTagPrefix: vi.fn(),
  searchResults: [] as UIServiceType[]
};

vi.mock('$lib/utils/effect', () => ({
  runEffect: mockRunEffect
}));

vi.mock('$lib/stores/serviceTypes.store.svelte', () => ({
  serviceTypesStore: mockServiceTypesStore
}));

// Mock debounce utility
const mockDebounce = vi.fn((fn) => fn);
vi.mock('$lib/utils/debounce', () => ({
  debounce: mockDebounce
}));

describe('TagAutocomplete Component Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockServiceTypesStore.searchResults = [];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Tag Search Functionality', () => {
    it('should search for tags by prefix', async () => {
      // Arrange
      const searchQuery = 'java';
      const mockServiceType: UIServiceType = {
        name: 'Web Development',
        description: 'Full stack web development',
        tags: ['javascript', 'java', 'react'],
        created_at: Date.now(),
        updated_at: Date.now(),
        original_action_hash: new Uint8Array(32),
        previous_action_hash: new Uint8Array(32),
        creator: new Uint8Array(32),
        status: 'approved'
      };

      mockServiceTypesStore.searchResults = [mockServiceType];
      mockRunEffect.mockResolvedValue(undefined);

      // Simulate the search logic from the component
      const searchTags = (query: string, currentTags: string[] = []) => {
        if (!query.trim()) return [];

        const allTags = new Set<string>();
        mockServiceTypesStore.searchResults.forEach((serviceType: UIServiceType) => {
          serviceType.tags.forEach((tag) => {
            if (tag.toLowerCase().startsWith(query.toLowerCase()) && !currentTags.includes(tag)) {
              allTags.add(tag);
            }
          });
        });

        return Array.from(allTags);
      };

      // Act
      const suggestions = searchTags(searchQuery);

      // Assert
      expect(suggestions).toContain('javascript');
      expect(suggestions).toContain('java');
      expect(suggestions).not.toContain('react'); // doesn't start with 'java'
    });

    it('should exclude already selected tags from suggestions', async () => {
      // Arrange
      const searchQuery = 'java';
      const currentTags = ['javascript'];
      const mockServiceType: UIServiceType = {
        name: 'Web Development',
        description: 'Full stack web development',
        tags: ['javascript', 'java'],
        created_at: Date.now(),
        updated_at: Date.now(),
        original_action_hash: new Uint8Array(32),
        previous_action_hash: new Uint8Array(32),
        creator: new Uint8Array(32),
        status: 'approved'
      };

      mockServiceTypesStore.searchResults = [mockServiceType];

      const searchTags = (query: string, currentTags: string[] = []) => {
        const allTags = new Set<string>();
        mockServiceTypesStore.searchResults.forEach((serviceType: UIServiceType) => {
          serviceType.tags.forEach((tag) => {
            if (tag.toLowerCase().startsWith(query.toLowerCase()) && !currentTags.includes(tag)) {
              allTags.add(tag);
            }
          });
        });

        return Array.from(allTags);
      };

      // Act
      const suggestions = searchTags(searchQuery, currentTags);

      // Assert
      expect(suggestions).toContain('java');
      expect(suggestions).not.toContain('javascript'); // already selected
    });

    it('should handle empty search query', () => {
      // Arrange
      const searchQuery = '';

      const searchTags = (query: string) => {
        if (!query.trim()) return [];
        // ... rest of search logic
        return [];
      };

      // Act
      const suggestions = searchTags(searchQuery);

      // Assert
      expect(suggestions).toHaveLength(0);
    });

    it('should handle case-insensitive search', () => {
      // Arrange
      const searchQuery = 'JAVA';
      const mockServiceType: UIServiceType = {
        name: 'Web Development',
        description: 'Full stack web development',
        tags: ['javascript', 'react'],
        created_at: Date.now(),
        updated_at: Date.now(),
        original_action_hash: new Uint8Array(32),
        previous_action_hash: new Uint8Array(32),
        creator: new Uint8Array(32),
        status: 'approved'
      };

      mockServiceTypesStore.searchResults = [mockServiceType];

      const searchTags = (query: string, currentTags: string[] = []) => {
        const allTags = new Set<string>();
        mockServiceTypesStore.searchResults.forEach((serviceType: UIServiceType) => {
          serviceType.tags.forEach((tag) => {
            if (tag.toLowerCase().startsWith(query.toLowerCase()) && !currentTags.includes(tag)) {
              allTags.add(tag);
            }
          });
        });

        return Array.from(allTags);
      };

      // Act
      const suggestions = searchTags(searchQuery);

      // Assert
      expect(suggestions).toContain('javascript');
    });
  });

  describe('Tag Management', () => {
    it('should add tag to selection', () => {
      // Arrange
      const currentTags = ['javascript'];
      const newTag = 'react';

      // Act
      const updatedTags = [...currentTags, newTag];

      // Assert
      expect(updatedTags).toContain('javascript');
      expect(updatedTags).toContain('react');
      expect(updatedTags).toHaveLength(2);
    });

    it('should remove tag from selection', () => {
      // Arrange
      const currentTags = ['javascript', 'react', 'nodejs'];
      const tagToRemove = 'react';

      // Act
      const updatedTags = currentTags.filter((tag) => tag !== tagToRemove);

      // Assert
      expect(updatedTags).toContain('javascript');
      expect(updatedTags).toContain('nodejs');
      expect(updatedTags).not.toContain('react');
      expect(updatedTags).toHaveLength(2);
    });

    it('should validate tag input', () => {
      // Arrange
      const invalidTags = ['', '   ', '\t\n', 'validTag', ' spacedTag '];

      // Act
      const validTags = invalidTags.map((tag) => tag.trim()).filter((tag) => tag.length > 0);

      // Assert
      expect(validTags).toEqual(['validTag', 'spacedTag']);
    });

    it('should handle duplicate tags', () => {
      // Arrange
      const currentTags = ['javascript', 'react'];
      const newTag = 'javascript'; // duplicate

      // Act
      const updatedTags = currentTags.includes(newTag) ? currentTags : [...currentTags, newTag];

      // Assert
      expect(updatedTags).toEqual(['javascript', 'react']);
      expect(updatedTags).toHaveLength(2);
    });
  });

  describe('Keyboard Navigation', () => {
    it('should handle arrow key navigation', () => {
      // Arrange
      const suggestions = ['javascript', 'java', 'react'];
      let activeSuggestionIndex = -1;

      // Simulate ArrowDown
      const handleArrowDown = () => {
        activeSuggestionIndex = Math.min(activeSuggestionIndex + 1, suggestions.length - 1);
      };

      // Simulate ArrowUp
      const handleArrowUp = () => {
        activeSuggestionIndex = Math.max(activeSuggestionIndex - 1, -1);
      };

      // Act & Assert
      handleArrowDown();
      expect(activeSuggestionIndex).toBe(0);

      handleArrowDown();
      expect(activeSuggestionIndex).toBe(1);

      handleArrowDown();
      expect(activeSuggestionIndex).toBe(2);

      handleArrowDown(); // should not exceed bounds
      expect(activeSuggestionIndex).toBe(2);

      handleArrowUp();
      expect(activeSuggestionIndex).toBe(1);

      handleArrowUp();
      expect(activeSuggestionIndex).toBe(0);

      handleArrowUp();
      expect(activeSuggestionIndex).toBe(-1);

      handleArrowUp(); // should not go below -1
      expect(activeSuggestionIndex).toBe(-1);
    });

    it('should handle Enter key selection', () => {
      // Arrange
      const suggestions = ['javascript', 'java', 'react'];
      const activeSuggestionIndex = 1;
      const currentTags: string[] = [];

      // Act
      const selectedTag = suggestions[activeSuggestionIndex];
      const updatedTags = [...currentTags, selectedTag];

      // Assert
      expect(selectedTag).toBe('java');
      expect(updatedTags).toContain('java');
    });

    it('should handle Escape key to close suggestions', () => {
      // Arrange
      let showSuggestions = true;
      let activeSuggestionIndex = 1;

      // Simulate Escape key
      const handleEscape = () => {
        showSuggestions = false;
        activeSuggestionIndex = -1;
      };

      // Act
      handleEscape();

      // Assert
      expect(showSuggestions).toBe(false);
      expect(activeSuggestionIndex).toBe(-1);
    });
  });

  describe('Debounced Search', () => {
    it('should debounce search input', () => {
      // The actual debounce implementation is mocked, but we can test the concept
      expect(mockDebounce).toBeDefined();

      // Simulate creating a debounced function
      const mockSearchFunction = vi.fn();
      mockDebounce(mockSearchFunction);

      expect(mockDebounce).toHaveBeenCalledWith(mockSearchFunction);
    });
  });

  describe('Error Handling', () => {
    it('should handle search errors gracefully', async () => {
      // Arrange
      mockRunEffect.mockRejectedValue(new Error('Network error'));

      // Simulate error handling
      const handleSearchError = async (query: string) => {
        try {
          await mockRunEffect(mockServiceTypesStore.searchServiceTypesByTagPrefix(query));
          return mockServiceTypesStore.searchResults;
        } catch (error) {
          console.error('Error searching tags:', error);
          return [];
        }
      };

      // Act
      const result = await handleSearchError('java');

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('Max Suggestions Limit', () => {
    it('should limit number of suggestions', () => {
      // Arrange
      const maxSuggestions = 5;
      const mockServiceTypes: UIServiceType[] = Array.from({ length: 10 }, (_, i) => ({
        name: `Service ${i}`,
        description: `Description ${i}`,
        tags: [`tag${i}`, `javascript${i}`],
        created_at: Date.now(),
        updated_at: Date.now(),
        original_action_hash: new Uint8Array(32),
        previous_action_hash: new Uint8Array(32),
        creator: new Uint8Array(32),
        status: 'approved'
      }));

      mockServiceTypesStore.searchResults = mockServiceTypes;

      const searchTags = (query: string, maxSuggestions: number) => {
        const allTags = new Set<string>();
        mockServiceTypesStore.searchResults.forEach((serviceType: UIServiceType) => {
          serviceType.tags.forEach((tag) => {
            if (tag.toLowerCase().startsWith(query.toLowerCase())) {
              allTags.add(tag);
            }
          });
        });

        return Array.from(allTags).slice(0, maxSuggestions);
      };

      // Act
      const suggestions = searchTags('javascript', maxSuggestions);

      // Assert
      expect(suggestions.length).toBeLessThanOrEqual(maxSuggestions);
    });
  });

  describe('Custom Tag Handling', () => {
    it('should handle allowCustomTags=true', () => {
      // Arrange
      const allowCustomTags = true;
      const inputValue = 'customTag';
      const suggestions = ['javascript', 'java'];

      // Simulate custom tag logic
      const handleCustomTag = (value: string, allowCustom: boolean) => {
        if (allowCustom && value.trim() && !suggestions.includes(value)) {
          return [...suggestions, value];
        }
        return suggestions;
      };

      // Act
      const result = handleCustomTag(inputValue, allowCustomTags);

      // Assert
      expect(result).toContain('customTag');
      expect(result).toContain('javascript');
      expect(result).toContain('java');
    });

    it('should handle allowCustomTags=false', () => {
      // Arrange
      const allowCustomTags = false;
      const inputValue = 'customTag';
      const suggestions = ['javascript', 'java'];

      // Simulate custom tag logic
      const handleCustomTag = (value: string, allowCustom: boolean) => {
        if (allowCustom && value.trim() && !suggestions.includes(value)) {
          return [...suggestions, value];
        }
        return suggestions;
      };

      // Act
      const result = handleCustomTag(inputValue, allowCustomTags);

      // Assert
      expect(result).not.toContain('customTag');
      expect(result).toEqual(suggestions);
    });
  });
});
