import { Schema } from 'effect';

/**
 * Development Features Schema Definitions
 *
 * Provides type-safe schemas for development feature configuration
 * following the established Effect Schema patterns in the codebase.
 */

// --- Core Environment Schema ---

export const EnvironmentSchema = Schema.Literal('development', 'test', 'production');
export type Environment = Schema.Schema.Type<typeof EnvironmentSchema>;

// --- Feature Configuration Schema ---

export const DevFeaturesConfigSchema = Schema.Struct({
  /** Current environment */
  environment: EnvironmentSchema,

  /** Whether development mode is active */
  isDev: Schema.Boolean,

  /** Whether any development features should be enabled */
  devFeaturesEnabled: Schema.Boolean,

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
  'dev',
  'devFeatures',
  'mockButtons',
  'componentBoundaries',
  'stateInspector',
  'eventBusMonitor'
);

export type FeatureName = Schema.Schema.Type<typeof FeatureNameSchema>;

// --- Environment Variable Schema ---

export const EnvVariableSchema = Schema.Struct({
  /** Application environment */
  VITE_APP_ENV: Schema.optional(EnvironmentSchema),

  /** Development features enabled flag */
  VITE_DEV_FEATURES_ENABLED: Schema.optional(Schema.Literal('true', 'false')),

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
