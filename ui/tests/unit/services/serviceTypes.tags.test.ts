import { expect, describe, it, beforeEach, vi } from 'vitest';
import { Effect as E, Layer } from 'effect';
import type { Record } from '@holochain/client';
import { createMockRecord } from '../test-helpers';

// Services
import {
  ServiceTypesServiceLive,
  ServiceTypesServiceTag,
  type ServiceTypesService
} from '$lib/services/zomes/serviceTypes.service';
import {
  HolochainClientServiceTag,
  type HolochainClientService
} from '$lib/services/holochainClient.service';

const createMockHolochainClientService = (): HolochainClientService => ({
  appId: 'test-app',
  connectClientEffect: vi.fn(),
  getAppInfoEffect: vi.fn(),
  callZomeEffect: vi.fn(),
  callZomeRawEffect: vi.fn(),
  isConnectedEffect: vi.fn(),
  getClientEffect: vi.fn()
});

describe('ServiceTypesService - Tag Methods', () => {
  let mockHolochainClient: HolochainClientService;
  let mockRecord: Record;

  beforeEach(async () => {
    mockHolochainClient = createMockHolochainClientService();
    mockRecord = await createMockRecord();
  });

  const createTestLayer = () => Layer.succeed(HolochainClientServiceTag, mockHolochainClient);

  const runServiceEffect = <A, E>(effect: E.Effect<A, E, ServiceTypesServiceTag>) => {
    const serviceLayer = Layer.provide(ServiceTypesServiceLive, createTestLayer());
    const runnable = E.provide(effect, serviceLayer);
    return E.runPromise(runnable);
  };

  describe('getServiceTypesByTag', () => {
    it('should call the zome with the correct parameters and return records', async () => {
      const tag = 'test-tag';
      vi.spyOn(mockHolochainClient, 'callZomeRawEffect').mockReturnValue(E.succeed([mockRecord]));

      const effect = E.gen(function* () {
        const service = yield* ServiceTypesServiceTag;
        return yield* service.getServiceTypesByTag(tag);
      });

      const result = await runServiceEffect(effect);

      expect(mockHolochainClient.callZomeRawEffect).toHaveBeenCalledWith(
        'service_types',
        'get_service_types_by_tag',
        tag
      );
      expect(result).toEqual([mockRecord]);
    });
  });

  describe('getServiceTypesByTags', () => {
    it('should call the zome with the correct parameters', async () => {
      const tags = ['tag1', 'tag2'];
      vi.spyOn(mockHolochainClient, 'callZomeRawEffect').mockReturnValue(E.succeed([mockRecord]));

      const effect = E.gen(function* () {
        const service = yield* ServiceTypesServiceTag;
        return yield* service.getServiceTypesByTags(tags);
      });

      await runServiceEffect(effect);

      expect(mockHolochainClient.callZomeRawEffect).toHaveBeenCalledWith(
        'service_types',
        'get_service_types_by_tags',
        tags
      );
    });
  });

  describe('getAllServiceTypeTags', () => {
    it('should call the zome and return a list of tags', async () => {
      const tags = ['tag1', 'tag2'];
      vi.spyOn(mockHolochainClient, 'callZomeEffect').mockReturnValue(E.succeed(tags));

      const effect = E.gen(function* () {
        const service = yield* ServiceTypesServiceTag;
        return yield* service.getAllServiceTypeTags();
      });

      const result = await runServiceEffect(effect);

      expect(result).toEqual(tags);
      expect(mockHolochainClient.callZomeEffect).toHaveBeenCalledWith(
        'service_types',
        'get_all_service_type_tags',
        null,
        expect.any(Function) // StringArraySchema is a schema function
      );
    });
  });

  describe('searchServiceTypesByTagPrefix', () => {
    it('should call the zome with the correct prefix', async () => {
      const prefix = 'test-';
      vi.spyOn(mockHolochainClient, 'callZomeRawEffect').mockReturnValue(E.succeed([mockRecord]));

      const effect = E.gen(function* () {
        const service = yield* ServiceTypesServiceTag;
        return yield* service.searchServiceTypesByTagPrefix(prefix);
      });

      await runServiceEffect(effect);

      expect(mockHolochainClient.callZomeRawEffect).toHaveBeenCalledWith(
        'service_types',
        'search_service_types_by_tag_prefix',
        prefix
      );
    });
  });

  describe('getTagStatistics', () => {
    it('should call the zome and return tag statistics', async () => {
      const stats: [string, number][] = [
        ['tag1', 10],
        ['tag2', 5]
      ];
      vi.spyOn(mockHolochainClient, 'callZomeEffect').mockReturnValue(E.succeed(stats));

      const effect = E.gen(function* () {
        const service = yield* ServiceTypesServiceTag;
        return yield* service.getTagStatistics();
      });

      const result = await runServiceEffect(effect);

      expect(result).toEqual(stats);
      expect(mockHolochainClient.callZomeEffect).toHaveBeenCalledWith(
        'service_types',
        'get_tag_statistics',
        null,
        expect.any(Function) // TagStatisticsArraySchema is a schema function
      );
    });
  });
});
