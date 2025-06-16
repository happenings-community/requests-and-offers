import { expect, describe, it, beforeEach, vi } from 'vitest';
import { Effect as E, Layer } from 'effect';
import type { Record } from '@holochain/client';
import { createMockRecord } from '../test-helpers';

// Import services
import { RequestsServiceLive, RequestsServiceTag } from '$lib/services/zomes/requests.service';
import { OffersServiceLive, OffersServiceTag } from '$lib/services/zomes/offers.service';
import { HolochainClientServiceTag } from '$lib/services/HolochainClientService.svelte';

// Mock the HolochainClientService
const createMockHolochainClientService = () => ({
  appId: 'test-app',
  client: null,
  isConnected: true,
  connectClient: vi.fn(),
  getAppInfo: vi.fn(),
  callZome: vi.fn()
});

describe('Tag-based Discovery Services', () => {
  let mockHolochainClient: ReturnType<typeof createMockHolochainClientService>;
  let mockRecord: Record;

  beforeEach(async () => {
    mockHolochainClient = createMockHolochainClientService();
    mockRecord = await createMockRecord();
  });

  const createTestLayer = () => Layer.succeed(HolochainClientServiceTag, mockHolochainClient);

  describe('RequestsService - getRequestsByTag', () => {
    const runRequestsServiceEffect = <T, E>(effect: E.Effect<T, E, RequestsServiceTag>) =>
      E.runPromise(effect.pipe(E.provide(RequestsServiceLive), E.provide(createTestLayer())));

    it('should get requests by tag successfully', async () => {
      // Arrange
      const tag = 'javascript';
      const mockRequests = [mockRecord, mockRecord];
      mockHolochainClient.callZome.mockResolvedValue(mockRequests);

      // Act
      const result = await runRequestsServiceEffect(
        E.gen(function* () {
          const service = yield* RequestsServiceTag;
          return yield* service.getRequestsByTag(tag);
        })
      );

      // Assert
      expect(mockHolochainClient.callZome).toHaveBeenCalledWith(
        'requests',
        'get_requests_by_tag',
        tag
      );
      expect(result).toEqual(mockRequests);
    });

    it('should return empty array when no requests found for tag', async () => {
      // Arrange
      const tag = 'nonexistent';
      mockHolochainClient.callZome.mockResolvedValue([]);

      // Act
      const result = await runRequestsServiceEffect(
        E.gen(function* () {
          const service = yield* RequestsServiceTag;
          return yield* service.getRequestsByTag(tag);
        })
      );

      // Assert
      expect(mockHolochainClient.callZome).toHaveBeenCalledWith(
        'requests',
        'get_requests_by_tag',
        tag
      );
      expect(result).toEqual([]);
    });

    it('should handle errors when getting requests by tag', async () => {
      // Arrange
      const tag = 'javascript';
      const errorMessage = 'Network error';
      mockHolochainClient.callZome.mockRejectedValue(new Error(errorMessage));

      // Act & Assert
      await expect(
        runRequestsServiceEffect(
          E.gen(function* () {
            const service = yield* RequestsServiceTag;
            return yield* service.getRequestsByTag(tag);
          })
        )
      ).rejects.toThrow('Failed to get requests by tag');
    });

    it('should handle empty string tag', async () => {
      // Arrange
      const tag = '';
      mockHolochainClient.callZome.mockResolvedValue([]);

      // Act
      const result = await runRequestsServiceEffect(
        E.gen(function* () {
          const service = yield* RequestsServiceTag;
          return yield* service.getRequestsByTag(tag);
        })
      );

      // Assert
      expect(mockHolochainClient.callZome).toHaveBeenCalledWith(
        'requests',
        'get_requests_by_tag',
        tag
      );
      expect(result).toEqual([]);
    });

    it('should handle special characters in tag', async () => {
      // Arrange
      const tag = 'C++';
      const mockRequests = [mockRecord];
      mockHolochainClient.callZome.mockResolvedValue(mockRequests);

      // Act
      const result = await runRequestsServiceEffect(
        E.gen(function* () {
          const service = yield* RequestsServiceTag;
          return yield* service.getRequestsByTag(tag);
        })
      );

      // Assert
      expect(mockHolochainClient.callZome).toHaveBeenCalledWith(
        'requests',
        'get_requests_by_tag',
        tag
      );
      expect(result).toEqual(mockRequests);
    });

    it('should handle case-sensitive tags', async () => {
      // Arrange
      const tag = 'JavaScript';
      mockHolochainClient.callZome.mockResolvedValue([]);

      // Act
      const result = await runRequestsServiceEffect(
        E.gen(function* () {
          const service = yield* RequestsServiceTag;
          return yield* service.getRequestsByTag(tag);
        })
      );

      // Assert
      expect(mockHolochainClient.callZome).toHaveBeenCalledWith(
        'requests',
        'get_requests_by_tag',
        tag
      );
      expect(result).toEqual([]);
    });
  });

  describe('OffersService - getOffersByTag', () => {
    const runOffersServiceEffect = <T, E>(effect: E.Effect<T, E, OffersServiceTag>) =>
      E.runPromise(effect.pipe(E.provide(OffersServiceLive), E.provide(createTestLayer())));

    it('should get offers by tag successfully', async () => {
      // Arrange
      const tag = 'design';
      const mockOffers = [mockRecord, mockRecord, mockRecord];
      mockHolochainClient.callZome.mockResolvedValue(mockOffers);

      // Act
      const result = await runOffersServiceEffect(
        E.gen(function* () {
          const service = yield* OffersServiceTag;
          return yield* service.getOffersByTag(tag);
        })
      );

      // Assert
      expect(mockHolochainClient.callZome).toHaveBeenCalledWith('offers', 'get_offers_by_tag', tag);
      expect(result).toEqual(mockOffers);
    });

    it('should return empty array when no offers found for tag', async () => {
      // Arrange
      const tag = 'rare-skill';
      mockHolochainClient.callZome.mockResolvedValue([]);

      // Act
      const result = await runOffersServiceEffect(
        E.gen(function* () {
          const service = yield* OffersServiceTag;
          return yield* service.getOffersByTag(tag);
        })
      );

      // Assert
      expect(mockHolochainClient.callZome).toHaveBeenCalledWith('offers', 'get_offers_by_tag', tag);
      expect(result).toEqual([]);
    });

    it('should handle errors when getting offers by tag', async () => {
      // Arrange
      const tag = 'design';
      const errorMessage = 'Service unavailable';
      mockHolochainClient.callZome.mockRejectedValue(new Error(errorMessage));

      // Act & Assert
      await expect(
        runOffersServiceEffect(
          E.gen(function* () {
            const service = yield* OffersServiceTag;
            return yield* service.getOffersByTag(tag);
          })
        )
      ).rejects.toThrow('Failed to get offers by tag');
    });

    it('should handle multiple tags with same results', async () => {
      // Arrange
      const tag1 = 'javascript';
      const tag2 = 'javascript';
      const mockOffers = [mockRecord];
      mockHolochainClient.callZome.mockResolvedValue(mockOffers);

      // Act
      const result1 = await runOffersServiceEffect(
        E.gen(function* () {
          const service = yield* OffersServiceTag;
          return yield* service.getOffersByTag(tag1);
        })
      );

      const result2 = await runOffersServiceEffect(
        E.gen(function* () {
          const service = yield* OffersServiceTag;
          return yield* service.getOffersByTag(tag2);
        })
      );

      // Assert
      expect(result1).toEqual(result2);
      expect(mockHolochainClient.callZome).toHaveBeenCalledTimes(2);
    });

    it('should handle long tag names', async () => {
      // Arrange
      const longTag = 'a'.repeat(500);
      mockHolochainClient.callZome.mockResolvedValue([]);

      // Act
      const result = await runOffersServiceEffect(
        E.gen(function* () {
          const service = yield* OffersServiceTag;
          return yield* service.getOffersByTag(longTag);
        })
      );

      // Assert
      expect(mockHolochainClient.callZome).toHaveBeenCalledWith(
        'offers',
        'get_offers_by_tag',
        longTag
      );
      expect(result).toEqual([]);
    });

    it('should handle unicode characters in tags', async () => {
      // Arrange
      const unicodeTag = '前端开发';
      const mockOffers = [mockRecord];
      mockHolochainClient.callZome.mockResolvedValue(mockOffers);

      // Act
      const result = await runOffersServiceEffect(
        E.gen(function* () {
          const service = yield* OffersServiceTag;
          return yield* service.getOffersByTag(unicodeTag);
        })
      );

      // Assert
      expect(mockHolochainClient.callZome).toHaveBeenCalledWith(
        'offers',
        'get_offers_by_tag',
        unicodeTag
      );
      expect(result).toEqual(mockOffers);
    });
  });

  describe('Cross-service tag consistency', () => {
    const runRequestsServiceEffect = <T, E>(effect: E.Effect<T, E, RequestsServiceTag>) =>
      E.runPromise(effect.pipe(E.provide(RequestsServiceLive), E.provide(createTestLayer())));

    const runOffersServiceEffect = <T, E>(effect: E.Effect<T, E, OffersServiceTag>) =>
      E.runPromise(effect.pipe(E.provide(OffersServiceLive), E.provide(createTestLayer())));

    it('should handle same tag across both services', async () => {
      // Arrange
      const tag = 'react';
      const mockRequests = [mockRecord, mockRecord];
      const mockOffers = [mockRecord];

      // Act
      const requestsResult = await runRequestsServiceEffect(
        E.gen(function* () {
          const service = yield* RequestsServiceTag;
          mockHolochainClient.callZome.mockResolvedValue(mockRequests);
          return yield* service.getRequestsByTag(tag);
        })
      );

      const offersResult = await runOffersServiceEffect(
        E.gen(function* () {
          const service = yield* OffersServiceTag;
          mockHolochainClient.callZome.mockResolvedValue(mockOffers);
          return yield* service.getOffersByTag(tag);
        })
      );

      // Assert
      expect(requestsResult).toEqual(mockRequests);
      expect(offersResult).toEqual(mockOffers);
    });

    it('should handle different results for same tag', async () => {
      // Arrange
      const tag = 'design';
      const mockRequests: Record[] = [];
      const mockOffers = [mockRecord, mockRecord];

      // Act
      const requestsResult = await runRequestsServiceEffect(
        E.gen(function* () {
          const service = yield* RequestsServiceTag;
          mockHolochainClient.callZome.mockResolvedValue(mockRequests);
          return yield* service.getRequestsByTag(tag);
        })
      );

      const offersResult = await runOffersServiceEffect(
        E.gen(function* () {
          const service = yield* OffersServiceTag;
          mockHolochainClient.callZome.mockResolvedValue(mockOffers);
          return yield* service.getOffersByTag(tag);
        })
      );

      // Assert
      expect(requestsResult).toEqual([]);
      expect(offersResult).toEqual(mockOffers);
    });
  });

  describe('Performance and edge cases', () => {
    const runRequestsServiceEffect = <T, E>(effect: E.Effect<T, E, RequestsServiceTag>) =>
      E.runPromise(effect.pipe(E.provide(RequestsServiceLive), E.provide(createTestLayer())));

    it('should handle very large result sets', async () => {
      // Arrange
      const tag = 'popular-tag';
      const largeResultSet = Array(1000).fill(mockRecord);
      mockHolochainClient.callZome.mockResolvedValue(largeResultSet);

      // Act
      const result = await runRequestsServiceEffect(
        E.gen(function* () {
          const service = yield* RequestsServiceTag;
          return yield* service.getRequestsByTag(tag);
        })
      );

      // Assert
      expect(result).toHaveLength(1000);
      expect(mockHolochainClient.callZome).toHaveBeenCalledWith(
        'requests',
        'get_requests_by_tag',
        tag
      );
    });

    it('should handle null/undefined responses gracefully', async () => {
      // Arrange
      const tag = 'javascript';
      mockHolochainClient.callZome.mockResolvedValue(null);

      // Act
      const result = await runRequestsServiceEffect(
        E.gen(function* () {
          const service = yield* RequestsServiceTag;
          return yield* service.getRequestsByTag(tag);
        })
      );

      // Assert
      expect(result).toBe(null);
    });

    it('should handle timeout errors', async () => {
      // Arrange
      const tag = 'javascript';
      mockHolochainClient.callZome.mockRejectedValue(new Error('TIMEOUT'));

      // Act & Assert
      await expect(
        runRequestsServiceEffect(
          E.gen(function* () {
            const service = yield* RequestsServiceTag;
            return yield* service.getRequestsByTag(tag);
          })
        )
      ).rejects.toThrow('Failed to get requests by tag');
    });
  });
});
