/**
 * Centralized error context constants for consistent error messaging across the application.
 * These constants provide standardized context strings for error handling utilities.
 */

// Base CRUD operation contexts
export const BASE_CONTEXTS = {
  CREATE: 'create',
  READ: 'get',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'get all',
  FETCH: 'fetch',
  DECODE: 'decode',
  VALIDATE: 'validate',
  EMIT: 'emit'
} as const;

// Service Types domain contexts
export const SERVICE_TYPE_CONTEXTS = {
  CREATE_SERVICE_TYPE: `Failed to ${BASE_CONTEXTS.CREATE} service type`,
  GET_SERVICE_TYPE: `Failed to ${BASE_CONTEXTS.READ} service type`,
  GET_ALL_SERVICE_TYPES: `Failed to ${BASE_CONTEXTS.LIST} service types`,
  UPDATE_SERVICE_TYPE: `Failed to ${BASE_CONTEXTS.UPDATE} service type`,
  DELETE_SERVICE_TYPE: `Failed to ${BASE_CONTEXTS.DELETE} service type`,
  DECODE_SERVICE_TYPES: `Failed to ${BASE_CONTEXTS.DECODE} service types`,
  VALIDATE_SERVICE_TYPE: `Failed to ${BASE_CONTEXTS.VALIDATE} service type`,
  MODERATE_SERVICE_TYPE: 'Failed to moderate service type',
  FETCH_SERVICE_TYPES: `Failed to ${BASE_CONTEXTS.FETCH} service types`,
  EMIT_SERVICE_TYPE_CREATED: `Failed to ${BASE_CONTEXTS.EMIT} service type created event`,
  EMIT_SERVICE_TYPE_UPDATED: `Failed to ${BASE_CONTEXTS.EMIT} service type updated event`,
  EMIT_SERVICE_TYPE_DELETED: `Failed to ${BASE_CONTEXTS.EMIT} service type deleted event`
} as const;

// Requests domain contexts
export const REQUEST_CONTEXTS = {
  CREATE_REQUEST: `Failed to ${BASE_CONTEXTS.CREATE} request`,
  GET_REQUEST: `Failed to ${BASE_CONTEXTS.READ} request`,
  GET_ALL_REQUESTS: `Failed to ${BASE_CONTEXTS.LIST} requests`,
  UPDATE_REQUEST: `Failed to ${BASE_CONTEXTS.UPDATE} request`,
  DELETE_REQUEST: `Failed to ${BASE_CONTEXTS.DELETE} request`,
  GET_USER_REQUESTS: `Failed to ${BASE_CONTEXTS.READ} user requests`,
  GET_ORGANIZATION_REQUESTS: `Failed to ${BASE_CONTEXTS.READ} organization requests`,
  GET_LATEST_REQUEST: `Failed to ${BASE_CONTEXTS.READ} latest request`,
  CHECK_REQUESTS_EXIST: 'Failed to check if requests exist',
  GET_REQUESTS_BY_TAG: `Failed to ${BASE_CONTEXTS.READ} requests by tag`,
  DECODE_REQUESTS: `Failed to ${BASE_CONTEXTS.DECODE} or process requests`,
  EMIT_REQUEST_CREATED: `Failed to ${BASE_CONTEXTS.EMIT} request created event`,
  EMIT_REQUEST_UPDATED: `Failed to ${BASE_CONTEXTS.EMIT} request updated event`,
  EMIT_REQUEST_DELETED: `Failed to ${BASE_CONTEXTS.EMIT} request deleted event`
} as const;

// Offers domain contexts
export const OFFER_CONTEXTS = {
  CREATE_OFFER: `Failed to ${BASE_CONTEXTS.CREATE} offer`,
  GET_OFFER: `Failed to ${BASE_CONTEXTS.READ} offer`,
  GET_ALL_OFFERS: `Failed to ${BASE_CONTEXTS.LIST} offers`,
  UPDATE_OFFER: `Failed to ${BASE_CONTEXTS.UPDATE} offer`,
  DELETE_OFFER: `Failed to ${BASE_CONTEXTS.DELETE} offer`,
  GET_USER_OFFERS: `Failed to ${BASE_CONTEXTS.READ} user offers`,
  GET_ORGANIZATION_OFFERS: `Failed to ${BASE_CONTEXTS.READ} organization offers`,
  GET_LATEST_OFFER: `Failed to ${BASE_CONTEXTS.READ} latest offer`,
  DECODE_OFFERS: `Failed to ${BASE_CONTEXTS.DECODE} or process offers`,
  EMIT_OFFER_CREATED: `Failed to ${BASE_CONTEXTS.EMIT} offer created event`,
  EMIT_OFFER_UPDATED: `Failed to ${BASE_CONTEXTS.EMIT} offer updated event`,
  EMIT_OFFER_DELETED: `Failed to ${BASE_CONTEXTS.EMIT} offer deleted event`
} as const;

// Users domain contexts
export const USER_CONTEXTS = {
  CREATE_USER: `Failed to ${BASE_CONTEXTS.CREATE} user`,
  GET_USER: `Failed to ${BASE_CONTEXTS.READ} user`,
  GET_ALL_USERS: `Failed to ${BASE_CONTEXTS.LIST} users`,
  UPDATE_USER: `Failed to ${BASE_CONTEXTS.UPDATE} user`,
  DELETE_USER: `Failed to ${BASE_CONTEXTS.DELETE} user`,
  GET_USER_BY_HASH: `Failed to ${BASE_CONTEXTS.READ} user by hash`,
  GET_USER_AGENTS: `Failed to ${BASE_CONTEXTS.READ} user agents`,
  GET_CURRENT_USER: `Failed to ${BASE_CONTEXTS.READ} current user`,
  DECODE_USERS: `Failed to ${BASE_CONTEXTS.DECODE} users`,
  VALIDATE_USER: `Failed to ${BASE_CONTEXTS.VALIDATE} user`,
  EMIT_USER_CREATED: `Failed to ${BASE_CONTEXTS.EMIT} user created event`,
  EMIT_USER_UPDATED: `Failed to ${BASE_CONTEXTS.EMIT} user updated event`,
  EMIT_USER_STATUS_UPDATED: `Failed to ${BASE_CONTEXTS.EMIT} user status updated event`
} as const;

// Organizations domain contexts
export const ORGANIZATION_CONTEXTS = {
  CREATE_ORGANIZATION: `Failed to ${BASE_CONTEXTS.CREATE} organization`,
  GET_ORGANIZATION: `Failed to ${BASE_CONTEXTS.READ} organization`,
  GET_ALL_ORGANIZATIONS: `Failed to ${BASE_CONTEXTS.LIST} organizations`,
  UPDATE_ORGANIZATION: `Failed to ${BASE_CONTEXTS.UPDATE} organization`,
  DELETE_ORGANIZATION: `Failed to ${BASE_CONTEXTS.DELETE} organization`,
  GET_LATEST_ORGANIZATION: `Failed to ${BASE_CONTEXTS.READ} latest organization`,
  GET_USER_ORGANIZATIONS: `Failed to ${BASE_CONTEXTS.READ} user organizations`,
  ADD_ORGANIZATION_MEMBER: 'Failed to add organization member',
  REMOVE_ORGANIZATION_MEMBER: 'Failed to remove organization member',
  ADD_ORGANIZATION_COORDINATOR: 'Failed to add organization coordinator',
  REMOVE_ORGANIZATION_COORDINATOR: 'Failed to remove organization coordinator',
  CHECK_USER_IS_COORDINATOR: 'Failed to check if user is coordinator',
  DECODE_ORGANIZATIONS: `Failed to ${BASE_CONTEXTS.DECODE} organizations`,
  EMIT_ORGANIZATION_CREATED: `Failed to ${BASE_CONTEXTS.EMIT} organization created event`,
  EMIT_ORGANIZATION_UPDATED: `Failed to ${BASE_CONTEXTS.EMIT} organization updated event`,
  EMIT_ORGANIZATION_STATUS_UPDATED: `Failed to ${BASE_CONTEXTS.EMIT} organization status updated event`
} as const;

// Administration domain contexts
export const ADMINISTRATION_CONTEXTS = {
  GET_ALL_ADMINISTRATORS: `Failed to ${BASE_CONTEXTS.LIST} network administrators`,
  ADD_ADMINISTRATOR: 'Failed to add network administrator',
  REMOVE_ADMINISTRATOR: 'Failed to remove network administrator',
  UPDATE_USER_STATUS: `Failed to ${BASE_CONTEXTS.UPDATE} user status`,
  UPDATE_ORGANIZATION_STATUS: `Failed to ${BASE_CONTEXTS.UPDATE} organization status`,
  GET_STATUS_FOR_ENTITY: `Failed to ${BASE_CONTEXTS.READ} status for entity`,
  GET_LATEST_STATUS: `Failed to ${BASE_CONTEXTS.READ} latest status`,
  GET_STATUS_REVISIONS: `Failed to ${BASE_CONTEXTS.READ} status revisions`,
  DECODE_STATUS: `Failed to ${BASE_CONTEXTS.DECODE} status`,
  VALIDATE_STATUS: `Failed to ${BASE_CONTEXTS.VALIDATE} status`
} as const;

// Mediums of Exchange domain contexts
export const MEDIUM_OF_EXCHANGE_CONTEXTS = {
  CREATE_MEDIUM: `Failed to ${BASE_CONTEXTS.CREATE} medium of exchange`,
  GET_MEDIUM: `Failed to ${BASE_CONTEXTS.READ} medium of exchange`,
  GET_ALL_MEDIUMS: `Failed to ${BASE_CONTEXTS.LIST} mediums of exchange`,
  UPDATE_MEDIUM: `Failed to ${BASE_CONTEXTS.UPDATE} medium of exchange`,
  DELETE_MEDIUM: `Failed to ${BASE_CONTEXTS.DELETE} medium of exchange`,
  GET_LATEST_MEDIUM: `Failed to ${BASE_CONTEXTS.READ} latest medium of exchange`,
  DECODE_MEDIUMS: `Failed to ${BASE_CONTEXTS.DECODE} mediums of exchange`,
  VALIDATE_MEDIUM: `Failed to ${BASE_CONTEXTS.VALIDATE} medium of exchange`,
  EMIT_MEDIUM_CREATED: `Failed to ${BASE_CONTEXTS.EMIT} medium of exchange created event`,
  EMIT_MEDIUM_UPDATED: `Failed to ${BASE_CONTEXTS.EMIT} medium of exchange updated event`
} as const;

// Holochain client contexts
export const HOLOCHAIN_CLIENT_CONTEXTS = {
  CONNECT: 'Failed to connect to Holochain',
  CALL_ZOME: 'Failed to call zome function',
  GET_DNA_INFO: 'Failed to get DNA info',
  GET_AGENT_INFO: 'Failed to get agent info',
  CREATE_CLONE_CELL: 'Failed to create clone cell',
  NETWORK_REQUEST: 'Failed to complete network request',
  VALIDATE_RESPONSE: 'Failed to validate response from Holochain'
} as const;

// hREA integration contexts
export const HREA_CONTEXTS = {
  CREATE_INTENT: `Failed to ${BASE_CONTEXTS.CREATE} hREA intent`,
  GET_INTENT: `Failed to ${BASE_CONTEXTS.READ} hREA intent`,
  UPDATE_INTENT: `Failed to ${BASE_CONTEXTS.UPDATE} hREA intent`,
  DELETE_INTENT: `Failed to ${BASE_CONTEXTS.DELETE} hREA intent`,
  CREATE_PROPOSAL: `Failed to ${BASE_CONTEXTS.CREATE} hREA proposal`,
  GET_PROPOSAL: `Failed to ${BASE_CONTEXTS.READ} hREA proposal`,
  UPDATE_PROPOSAL: `Failed to ${BASE_CONTEXTS.UPDATE} hREA proposal`,
  DELETE_PROPOSAL: `Failed to ${BASE_CONTEXTS.DELETE} hREA proposal`,
  CREATE_RESOURCE_SPEC: `Failed to ${BASE_CONTEXTS.CREATE} hREA resource specification`,
  GET_RESOURCE_SPEC: `Failed to ${BASE_CONTEXTS.READ} hREA resource specification`,
  MAP_TO_HREA: 'Failed to map to hREA format',
  MAP_FROM_HREA: 'Failed to map from hREA format',
  SYNC_WITH_HREA: 'Failed to sync with hREA'
} as const;

// Cache contexts
export const CACHE_CONTEXTS = {
  CACHE_SET: 'Failed to set cache entry',
  CACHE_GET: 'Failed to get cache entry',
  CACHE_DELETE: 'Failed to delete cache entry',
  CACHE_CLEAR: 'Failed to clear cache',
  CACHE_VALIDATE: 'Failed to validate cache entry',
  CACHE_EXPIRE: 'Failed to expire cache entry'
} as const;

// Composable contexts
export const COMPOSABLE_CONTEXTS = {
  INITIALIZE: 'Failed to initialize composable',
  LOAD_DATA: 'Failed to load data',
  SAVE_DATA: 'Failed to save data',
  VALIDATE_INPUT: 'Failed to validate input',
  FORMAT_OUTPUT: 'Failed to format output',
  HANDLE_EVENT: 'Failed to handle event'
} as const;

// Export all contexts for convenience
export const ERROR_CONTEXTS = {
  BASE: BASE_CONTEXTS,
  SERVICE_TYPE: SERVICE_TYPE_CONTEXTS,
  REQUEST: REQUEST_CONTEXTS,
  OFFER: OFFER_CONTEXTS,
  USER: USER_CONTEXTS,
  ORGANIZATION: ORGANIZATION_CONTEXTS,
  ADMINISTRATION: ADMINISTRATION_CONTEXTS,
  MEDIUM_OF_EXCHANGE: MEDIUM_OF_EXCHANGE_CONTEXTS,
  HOLOCHAIN_CLIENT: HOLOCHAIN_CLIENT_CONTEXTS,
  HREA: HREA_CONTEXTS,
  CACHE: CACHE_CONTEXTS,
  COMPOSABLE: COMPOSABLE_CONTEXTS
} as const;

// Helper function to create context strings dynamically
export function createContext(domain: string, operation: string, entityType?: string): string {
  const entity = entityType ? ` ${entityType}` : '';
  return `Failed to ${operation}${entity} in ${domain} domain`;
}

// Type helpers for context validation
export type ErrorContextKey = keyof typeof ERROR_CONTEXTS;
export type ServiceTypeContext = keyof typeof SERVICE_TYPE_CONTEXTS;
export type RequestContext = keyof typeof REQUEST_CONTEXTS;
export type OfferContext = keyof typeof OFFER_CONTEXTS;
export type UserContext = keyof typeof USER_CONTEXTS;
export type OrganizationContext = keyof typeof ORGANIZATION_CONTEXTS;
export type AdministrationContext = keyof typeof ADMINISTRATION_CONTEXTS;
export type MediumOfExchangeContext = keyof typeof MEDIUM_OF_EXCHANGE_CONTEXTS;
export type HolochainClientContext = keyof typeof HOLOCHAIN_CLIENT_CONTEXTS;
export type HreaContext = keyof typeof HREA_CONTEXTS;
export type CacheContext = keyof typeof CACHE_CONTEXTS;
export type ComposableContext = keyof typeof COMPOSABLE_CONTEXTS;
