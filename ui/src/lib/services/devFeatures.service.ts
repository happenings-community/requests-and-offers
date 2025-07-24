import { Effect as E, Layer, Context } from 'effect';

/**
 * Development Features Service
 *
 * Provides centralized control over development-only features through environment variables.
 * This service follows the 7-layer Effect-TS architecture pattern and ensures that
 * development features are completely stripped from production builds through Vite's
 * build-time tree shaking.
 *
 * @example
 * ```typescript
 * // In a component
 * const devFeatures = yield* DevFeaturesServiceTag;
 * if (devFeatures.mockButtonsEnabled) {
 *   // Show mock button
 * }
 * ```
 */

// --- Service Interface ---

export interface DevFeaturesService {
  /** Whether development mode is active */
  readonly isDev: boolean;

  /** Whether any development features should be enabled */
  readonly devFeaturesEnabled: boolean;

  /** Whether mock data buttons should be shown in forms */
  readonly mockButtonsEnabled: boolean;

  /** Whether component boundary visualization is enabled (future feature) */
  readonly componentBoundariesEnabled: boolean;

  /** Whether state inspector is enabled (future feature) */
  readonly stateInspectorEnabled: boolean;

  /** Whether event bus monitor is enabled (future feature) */
  readonly eventBusMonitorEnabled: boolean;

  /** Get current environment name */
  readonly getEnvironment: () => string;

  /** Check if a specific feature is enabled */
  readonly isFeatureEnabled: (featureName: string) => boolean;
}

// --- Service Tag ---

export class DevFeaturesServiceTag extends Context.Tag('DevFeaturesService')<
  DevFeaturesServiceTag,
  DevFeaturesService
>() {}

// --- Service Implementation ---

/**
 * Live implementation of DevFeaturesService
 *
 * Reads configuration from Vite environment variables and provides
 * a clean interface for checking feature availability.
 */
export const DevFeaturesServiceLive: Layer.Layer<DevFeaturesServiceTag, never, never> =
  Layer.effect(
    DevFeaturesServiceTag,
    E.gen(function* () {
      // Read environment variables with safe defaults
      const environment = import.meta.env.VITE_APP_ENV || 'development';
      const isDev = environment === 'development';
      const devFeaturesEnabled = import.meta.env.VITE_DEV_FEATURES_ENABLED === 'true';

      // Core development features
      const mockButtonsEnabled =
        import.meta.env.VITE_MOCK_BUTTONS_ENABLED === 'true' && devFeaturesEnabled;

      // Future extensibility features (currently disabled)
      const componentBoundariesEnabled =
        import.meta.env.VITE_COMPONENT_BOUNDARIES_ENABLED === 'true' && devFeaturesEnabled;
      const stateInspectorEnabled =
        import.meta.env.VITE_STATE_INSPECTOR_ENABLED === 'true' && devFeaturesEnabled;
      const eventBusMonitorEnabled =
        import.meta.env.VITE_EVENT_BUS_MONITOR_ENABLED === 'true' && devFeaturesEnabled;

      // Feature registry for dynamic checking
      const featureRegistry: Record<string, boolean> = {
        dev: isDev,
        devFeatures: devFeaturesEnabled,
        mockButtons: mockButtonsEnabled,
        componentBoundaries: componentBoundariesEnabled,
        stateInspector: stateInspectorEnabled,
        eventBusMonitor: eventBusMonitorEnabled
      };

      const getEnvironment = (): string => environment;

      const isFeatureEnabled = (featureName: string): boolean => {
        return featureRegistry[featureName] ?? false;
      };

      return DevFeaturesServiceTag.of({
        isDev,
        devFeaturesEnabled,
        mockButtonsEnabled,
        componentBoundariesEnabled,
        stateInspectorEnabled,
        eventBusMonitorEnabled,
        getEnvironment,
        isFeatureEnabled
      });
    })
  );

// --- Convenience Functions ---

/**
 * Convenience function to check if mock buttons should be shown
 * Can be used in components without full Effect context
 */
export const shouldShowMockButtons = (): boolean => {
  return (
    import.meta.env.VITE_MOCK_BUTTONS_ENABLED === 'true' &&
    import.meta.env.VITE_DEV_FEATURES_ENABLED === 'true'
  );
};

/**
 * Convenience function to check if development features are enabled
 * Can be used in components without full Effect context
 */
export const areDevFeaturesEnabled = (): boolean => {
  return import.meta.env.VITE_DEV_FEATURES_ENABLED === 'true';
};

/**
 * Get current environment without Effect context
 */
export const getCurrentEnvironment = (): string => {
  return import.meta.env.VITE_APP_ENV || 'development';
};
