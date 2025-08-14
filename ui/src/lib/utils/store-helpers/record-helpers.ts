import { Effect as E } from 'effect';
import type { Record as HolochainRecord, ActionHash } from '@holochain/client';
import { decode } from '@msgpack/msgpack';
import type { EntityCacheService } from '$lib/utils/cache.svelte';
import type {
  CacheableEntity,
  RecordToEntityConverter,
  RecordProcessor,
  EntityCreationHelper,
  CacheOperation,
  EntityStatus
} from '$lib/types/store-helpers.js';

// ============================================================================
// RECORD TO ENTITY CONVERSION
// ============================================================================

/**
 * Creates a generic UI entity from a Holochain record
 *
 * @param record The Holochain record to convert
 * @param additionalData Additional data to include in the entity
 * @returns UI entity or null if conversion fails
 *
 * @example
 * ```typescript
 * const createServiceType = createUIEntityFromRecord<ServiceTypeInDHT, UIServiceType>(
 *   (entry, actionHash, timestamp, additionalData) => ({
 *     original_action_hash: actionHash,
 *     name: entry.name,
 *     description: entry.description,
 *     status: additionalData?.status || 'pending',
 *     created_at: new Date(timestamp / 1000),
 *     updated_at: undefined
 *   })
 * );
 * ```
 */
export const createUIEntityFromRecord = <TEntry, TEntity extends CacheableEntity>(
  entityMapper: (
    entry: TEntry,
    actionHash: ActionHash,
    timestamp: number,
    additionalData?: Record<string, unknown>
  ) => TEntity
): RecordToEntityConverter<HolochainRecord, TEntity> => {
  return (record: HolochainRecord, additionalData?: Record<string, unknown>): TEntity | null => {
    try {
      // Decode MessagePack entry
      const entry = decode((record.entry as any).Present.entry) as TEntry;
      const actionHash = record.signed_action.hashed.hash;
      const timestamp = record.signed_action.hashed.content.timestamp;

      return entityMapper(entry, actionHash, timestamp, additionalData);
    } catch (error) {
      console.error('Failed to create UI entity from record:', error);
      return null;
    }
  };
};

/**
 * Creates a factory for converting specific entry types to UI entities
 *
 * @param defaultStatus Default status for entities
 * @returns Entity creation helper
 */
export const createEntityFactory = <TEntry, TEntity extends CacheableEntity>(
  defaultStatus?: EntityStatus
) => {
  return {
    fromRecord: (
      record: HolochainRecord,
      mapper: (entry: TEntry, actionHash: ActionHash, timestamp: number) => Omit<TEntity, 'status'>,
      status?: EntityStatus
    ): TEntity | null => {
      try {
        const entry = decode((record.entry as any).Present.entry) as TEntry;
        const actionHash = record.signed_action.hashed.hash;
        const timestamp = record.signed_action.hashed.content.timestamp;

        const baseEntity = mapper(entry, actionHash, timestamp);

        return {
          ...baseEntity,
          ...(status || defaultStatus ? { status: status || defaultStatus } : {})
        } as TEntity;
      } catch (error) {
        console.error('Failed to create entity from record:', error);
        return null;
      }
    }
  };
};

// ============================================================================
// RECORD COLLECTION PROCESSING
// ============================================================================

/**
 * Maps an array of records to UI entities with error recovery
 *
 * @param records Array of Holochain records
 * @param converter Record to entity converter function
 * @param additionalData Additional data to pass to converter
 * @returns Array of UI entities (null entries filtered out)
 *
 * @example
 * ```typescript
 * const serviceTypes = mapRecordsToUIEntities(
 *   records,
 *   createServiceTypeFromRecord,
 *   { status: 'approved' }
 * );
 * ```
 */
export const mapRecordsToUIEntities = <TEntity extends CacheableEntity>(
  records: HolochainRecord[],
  converter: RecordToEntityConverter<HolochainRecord, TEntity>,
  additionalData?: Record<string, unknown>
): TEntity[] => {
  return records
    .map((record) => converter(record, additionalData))
    .filter((entity): entity is TEntity => entity !== null);
};

/**
 * Creates a record processor that handles caching and state synchronization
 *
 * @param converter Record to entity converter
 * @param cache Cache service for storing entities
 * @param syncToState Function to synchronize entities to state arrays
 * @returns Record processor interface
 */
export const createRecordProcessor = <TEntity extends CacheableEntity>(
  converter: RecordToEntityConverter<HolochainRecord, TEntity>,
  cache: EntityCacheService<TEntity>,
  syncToState: (entity: TEntity, operation: CacheOperation) => void
): RecordProcessor<HolochainRecord, TEntity> => {
  const processRecord = (
    record: HolochainRecord,
    additionalData?: Record<string, unknown>
  ): { record: HolochainRecord; entity: TEntity } => {
    const entity = converter(record, additionalData);

    if (!entity) {
      throw new Error('Failed to convert record to entity');
    }

    // Add to cache
    const cacheKey =
      entity.actionHash?.toString() ||
      entity.original_action_hash?.toString() ||
      record.signed_action.hashed.hash.toString();
    E.runSync(cache.set(cacheKey, entity));

    // Sync to state
    syncToState(entity, 'add');

    return { record, entity };
  };

  const processRecords = (records: HolochainRecord[]): TEntity[] => {
    return records.map((record) => {
      const { entity } = processRecord(record);
      return entity;
    });
  };

  return { processRecord, processRecords };
};

// ============================================================================
// ENTITY CREATION HELPERS
// ============================================================================

/**
 * Creates standardized entity creation helpers
 *
 * @param converter Record to entity converter
 * @returns Entity creation helper interface
 */
export const createEntityCreationHelper = <TEntity extends CacheableEntity>(
  converter: RecordToEntityConverter<HolochainRecord, TEntity>
): EntityCreationHelper<HolochainRecord, TEntity> => {
  const createEntity = (
    record: HolochainRecord,
    additionalData?: Record<string, unknown>
  ): TEntity | null => {
    return converter(record, additionalData);
  };

  const createEntities = (records: HolochainRecord[]): TEntity[] => {
    return mapRecordsToUIEntities(records, converter);
  };

  return { createEntity, createEntities };
};

// ============================================================================
// SPECIALIZED ENTITY CREATORS
// ============================================================================

/**
 * Creates a status-aware entity creator for approval workflow entities
 *
 * @param baseConverter Base converter without status logic
 * @returns Status-aware entity creator
 */
export const createStatusAwareEntityCreator = <TEntry, TEntity extends CacheableEntity>(
  baseConverter: (
    entry: TEntry,
    actionHash: ActionHash,
    timestamp: number
  ) => Omit<TEntity, 'status'>
) => {
  return createUIEntityFromRecord<TEntry, TEntity & { status: EntityStatus }>(
    (entry, actionHash, timestamp, additionalData) => {
      const baseEntity = baseConverter(entry, actionHash, timestamp);
      const status = (additionalData?.status as EntityStatus) || 'pending';

      return {
        ...baseEntity,
        status
      } as TEntity & { status: EntityStatus };
    }
  );
};

/**
 * Creates a timestamped entity creator that automatically handles created/updated times
 *
 * @param baseConverter Base converter without timestamp logic
 * @returns Timestamped entity creator
 */
export const createTimestampedEntityCreator = <TEntry, TEntity extends CacheableEntity>(
  baseConverter: (
    entry: TEntry,
    actionHash: ActionHash,
    timestamp: number
  ) => Omit<TEntity, 'createdAt' | 'updatedAt'>
) => {
  return createUIEntityFromRecord<TEntry, TEntity & { createdAt: Date; updatedAt?: Date }>(
    (entry, actionHash, timestamp, additionalData) => {
      const baseEntity = baseConverter(entry, actionHash, timestamp);

      return {
        ...baseEntity,
        createdAt: new Date(timestamp / 1000), // Convert microseconds to milliseconds
        updatedAt: additionalData?.isUpdate ? new Date() : undefined
      } as TEntity & { createdAt: Date; updatedAt?: Date };
    }
  );
};

// ============================================================================
// BATCH PROCESSING UTILITIES
// ============================================================================

/**
 * Creates a batch processor for handling multiple collections of records
 *
 * @param converter Record to entity converter
 * @param cache Cache service
 * @param syncToState State synchronization function
 * @returns Batch processor function
 */
export const createBatchRecordProcessor = <TEntity extends CacheableEntity>(
  converter: RecordToEntityConverter<HolochainRecord, TEntity>,
  cache: EntityCacheService<TEntity>,
  syncToState: (entity: TEntity, operation: CacheOperation) => void
) => {
  const processor = createRecordProcessor(converter, cache, syncToState);

  return (recordCollections: Record<string, HolochainRecord[]>): Record<string, TEntity[]> => {
    const result: Record<string, TEntity[]> = {};

    Object.entries(recordCollections).forEach(([collectionName, records]) => {
      result[collectionName] = records.map((record) => {
        const { entity } = processor.processRecord(record, {
          status: collectionName,
          collection: collectionName
        });
        return entity;
      });
    });

    return result;
  };
};

// ============================================================================
// RECORD VALIDATION UTILITIES
// ============================================================================

/**
 * Creates a record validator that checks for required fields and structure
 *
 * @param requiredFields Fields that must be present in the decoded entry
 * @returns Record validation function
 */
export const createRecordValidator = <TEntry extends Record<string, any>>(
  requiredFields: (keyof TEntry)[]
) => {
  return (record: HolochainRecord): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    try {
      // Check record structure
      if (!record.entry || !record.signed_action) {
        errors.push('Invalid record structure');
        return { isValid: false, errors };
      }

      // Decode and validate entry
      const entry = decode((record.entry as any).Present.entry) as TEntry;

      // Check required fields
      requiredFields.forEach((field) => {
        if (!(field in entry) || entry[field] == null) {
          errors.push(`Missing required field: ${String(field)}`);
        }
      });
    } catch (error) {
      errors.push(`Failed to decode record: ${error}`);
    }

    return { isValid: errors.length === 0, errors };
  };
};

/**
 * Creates a safe record converter that validates records before conversion
 *
 * @param converter Base record converter
 * @param validator Record validator
 * @returns Safe record converter with validation
 */
export const createSafeRecordConverter = <TEntity extends CacheableEntity>(
  converter: RecordToEntityConverter<HolochainRecord, TEntity>,
  validator: (record: HolochainRecord) => { isValid: boolean; errors: string[] }
): RecordToEntityConverter<HolochainRecord, TEntity> => {
  return (record: HolochainRecord, additionalData?: Record<string, unknown>): TEntity | null => {
    const validation = validator(record);

    if (!validation.isValid) {
      console.warn('Record validation failed:', validation.errors);
      return null;
    }

    return converter(record, additionalData);
  };
};

// ============================================================================
// RECORD UPDATE HELPERS
// ============================================================================

/**
 * Creates a helper for processing record updates
 *
 * @param converter Record to entity converter
 * @param cache Cache service
 * @param syncToState State synchronization function
 * @returns Record update helper
 */
export const createRecordUpdateHelper = <TEntity extends CacheableEntity>(
  converter: RecordToEntityConverter<HolochainRecord, TEntity>,
  cache: EntityCacheService<TEntity>,
  syncToState: (entity: TEntity, operation: CacheOperation) => void
) => {
  return {
    processUpdate: (
      newRecord: HolochainRecord,
      previousActionHash: ActionHash,
      additionalData?: Record<string, unknown>
    ): TEntity | null => {
      // Convert new record to entity
      const updatedEntity = converter(newRecord, {
        ...additionalData,
        isUpdate: true
      });

      if (!updatedEntity) {
        return null;
      }

      // Remove old entity from cache
      const previousHashStr = previousActionHash.toString();
      E.runSync(cache.delete(previousHashStr));

      // Add updated entity to cache
      const newHashStr = newRecord.signed_action.hashed.hash.toString();
      E.runSync(cache.set(newHashStr, updatedEntity));

      // Sync to state (this should handle removal of old and addition of new)
      syncToState(updatedEntity, 'update');

      return updatedEntity;
    }
  };
};
