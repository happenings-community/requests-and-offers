/**
 * Application Runtime Layer
 * 
 * This module provides the main application runtime that combines all service layers,
 * implements graceful error recovery, structured logging, and resource management
 * for the Effect-first SvelteKit architecture.
 */

import { Effect as E, Layer, pipe, LogLevel, Logger, Context, Duration } from 'effect';

// Import all service layers
import { HolochainClientServiceTag, HolochainClientServiceLive } from '$lib/services/HolochainClientService.svelte';
import { HreaServiceTag, HreaServiceLive } from '$lib/services/hrea.service';
import { UsersServiceTag, UsersServiceLive } from '$lib/services/zomes/users.service';
import { AdministrationServiceTag, AdministrationServiceLive } from '$lib/services/zomes/administration.service';
import { OffersServiceTag, OffersServiceLive } from '$lib/services/zomes/offers.service';
import { RequestsServiceTag, RequestsServiceLive } from '$lib/services/zomes/requests.service';
import { ServiceTypesServiceTag, ServiceTypesServiceLive } from '$lib/services/zomes/serviceTypes.service';
import { OrganizationsServiceTag, OrganizationsServiceLive } from '$lib/services/zomes/organizations.service';
import { ExchangesServiceTag, ExchangesServiceLive } from '$lib/services/zomes/exchanges.service';
import { MediumsOfExchangeServiceTag, MediumsOfExchangeServiceLive } from '$lib/services/zomes/mediums-of-exchange.service';

// Error types
import type { 
  HolochainClientError, 
  HreaError, 
  UserError, 
  AdministrationError, 
  OfferError, 
  RequestError, 
  ServiceTypeError, 
  OrganizationError, 
  ExchangeError, 
  MediumOfExchangeError 
} from '$lib/errors';

// ============================================================================
// RUNTIME CONFIGURATION
// ============================================================================

export interface AppRuntimeConfig {
  /** Logging configuration */
  logging: {
    level: LogLevel.LogLevel;
    enableStructuredLogging: boolean;
    enablePerformanceMetrics: boolean;
  };
  
  /** Error recovery configuration */
  errorRecovery: {
    maxRetries: number;
    retryDelay: Duration.DurationInput;
    enableCircuitBreaker: boolean;
    circuitBreakerThreshold: number;
  };
  
  /** Resource management configuration */
  resources: {
    connectionTimeout: Duration.DurationInput;
    operationTimeout: Duration.DurationInput;
    enableResourceCleanup: boolean;
    maxConcurrentOperations: number;
  };
  
  /** Development configuration */
  development: {
    enableDebugMode: boolean;
    enableTracing: boolean;
    enableMetrics: boolean;
  };
}

/**
 * Default application runtime configuration
 */
export const defaultAppRuntimeConfig: AppRuntimeConfig = {
  logging: {
    level: LogLevel.Info,
    enableStructuredLogging: true,
    enablePerformanceMetrics: true
  },
  errorRecovery: {
    maxRetries: 3,
    retryDelay: '1 second',
    enableCircuitBreaker: true,
    circuitBreakerThreshold: 5
  },
  resources: {
    connectionTimeout: '10 seconds',
    operationTimeout: '30 seconds', 
    enableResourceCleanup: true,
    maxConcurrentOperations: 10
  },
  development: {
    enableDebugMode: true,
    enableTracing: true,
    enableMetrics: true
  }
};

// ============================================================================
// APPLICATION ERROR TYPES
// ============================================================================

/**
 * Union type of all possible application errors
 */
export type ApplicationError = 
  | HolochainClientError 
  | HreaError 
  | UserError 
  | AdministrationError 
  | OfferError 
  | RequestError 
  | ServiceTypeError 
  | OrganizationError 
  | ExchangeError 
  | MediumOfExchangeError;

/**
 * Application initialization error
 */
export class AppRuntimeError extends Error {
  constructor(
    public readonly component: string,
    public readonly originalError: unknown,
    message?: string
  ) {
    super(message || `Failed to initialize application component: ${component}`);
    this.name = 'AppRuntimeError';
  }
}

// ============================================================================
// SERVICE LAYER AGGREGATION
// ============================================================================

/**
 * Combined service layer interface for dependency injection
 */
export interface AppServices {
  readonly holochainClient: typeof HolochainClientServiceTag.Service;
  readonly hrea: typeof HreaServiceTag.Service;
  readonly users: typeof UsersServiceTag.Service;
  readonly administration: typeof AdministrationServiceTag.Service;
  readonly offers: typeof OffersServiceTag.Service;
  readonly requests: typeof RequestsServiceTag.Service;
  readonly serviceTypes: typeof ServiceTypesServiceTag.Service;
  readonly organizations: typeof OrganizationsServiceTag.Service;
  readonly exchanges: typeof ExchangesServiceTag.Service;
  readonly mediumsOfExchange: typeof MediumsOfExchangeServiceTag.Service;
}

/**
 * Application services context tag
 */
export class AppServicesTag extends Context.Tag('AppServices')<AppServicesTag, AppServices>() {}

// ============================================================================
// ERROR RECOVERY STRATEGIES
// ============================================================================

/**
 * Enhanced error boundary with structured logging and recovery strategies
 */
export const createApplicationErrorBoundary = (config: AppRuntimeConfig) => 
  <A, E extends ApplicationError>(
    operation: E.Effect<A, E, never>,
    context: string
  ): E.Effect<A, AppRuntimeError, never> =>
    pipe(
      operation,
      E.timeout(config.resources.operationTimeout),
      E.tap((result) => 
        config.logging.enablePerformanceMetrics
          ? E.logInfo(`✅ Operation completed: ${context}`)
          : E.void
      ),
      E.tapError((error) =>
        E.all([
          E.logError(`❌ Operation failed: ${context}`, error),
          config.logging.enableStructuredLogging 
            ? E.logError('Error details', {
                context,
                error: error instanceof Error ? {
                  name: error.name,
                  message: error.message,
                  stack: error.stack
                } : error,
                timestamp: new Date().toISOString()
              })
            : E.void
        ])
      ),
      E.mapError((error) => new AppRuntimeError(context, error))
    );

/**
 * Circuit breaker implementation for service calls
 */
export const createCircuitBreaker = (config: AppRuntimeConfig['errorRecovery']) => {
  let failureCount = 0;
  let isOpen = false;
  let lastFailureTime: number | null = null;

  return <A, E>(
    operation: E.Effect<A, E, never>,
    serviceName: string
  ): E.Effect<A, E | AppRuntimeError, never> => {
    if (isOpen) {
      const timeSinceLastFailure = Date.now() - (lastFailureTime || 0);
      const resetTimeout = Duration.toMillis(config.retryDelay);
      
      if (timeSinceLastFailure < resetTimeout) {
        return E.fail(new AppRuntimeError(serviceName, 'Circuit breaker is open') as E);
      } else {
        isOpen = false;
        failureCount = 0;
      }
    }

    return pipe(
      operation,
      E.tap(() => E.sync(() => {
        // Reset failure count on success
        failureCount = 0;
      })),
      E.tapError(() => E.sync(() => {
        failureCount++;
        lastFailureTime = Date.now();
        
        if (failureCount >= config.circuitBreakerThreshold) {
          isOpen = true;
        }
      }))
    );
  };
};

// ============================================================================
// STRUCTURED LOGGING
// ============================================================================

/**
 * Creates a structured logger for the application
 */
export const createApplicationLogger = (config: AppRuntimeConfig['logging']) => {
  const loggerLayer = Logger.replace(
    Logger.defaultLogger,
    Logger.make(({ date, fiberId, logLevel, message, spans, annotations }) => {
      const logData = {
        timestamp: date.toISOString(),
        level: logLevel._tag,
        message,
        fiberId: fiberId._tag,
        spans: Array.from(spans).map((span: any) => span.label),
        annotations: Object.fromEntries(annotations)
      };

      if (config.enableStructuredLogging) {
        console.log(JSON.stringify(logData, null, 2));
      } else {
        console.log(`[${logLevel._tag}] ${message}`);
      }
    })
  );

  return Layer.merge(loggerLayer, Logger.minimumLogLevel(config.level));
};

// ============================================================================
// RESOURCE MANAGEMENT
// ============================================================================

/**
 * Resource management layer with cleanup policies
 */
export const createResourceManagementLayer = (config: AppRuntimeConfig['resources']) =>
  Layer.scoped(
    AppServicesTag,
    E.gen(function* () {
      // Initialize all services with timeout and resource management
      const holochainClient = yield* HolochainClientServiceTag;
      const hrea = yield* HreaServiceTag;
      const users = yield* UsersServiceTag;
      const administration = yield* AdministrationServiceTag;
      const offers = yield* OffersServiceTag;
      const requests = yield* RequestsServiceTag;
      const serviceTypes = yield* ServiceTypesServiceTag;
      const organizations = yield* OrganizationsServiceTag;
      const exchanges = yield* ExchangesServiceTag;
      const mediumsOfExchange = yield* MediumsOfExchangeServiceTag;

      // Log successful initialization
      yield* E.logInfo('🚀 Application services initialized successfully');

      // Set up resource cleanup on scope exit
      yield* E.addFinalizer(() =>
        E.gen(function* () {
          yield* E.logInfo('🧹 Cleaning up application resources...');
          
          // Clean up Holochain client connection
          if (holochainClient.isConnected && holochainClient.client) {
            yield* E.tryPromise({
              try: async () => {
                // AppWebsocket doesn't have a close method - it's cleaned up automatically
                // Just log the cleanup
                console.log('Holochain client cleanup completed');
              },
              catch: (error) => error
            }).pipe(
              E.catchAll((error) => 
                E.logWarning('Failed to close Holochain client', error)
              )
            );
          }

          yield* E.logInfo('✅ Application resources cleaned up');
        })
      );

      return {
        holochainClient,
        hrea,
        users,
        administration,
        offers,
        requests,
        serviceTypes,
        organizations,
        exchanges,
        mediumsOfExchange
      };
    })
  );

// ============================================================================
// MAIN APPLICATION RUNTIME
// ============================================================================

/**
 * Main application runtime that combines all service layers with
 * error recovery, logging, and resource management
 */
export const createAppRuntime = (config: AppRuntimeConfig = defaultAppRuntimeConfig) => {
  // Base service layers
  const serviceLayer = Layer.mergeAll(
    HolochainClientServiceLive,
    HreaServiceLive,
    UsersServiceLive,
    AdministrationServiceLive,
    OffersServiceLive,
    RequestsServiceLive,
    ServiceTypesServiceLive,
    OrganizationsServiceLive,
    ExchangesServiceLive,
    MediumsOfExchangeServiceLive
  );

  // Enhanced runtime with logging and resource management
  const enhancedRuntime = pipe(
    serviceLayer,
    Layer.provide(createApplicationLogger(config.logging)),
    Layer.provideMerge(createResourceManagementLayer(config.resources))
  );

  return enhancedRuntime;
};

/**
 * Application initialization program that connects all services
 * and performs initial setup
 */
export const initializeApplication = (config: AppRuntimeConfig = defaultAppRuntimeConfig) =>
  E.gen(function* () {
    yield* E.logInfo('🏗️  Starting application initialization...');

    // Create error boundary and circuit breaker
    const errorBoundary = createApplicationErrorBoundary(config);
    const circuitBreaker = createCircuitBreaker(config.errorRecovery);

    // Initialize Holochain connection
    const holochainClient = yield* HolochainClientServiceTag;
    yield* E.tryPromise({
      try: async () => {
        await holochainClient.connectClient();
      },
      catch: (error) => new AppRuntimeError('holochain-connection', error)
    }).pipe(
      E.mapError((error) => error instanceof AppRuntimeError ? error : new AppRuntimeError('holochain-connection', error))
    );

    // Initialize hREA service
    const hreaService = yield* HreaServiceTag;
    yield* hreaService.initialize().pipe(
      E.asVoid,
      E.mapError((error) => new AppRuntimeError('hrea-initialization', error))
    );

    // Verify all services are accessible
    const services = yield* AppServicesTag;
    yield* E.logInfo('✅ All application services initialized and verified');

    return {
      services,
      config,
      runtime: createAppRuntime(config)
    };
  });

/**
 * Type-safe application program that provides all services
 */
export const withAppServices = <A, E, R>(
  program: E.Effect<A, E, R | AppServicesTag>
) =>
  pipe(
    program,
    E.provide(createAppRuntime())
  );