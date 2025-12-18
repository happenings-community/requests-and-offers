import { Effect as E, Layer, Context } from 'effect';

/**
 * Development Features Service
 *
 * Provides centralized control over development-only features through environment variables.
 * This service follows the 7-layer Effect-TS architecture pattern and ensures that
 * development features are completely stripped from production builds through Vite's
 * build-time tree shaking.
 */

// --- Service Interface ---

export interface DevFeaturesService {
  /** Whether mock data buttons should be shown in forms */
  readonly mockButtonsEnabled: boolean;

  /** Whether peers display is enabled (shows all network peers in test mode) */
  readonly peersDisplayEnabled: boolean;

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
    E.sync(() => {
      // Atomic feature flags - each independently controlled
      const mockButtonsEnabled = import.meta.env.VITE_MOCK_BUTTONS_ENABLED === 'true';
      const peersDisplayEnabled = import.meta.env.VITE_PEERS_DISPLAY_ENABLED === 'true';

      // Feature registry for dynamic checking
      const featureRegistry: Record<string, boolean> = {
        mockButtons: mockButtonsEnabled,
        peersDisplay: peersDisplayEnabled
      };

      const isFeatureEnabled = (featureName: string): boolean => {
        return featureRegistry[featureName] ?? false;
      };

      return DevFeaturesServiceTag.of({
        mockButtonsEnabled,
        peersDisplayEnabled,
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
  return import.meta.env.VITE_MOCK_BUTTONS_ENABLED === 'true';
};

/**
 * Check if test mode user list is enabled without Effect context
 * Combines environment check with explicit peers display flag
 */
export const isTestModeUserListEnabled = (): boolean => {
  const peersDisplayEnabled = import.meta.env.VITE_PEERS_DISPLAY_ENABLED === 'true';
  return peersDisplayEnabled;
};
