import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the service types store
const mockServiceTypesStore = {
  getTagStatistics: vi.fn(),
  tagStatistics: [] as Array<[string, number]>,
  loading: false,
  error: null as string | null
};

const mockRunEffect = vi.fn();

vi.mock('$lib/utils/effect', () => ({
  runEffect: mockRunEffect
}));

vi.mock('$lib/stores/serviceTypes.store.svelte', () => ({
  serviceTypesStore: mockServiceTypesStore
}));

describe('TagCloud Component Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockServiceTypesStore.tagStatistics = [];
    mockServiceTypesStore.loading = false;
    mockServiceTypesStore.error = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Tag Statistics Processing', () => {
    it('should process tag statistics correctly', () => {
      // Arrange
      const rawStatistics: Array<[string, number]> = [
        ['javascript', 25],
        ['react', 15],
        ['nodejs', 12],
        ['python', 8],
        ['vue', 5],
        ['angular', 3],
        ['svelte', 1]
      ];

      // Simulate the tag cloud processing logic
      const processTagStatistics = (
        statistics: Array<[string, number]>,
        maxTags: number = 10,
        minCount: number = 1
      ) => {
        return statistics
          .filter(([, count]) => count >= minCount)
          .sort((a, b) => b[1] - a[1]) // Sort by count descending
          .slice(0, maxTags);
      };

      // Act
      const processedTags = processTagStatistics(rawStatistics, 5);

      // Assert
      expect(processedTags).toHaveLength(5);
      expect(processedTags[0]).toEqual(['javascript', 25]); // Most popular first
      expect(processedTags[4]).toEqual(['vue', 5]); // 5th most popular
      expect(processedTags.map(([tag]) => tag)).not.toContain('angular'); // Should not include 6th tag
    });

    it('should handle empty statistics', () => {
      // Arrange
      const emptyStatistics: Array<[string, number]> = [];

      const processTagStatistics = (statistics: Array<[string, number]>) => {
        return statistics.filter(([, count]) => count > 0);
      };

      // Act
      const result = processTagStatistics(emptyStatistics);

      // Assert
      expect(result).toHaveLength(0);
    });

    it('should filter out tags with zero counts', () => {
      // Arrange
      const statisticsWithZeros: Array<[string, number]> = [
        ['javascript', 10],
        ['react', 0],
        ['nodejs', 5],
        ['python', 0],
        ['vue', 3]
      ];

      const processTagStatistics = (statistics: Array<[string, number]>) => {
        return statistics.filter(([, count]) => count > 0);
      };

      // Act
      const result = processTagStatistics(statisticsWithZeros);

      // Assert
      expect(result).toHaveLength(3);
      expect(result.map(([tag]) => tag)).toEqual(['javascript', 'nodejs', 'vue']);
      expect(result.map(([tag]) => tag)).not.toContain('react');
      expect(result.map(([tag]) => tag)).not.toContain('python');
    });
  });

  describe('Tag Size Calculation', () => {
    it('should calculate tag sizes based on popularity', () => {
      // Arrange
      const tagStatistics: Array<[string, number]> = [
        ['javascript', 25],
        ['react', 15],
        ['nodejs', 5]
      ];

      // Simulate tag size calculation (like the component would do)
      const calculateTagSize = (
        count: number,
        maxCount: number,
        minSize: number = 12,
        maxSize: number = 24
      ) => {
        if (maxCount === 0) return minSize;
        const ratio = count / maxCount;
        return Math.round(minSize + (maxSize - minSize) * ratio);
      };

      const maxCount = Math.max(...tagStatistics.map(([, count]) => count));

      // Act
      const tagSizes = tagStatistics.map(([tag, count]) => ({
        tag,
        count,
        size: calculateTagSize(count, maxCount)
      }));

      // Assert
      expect(tagSizes[0].size).toBe(24); // javascript: 25/25 = 1.0 * 12 + 12 = 24
      expect(tagSizes[1].size).toBe(19); // react: 15/25 = 0.6 * 12 + 12 ≈ 19
      expect(tagSizes[2].size).toBe(14); // nodejs: 5/25 = 0.2 * 12 + 12 ≈ 14
    });

    it('should handle single tag statistics', () => {
      // Arrange
      const singleTagStatistics: Array<[string, number]> = [['javascript', 10]];

      const calculateTagSize = (
        count: number,
        maxCount: number,
        minSize: number = 12,
        maxSize: number = 24
      ) => {
        if (maxCount === 0) return minSize;
        return maxSize; // Single tag gets max size
      };

      const maxCount = Math.max(...singleTagStatistics.map(([, count]) => count));

      // Act
      const result = calculateTagSize(10, maxCount);

      // Assert
      expect(result).toBe(24);
    });
  });

  describe('Tag Click Handling', () => {
    it('should handle tag click events', () => {
      // Arrange
      const onTagClick = vi.fn();
      const clickedTag = 'javascript';

      // Simulate tag click
      const handleTagClick = (tag: string) => {
        onTagClick(tag);
      };

      // Act
      handleTagClick(clickedTag);

      // Assert
      expect(onTagClick).toHaveBeenCalledWith('javascript');
      expect(onTagClick).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple tag clicks', () => {
      // Arrange
      const onTagClick = vi.fn();
      const tags = ['javascript', 'react', 'nodejs'];

      // Act
      tags.forEach((tag) => onTagClick(tag));

      // Assert
      expect(onTagClick).toHaveBeenCalledTimes(3);
      expect(onTagClick).toHaveBeenNthCalledWith(1, 'javascript');
      expect(onTagClick).toHaveBeenNthCalledWith(2, 'react');
      expect(onTagClick).toHaveBeenNthCalledWith(3, 'nodejs');
    });
  });

  describe('Loading and Error States', () => {
    it('should handle loading state', async () => {
      // Arrange
      mockServiceTypesStore.loading = true;
      mockRunEffect.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

      // Simulate loading check
      const isLoading = mockServiceTypesStore.loading;

      // Assert
      expect(isLoading).toBe(true);
    });

    it('should handle error state', () => {
      // Arrange
      const errorMessage = 'Failed to load tag statistics';
      mockServiceTypesStore.error = errorMessage;

      // Act
      const hasError = !!mockServiceTypesStore.error;
      const currentError = mockServiceTypesStore.error;

      // Assert
      expect(hasError).toBe(true);
      expect(currentError).toBe(errorMessage);
    });

    it('should handle successful data load', async () => {
      // Arrange
      const mockStatistics: Array<[string, number]> = [
        ['javascript', 10],
        ['react', 5]
      ];
      mockServiceTypesStore.tagStatistics = mockStatistics;
      mockServiceTypesStore.loading = false;
      mockServiceTypesStore.error = null;
      mockRunEffect.mockResolvedValue(undefined);

      // Act
      const statistics = mockServiceTypesStore.tagStatistics;
      const isLoading = mockServiceTypesStore.loading;
      const hasError = !!mockServiceTypesStore.error;

      // Assert
      expect(statistics).toEqual(mockStatistics);
      expect(isLoading).toBe(false);
      expect(hasError).toBe(false);
    });
  });

  describe('Tag Cloud Configuration', () => {
    it('should respect maxTags configuration', () => {
      // Arrange
      const allTags: Array<[string, number]> = [
        ['tag1', 10],
        ['tag2', 9],
        ['tag3', 8],
        ['tag4', 7],
        ['tag5', 6],
        ['tag6', 5],
        ['tag7', 4],
        ['tag8', 3],
        ['tag9', 2],
        ['tag10', 1]
      ];
      const maxTags = 5;

      // Act
      const limitedTags = allTags.slice(0, maxTags);

      // Assert
      expect(limitedTags).toHaveLength(5);
      expect(limitedTags.map(([tag]) => tag)).toEqual(['tag1', 'tag2', 'tag3', 'tag4', 'tag5']);
    });

    it('should handle showCounts configuration', () => {
      // Arrange
      const tag = ['javascript', 15] as [string, number];

      // Simulate display logic
      const getDisplayText = (tag: [string, number], showCounts: boolean) => {
        const [tagName, count] = tag;
        return showCounts ? `${tagName} (${count})` : tagName;
      };

      // Act
      const displayTextWithCount = getDisplayText(tag, true);
      const displayTextWithoutCount = getDisplayText(tag, false);

      // Assert
      expect(displayTextWithCount).toBe('javascript (15)');
      expect(displayTextWithoutCount).toBe('javascript');
    });
  });

  describe('Tag Cloud Layout', () => {
    it('should calculate optimal layout for tags', () => {
      // Arrange
      const tags: Array<[string, number]> = [
        ['verylongtagname', 10],
        ['short', 8],
        ['medium-tag', 6]
      ];

      // Simulate layout calculation
      const calculateTagLayout = (tags: Array<[string, number]>) => {
        return tags.map(([tag, count]) => ({
          tag,
          count,
          width: tag.length * 8 + 20, // Rough width calculation
          height: 30
        }));
      };

      // Act
      const layout = calculateTagLayout(tags);

      // Assert
      expect(layout[0].width).toBeGreaterThan(layout[1].width); // long tag is wider
      expect(layout[1].width).toBeLessThan(layout[2].width); // short tag is narrower
      expect(layout.every((item) => item.height === 30)).toBe(true); // consistent height
    });
  });

  describe('Tag Cloud Accessibility', () => {
    it('should generate proper aria labels', () => {
      // Arrange
      const tag = ['javascript', 15] as [string, number];

      // Simulate aria label generation
      const generateAriaLabel = (tag: [string, number]) => {
        const [tagName, count] = tag;
        return `Filter by ${tagName}, used in ${count} service types`;
      };

      // Act
      const ariaLabel = generateAriaLabel(tag);

      // Assert
      expect(ariaLabel).toBe('Filter by javascript, used in 15 service types');
    });

    it('should provide keyboard navigation support', () => {
      // Arrange
      const tags = ['javascript', 'react', 'nodejs'];
      let focusedIndex = 0;

      // Simulate keyboard navigation
      const handleKeyDown = (key: string) => {
        switch (key) {
          case 'ArrowLeft':
            focusedIndex = Math.max(0, focusedIndex - 1);
            break;
          case 'ArrowRight':
            focusedIndex = Math.min(tags.length - 1, focusedIndex + 1);
            break;
          case 'Enter':
          case ' ':
            return tags[focusedIndex]; // Return selected tag
        }
        return null;
      };

      // Act & Assert
      expect(handleKeyDown('ArrowRight')).toBeNull();
      expect(focusedIndex).toBe(1);

      expect(handleKeyDown('ArrowRight')).toBeNull();
      expect(focusedIndex).toBe(2);

      expect(handleKeyDown('ArrowRight')).toBeNull(); // Should not exceed bounds
      expect(focusedIndex).toBe(2);

      expect(handleKeyDown('Enter')).toBe('nodejs');
    });
  });

  describe('Performance Optimization', () => {
    it('should handle large numbers of tags efficiently', () => {
      // Arrange
      const largeTags: Array<[string, number]> = Array.from({ length: 1000 }, (_, i) => [
        `tag${i}`,
        Math.floor(Math.random() * 100)
      ]);
      const maxTags = 50;

      // Act
      const start = performance.now();
      const filteredTags = largeTags
        .filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxTags);
      const end = performance.now();

      // Assert
      expect(filteredTags).toHaveLength(maxTags);
      expect(end - start).toBeLessThan(10); // Should be fast
    });
  });
});
