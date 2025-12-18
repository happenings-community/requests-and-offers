import { Schema } from 'effect';

/**
 * Development Features Schema Definitions
 *
 * Provides type-safe schemas for development feature configuration
 * following the established Effect Schema patterns in the codebase.
 */

// --- Feature Configuration Schema ---

export const DevFeaturesConfigSchema = Schema.Struct({
  /** Whether mock data buttons should be shown in forms */
  mockButtonsEnabled: Schema.Boolean,

  /** Whether component boundary visualization is enabled */
  componentBoundariesEnabled: Schema.Boolean,

  /** Whether state inspector is enabled */
  stateInspectorEnabled: Schema.Boolean,

  /** Whether event bus monitor is enabled */
  eventBusMonitorEnabled: Schema.Boolean
});

export type DevFeaturesConfig = Schema.Schema.Type<typeof DevFeaturesConfigSchema>;

// --- Feature Name Schema ---

export const FeatureNameSchema = Schema.Literal(
  'mockButtons',
  'componentBoundaries',
  'stateInspector',
  'eventBusMonitor',
  'peersDisplay'
);

export type FeatureName = Schema.Schema.Type<typeof FeatureNameSchema>;

// --- Environment Variable Schema ---

export const EnvVariableSchema = Schema.Struct({
  /** Mock buttons enabled flag */
  VITE_MOCK_BUTTONS_ENABLED: Schema.optional(Schema.Literal('true', 'false')),

  /** Component boundaries enabled flag */
  VITE_COMPONENT_BOUNDARIES_ENABLED: Schema.optional(Schema.Literal('true', 'false')),

  /** State inspector enabled flag */
  VITE_STATE_INSPECTOR_ENABLED: Schema.optional(Schema.Literal('true', 'false')),

  /** Event bus monitor enabled flag */
  VITE_EVENT_BUS_MONITOR_ENABLED: Schema.optional(Schema.Literal('true', 'false'))
});

export type EnvVariables = Schema.Schema.Type<typeof EnvVariableSchema>;

// --- Validation Functions ---

/**
 * Validates environment configuration against schema
 */
export const validateDevFeaturesConfig = Schema.decodeUnknown(DevFeaturesConfigSchema);

/**
 * Validates environment variables against schema
 */
export const validateEnvVariables = Schema.decodeUnknown(EnvVariableSchema);

/**
 * Validates feature name against known feature names
 */
export const validateFeatureName = Schema.decodeUnknown(FeatureNameSchema);
