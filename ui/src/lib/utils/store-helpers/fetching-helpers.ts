import { Effect as E, pipe } from 'effect';
import type { ActionHash } from '@holochain/client';
import type {
  CacheableEntity,
  LoadingStateSetter,
  EntityFetcher,
  EntityStatus,
  FetchConfig,
  ErrorHandler
} from '$lib/types/store-helpers.js';
import { withLoadingState, withClientConnectionFallback } from './core.js';

// ============================================================================
// GENERIC DATA FETCHING
// ============================================================================

/**
 * Creates a standardized function for fetching and mapping entities with state updates
 *
 * @param serviceMethod The service method to fetch the entities
 * @param targetArray The array to store the fetched entities
 * @param errorContext The error context to use when an error occurs
 * @param setters Loading state setters
 * @returns The fetched entities
 *
 * @example
 * ```typescript
 * const fetchServiceTypes = createEntityFetcher(
 *   () => serviceTypeService.getAllServiceTypes(),
 *   serviceTypes,
 *   'Failed to fetch service types',
 *   { setLoading, setError }
 * );
 * ```
 */
export const createEntityFetcher = <TEntity extends CacheableEntity, TError>(
  errorHandler: ErrorHandler<TError>
): EntityFetcher<TEntity, TError> => {
  return (serviceMethod: () => E.Effect<TEntity[], unknown>, config: FetchConfig<TEntity>) =>
    withLoadingState(() =>
      pipe(
        serviceMethod(),
        E.map((entities) => {
          config.targetArray.splice(0, config.targetArray.length, ...entities);
          return entities;
        }),
        E.catchAll((error) => {
          const errorMessage = String(error);
          if (errorMessage.includes('Client not connected')) {
            console.warn('Holochain client not connected, returning empty array');
            return E.succeed([]);
          }
          return errorHandler(error, config.errorContext);
        })
      )
    )(config.setters);
};

/**
 * Creates a data fetcher with client connection fallback
 *
 * @param fallbackValue Value to return when client is disconnected
 * @returns Entity fetcher with connection fallback
 */
export const createEntityFetcherWithFallback = <TEntity extends CacheableEntity, TError>(
  errorHandler: ErrorHandler<TError>,
  fallbackValue: TEntity[] = []
): EntityFetcher<TEntity, TError> => {
  return (serviceMethod: () => E.Effect<TEntity[], unknown>, config: FetchConfig<TEntity>) =>
    withLoadingState(() =>
      pipe(
        serviceMethod(),
        E.map((entities) => {
          config.targetArray.splice(0, config.targetArray.length, ...entities);
          return entities;
        }),
        E.catchAll(withClientConnectionFallback(fallbackValue))
      )
    )(config.setters);
};

// ============================================================================
// COLLECTION FETCHING UTILITIES
// ============================================================================

/**
 * Creates a fetcher for multiple entity collections (e.g., pending, approved, rejected)
 *
 * @param serviceMethods Object containing service methods for different collections
 * @param targetArrays Object containing target arrays for each collection
 * @param errorHandler Error handler function
 * @returns Collection fetcher function
 *
 * @example
 * ```typescript
 * const fetchServiceTypeCollections = createCollectionFetcher(
 *   {
 *     pending: () => service.getPendingServiceTypes(),
 *     approved: () => service.getApprovedServiceTypes(),
 *     rejected: () => service.getRejectedServiceTypes()
 *   },
 *   {
 *     pending: pendingServiceTypes,
 *     approved: approvedServiceTypes,
 *     rejected: rejectedServiceTypes
 *   },
 *   ServiceTypeError.fromError
 * );
 * ```
 */
export const createCollectionFetcher = <TEntity extends CacheableEntity, TError>(
  serviceMethods: Record<string, () => E.Effect<TEntity[], unknown>>,
  targetArrays: Record<string, TEntity[]>,
  errorHandler: ErrorHandler<TError>
) => {
  return (setters: LoadingStateSetter): E.Effect<Record<string, TEntity[]>, TError> =>
    withLoadingState(() =>
      pipe(
        E.all(
          Object.fromEntries(
            Object.entries(serviceMethods).map(([key, method]) => [
              key,
              pipe(method(), E.catchAll(withClientConnectionFallback([])))
            ])
          )
        ),
        E.map((collections) => {
          // Update target arrays
          Object.entries(collections).forEach(([key, entities]) => {
            const targetArray = targetArrays[key];
            if (targetArray) {
              targetArray.splice(0, targetArray.length, ...entities);
            }
          });
          return collections;
        }),
        E.catchAll((error) => errorHandler(error, 'Failed to fetch entity collections'))
      )
    )(setters);
};

// ============================================================================
// INDIVIDUAL ENTITY FETCHING
// ============================================================================

/**
 * Creates a fetcher for individual entities by hash
 *
 * @param serviceMethod Service method to fetch single entity
 * @param errorHandler Error handler function
 * @returns Individual entity fetcher
 */
export const createIndividualEntityFetcher = <TEntity extends CacheableEntity, TError>(
  serviceMethod: (hash: ActionHash) => E.Effect<TEntity | null, unknown>,
  errorHandler: ErrorHandler<TError>
) => {
  return (entityHash: ActionHash, setters: LoadingStateSetter): E.Effect<TEntity | null, TError> =>
    withLoadingState(() =>
      pipe(
        serviceMethod(entityHash),
        E.catchAll((error) => {
          const errorMessage = String(error);
          if (errorMessage.includes('Client not connected')) {
            console.warn('Holochain client not connected, returning null');
            return E.succeed(null);
          }
          return errorHandler(error, 'Failed to fetch entity');
        })
      )
    )(setters);
};

// ============================================================================
// STATUS-AWARE FETCHING
// ============================================================================

/**
 * Creates a status-aware fetcher that handles entities with approval workflows
 *
 * @param serviceMethods Service methods for different status types
 * @param statusArrays Target arrays for each status
 * @param allEntitiesArray Array to store all entities regardless of status
 * @param errorHandler Error handler function
 * @returns Status-aware fetcher
 */
export const createStatusAwareFetcher = <
  TEntity extends CacheableEntity & { status: EntityStatus },
  TError
>(
  serviceMethods: {
    pending: () => E.Effect<TEntity[], unknown>;
    approved: () => E.Effect<TEntity[], unknown>;
    rejected: () => E.Effect<TEntity[], unknown>;
  },
  statusArrays: {
    pending: TEntity[];
    approved: TEntity[];
    rejected: TEntity[];
  },
  allEntitiesArray: TEntity[],
  errorHandler: ErrorHandler<TError>
) => {
  return (
    setters: LoadingStateSetter
  ): E.Effect<
    {
      pending: TEntity[];
      approved: TEntity[];
      rejected: TEntity[];
    },
    TError
  > =>
    withLoadingState(() =>
      pipe(
        E.all({
          pending: pipe(serviceMethods.pending(), E.catchAll(withClientConnectionFallback([]))),
          approved: pipe(serviceMethods.approved(), E.catchAll(withClientConnectionFallback([]))),
          rejected: pipe(serviceMethods.rejected(), E.catchAll(withClientConnectionFallback([])))
        }),
        E.map((collections) => {
          // Clear all arrays
          allEntitiesArray.length = 0;
          statusArrays.pending.length = 0;
          statusArrays.approved.length = 0;
          statusArrays.rejected.length = 0;

          // Populate status-specific arrays
          statusArrays.pending.push(...collections.pending);
          statusArrays.approved.push(...collections.approved);
          statusArrays.rejected.push(...collections.rejected);

          // Populate all entities array
          allEntitiesArray.push(
            ...collections.pending,
            ...collections.approved,
            ...collections.rejected
          );

          return collections;
        }),
        E.catchAll((error) => errorHandler(error, 'Failed to fetch entities by status'))
      )
    )(setters);
};

// ============================================================================
// PAGINATED FETCHING
// ============================================================================

/**
 * Creates a paginated fetcher for large datasets
 *
 * @param serviceMethod Service method that supports pagination
 * @param errorHandler Error handler function
 * @returns Paginated fetcher
 */
export const createPaginatedFetcher = <TEntity extends CacheableEntity, TError>(
  serviceMethod: (
    offset: number,
    limit: number
  ) => E.Effect<
    {
      entities: TEntity[];
      total: number;
      hasMore: boolean;
    },
    unknown
  >,
  errorHandler: ErrorHandler<TError>
) => {
  return (
    offset: number,
    limit: number,
    setters: LoadingStateSetter
  ): E.Effect<
    {
      entities: TEntity[];
      total: number;
      hasMore: boolean;
    },
    TError
  > =>
    withLoadingState(() =>
      pipe(
        serviceMethod(offset, limit),
        E.catchAll((error) => errorHandler(error, 'Failed to fetch paginated entities'))
      )
    )(setters);
};

// ============================================================================
// FILTERED FETCHING
// ============================================================================

/**
 * Creates a filtered fetcher that applies client-side or server-side filtering
 *
 * @param serviceMethod Service method to fetch entities
 * @param filter Filter function to apply to results
 * @param errorHandler Error handler function
 * @returns Filtered fetcher
 */
export const createFilteredFetcher = <TEntity extends CacheableEntity, TError>(
  serviceMethod: () => E.Effect<TEntity[], unknown>,
  filter: (entity: TEntity) => boolean,
  errorHandler: ErrorHandler<TError>
) => {
  return (targetArray: TEntity[], setters: LoadingStateSetter): E.Effect<TEntity[], TError> =>
    withLoadingState(() =>
      pipe(
        serviceMethod(),
        E.map((entities) => {
          const filteredEntities = entities.filter(filter);
          targetArray.splice(0, targetArray.length, ...filteredEntities);
          return filteredEntities;
        }),
        E.catchAll((error) => errorHandler(error, 'Failed to fetch filtered entities'))
      )
    )(setters);
};

// ============================================================================
// REFRESH UTILITIES
// ============================================================================

/**
 * Creates a refresh function that fetches all entity collections
 *
 * @param fetchers Object containing all fetcher functions
 * @param setters Loading state setters
 * @returns Refresh function
 */
export const createRefreshFunction = <TEntity extends CacheableEntity, TError>(
  fetchers: Record<string, () => E.Effect<TEntity[], TError>>,
  setters: LoadingStateSetter
) => {
  return (): E.Effect<void, TError> =>
    withLoadingState(() =>
      pipe(
        E.all(
          Object.fromEntries(Object.entries(fetchers).map(([key, fetcher]) => [key, fetcher()]))
        ),
        E.asVoid
      )
    )(setters);
};

// ============================================================================
// CACHE-INTEGRATED FETCHING
// ============================================================================

/**
 * Creates a cache-integrated fetcher that checks cache first
 *
 * @param serviceMethod Service method to fetch from remote
 * @param cacheGetter Function to get entities from cache
 * @param cacheSetter Function to set entities in cache
 * @param errorHandler Error handler function
 * @param cacheExpiryMs Cache expiry time in milliseconds
 * @returns Cache-integrated fetcher
 */
export const createCacheIntegratedFetcher = <TEntity extends CacheableEntity, TError>(
  serviceMethod: () => E.Effect<TEntity[], unknown>,
  cacheGetter: () => E.Effect<TEntity[], Error>,
  cacheSetter: (entities: TEntity[]) => E.Effect<void, never>,
  errorHandler: ErrorHandler<TError>,
  cacheExpiryMs: number = 5 * 60 * 1000 // 5 minutes default
) => {
  let lastFetchTime = 0;

  return (
    targetArray: TEntity[],
    setters: LoadingStateSetter,
    forceRefresh: boolean = false
  ): E.Effect<TEntity[], TError> => {
    const now = Date.now();
    const cacheExpired = now - lastFetchTime > cacheExpiryMs;

    if (!forceRefresh && !cacheExpired) {
      // Try to get from cache first
      return pipe(
        cacheGetter(),
        E.map((cachedEntities) => {
          if (cachedEntities.length > 0) {
            targetArray.splice(0, targetArray.length, ...cachedEntities);
            return cachedEntities;
          }
          // Cache is empty, fall through to fetch from service
          throw new Error('Cache empty');
        }),
        E.catchAll(() => {
          // Cache miss or error, fetch from service
          return withLoadingState(() =>
            pipe(
              serviceMethod(),
              E.tap((entities) => {
                lastFetchTime = now;
                return cacheSetter(entities);
              }),
              E.map((entities) => {
                targetArray.splice(0, targetArray.length, ...entities);
                return entities;
              }),
              E.catchAll((error) => errorHandler(error, 'Failed to fetch entities'))
            )
          )(setters);
        })
      );
    }

    // Force refresh or cache expired, fetch from service
    return withLoadingState(() =>
      pipe(
        serviceMethod(),
        E.tap((entities) => {
          lastFetchTime = now;
          return cacheSetter(entities);
        }),
        E.map((entities) => {
          targetArray.splice(0, targetArray.length, ...entities);
          return entities;
        }),
        E.catchAll((error) => errorHandler(error, 'Failed to fetch entities'))
      )
    )(setters);
  };
};

// ============================================================================
// SPECIALIZED FETCHERS
// ============================================================================

/**
 * Creates a fetcher for entities that depend on other entities
 *
 * @param primaryFetcher Fetcher for primary entities
 * @param dependencyFetcher Fetcher for dependency entities
 * @param combiner Function to combine primary and dependency entities
 * @returns Dependency-aware fetcher
 */
export const createDependencyAwareFetcher = <
  TPrimary extends CacheableEntity,
  TDependency extends CacheableEntity,
  TResult extends CacheableEntity,
  TError
>(
  primaryFetcher: () => E.Effect<TPrimary[], TError>,
  dependencyFetcher: () => E.Effect<TDependency[], TError>,
  combiner: (primary: TPrimary[], dependencies: TDependency[]) => TResult[]
) => {
  return (targetArray: TResult[], setters: LoadingStateSetter): E.Effect<TResult[], TError> =>
    withLoadingState(() =>
      pipe(
        E.all({
          primary: primaryFetcher(),
          dependencies: dependencyFetcher()
        }),
        E.map(({ primary, dependencies }) => {
          const combined = combiner(primary, dependencies);
          targetArray.splice(0, targetArray.length, ...combined);
          return combined;
        })
      )
    )(setters);
};
