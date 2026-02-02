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
  EMIT_SERVICE_TYPE_DELETED: `Failed to ${BASE_CONTEXTS.EMIT} service type deleted event`,
  GET_LATEST_SERVICE_TYPE_RECORD: 'Failed to get latest service type record',
  GET_REQUESTS_FOR_SERVICE_TYPE: 'Failed to get requests for service type',
  GET_OFFERS_FOR_SERVICE_TYPE: 'Failed to get offers for service type',
  GET_SERVICE_TYPES_FOR_ENTITY: 'Failed to get service types for entity',
  LINK_TO_SERVICE_TYPE: 'Failed to link to service type',
  UNLINK_FROM_SERVICE_TYPE: 'Failed to unlink from service type',
  UPDATE_SERVICE_TYPE_LINKS: 'Failed to update service type links',
  DELETE_ALL_SERVICE_TYPE_LINKS_FOR_ENTITY: 'Failed to delete all service type links for entity',
  GET_USERS_FOR_SERVICE_TYPE: 'Failed to get users for service type',
  SUGGEST_SERVICE_TYPE: 'Failed to suggest service type',
  APPROVE_SERVICE_TYPE: 'Failed to approve service type',
  REJECT_SERVICE_TYPE: 'Failed to reject service type',
  GET_PENDING_SERVICE_TYPES: 'Failed to get pending service types',
  GET_APPROVED_SERVICE_TYPES: 'Failed to get approved service types',
  GET_REJECTED_SERVICE_TYPES: 'Failed to get rejected service types',
  GET_SERVICE_TYPES_BY_TAG: 'Failed to get service types by tag',
  GET_SERVICE_TYPES_BY_TAGS: 'Failed to get service types by tags',
  GET_ALL_SERVICE_TYPE_TAGS: 'Failed to get all service type tags',
  GET_ALL_TAGS: 'Failed to get all tags',
  SEARCH_SERVICE_TYPES_BY_TAG_PREFIX: 'Failed to search service types by tag prefix',
  GET_TAG_STATISTICS: 'Failed to get tag statistics',
  DETERMINE_SERVICE_TYPE_STATUS: 'Failed to determine service type status',
  CHECK_SERVICE_TYPES_EXIST: 'Failed to check if service types exist',
  GET_SERVICE_TYPE_STATUS: 'Failed to get service type status'
} as const;

// Requests domain contexts
export const REQUEST_CONTEXTS = {
  CREATE_REQUEST: `Failed to ${BASE_CONTEXTS.CREATE} request`,
  GET_REQUEST: `Failed to ${BASE_CONTEXTS.READ} request`,
  GET_ALL_REQUESTS: `Failed to ${BASE_CONTEXTS.LIST} requests`,
  UPDATE_REQUEST: `Failed to ${BASE_CONTEXTS.UPDATE} request`,
  DELETE_REQUEST: `Failed to ${BASE_CONTEXTS.DELETE} request`,
  ARCHIVE_REQUEST: `Failed to ${BASE_CONTEXTS.UPDATE} request status to archived`,
  GET_USER_REQUESTS: `Failed to ${BASE_CONTEXTS.READ} user requests`,
  GET_USER_ACTIVE_REQUESTS: `Failed to ${BASE_CONTEXTS.READ} user active requests`,
  GET_USER_ARCHIVED_REQUESTS: `Failed to ${BASE_CONTEXTS.READ} user archived requests`,
  GET_ORGANIZATION_REQUESTS: `Failed to ${BASE_CONTEXTS.READ} organization requests`,
  GET_LATEST_REQUEST: `Failed to ${BASE_CONTEXTS.READ} latest request`,
  GET_LATEST_REQUEST_RECORD: `Failed to ${BASE_CONTEXTS.READ} latest request record`,
  CHECK_REQUESTS_EXIST: 'Failed to check if requests exist',
  GET_REQUESTS_BY_TAG: `Failed to ${BASE_CONTEXTS.READ} requests by tag`,
  GET_SERVICE_TYPES_FOR_REQUEST: `Failed to ${BASE_CONTEXTS.READ} service types for request`,
  GET_MEDIUMS_OF_EXCHANGE_FOR_REQUEST: `Failed to ${BASE_CONTEXTS.READ} mediums of exchange for request`,
  GET_MY_LISTINGS: `Failed to ${BASE_CONTEXTS.READ} user listings`,
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
  ARCHIVE_OFFER: `Failed to ${BASE_CONTEXTS.UPDATE} offer status to archived`,
  GET_USER_OFFERS: `Failed to ${BASE_CONTEXTS.READ} user offers`,
  GET_USER_ACTIVE_OFFERS: `Failed to ${BASE_CONTEXTS.READ} user active offers`,
  GET_USER_ARCHIVED_OFFERS: `Failed to ${BASE_CONTEXTS.READ} user archived offers`,
  GET_ORGANIZATION_OFFERS: `Failed to ${BASE_CONTEXTS.READ} organization offers`,
  GET_LATEST_OFFER: `Failed to ${BASE_CONTEXTS.READ} latest offer`,
  GET_LATEST_OFFER_RECORD: 'Failed to get latest offer record',
  DECODE_OFFERS: `Failed to ${BASE_CONTEXTS.DECODE} or process offers`,
  EMIT_OFFER_CREATED: `Failed to ${BASE_CONTEXTS.EMIT} offer created event`,
  EMIT_OFFER_UPDATED: `Failed to ${BASE_CONTEXTS.EMIT} offer updated event`,
  EMIT_OFFER_DELETED: `Failed to ${BASE_CONTEXTS.EMIT} offer deleted event`,
  GET_OFFER_CREATOR: `Failed to ${BASE_CONTEXTS.READ} offer creator`,
  GET_OFFER_ORGANIZATION: `Failed to ${BASE_CONTEXTS.READ} offer organization`,
  GET_OFFERS_BY_TAG: `Failed to ${BASE_CONTEXTS.READ} offers by tag`,
  GET_MY_LISTINGS: `Failed to ${BASE_CONTEXTS.READ} user listings`,
  GET_SERVICE_TYPES_FOR_OFFER: `Failed to ${BASE_CONTEXTS.READ} service types for offer`,
  GET_MEDIUMS_OF_EXCHANGE_FOR_OFFER: `Failed to ${BASE_CONTEXTS.READ} mediums of exchange for offer`,
  CHECK_OFFERS_EXIST: 'Failed to check if offers exist'
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
  GET_USER_STATUS: `Failed to ${BASE_CONTEXTS.READ} user status`,
  GET_ACCEPTED_USERS: `Failed to ${BASE_CONTEXTS.READ} accepted users`,
  GET_AGENT_USER: `Failed to ${BASE_CONTEXTS.READ} agent user`,
  GET_NETWORK_PEERS: 'Failed to get network peers',
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
  GET_ACCEPTED_ORGANIZATIONS: `Failed to ${BASE_CONTEXTS.READ} accepted organizations`,
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
  VALIDATE_STATUS: `Failed to ${BASE_CONTEXTS.VALIDATE} status`,
  GET_ALL_USERS: `Failed to ${BASE_CONTEXTS.LIST} all users`,
  GET_ALL_ORGANIZATIONS: `Failed to ${BASE_CONTEXTS.LIST} all organizations`,
  CREATE_STATUS: `Failed to ${BASE_CONTEXTS.CREATE} status`
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
  SUGGEST_MEDIUM: 'Failed to suggest medium of exchange',
  GET_LATEST_MEDIUM_RECORD: 'Failed to get latest medium of exchange record',
  GET_PENDING_MEDIUMS: 'Failed to get pending mediums of exchange',
  GET_APPROVED_MEDIUMS: 'Failed to get approved mediums of exchange',
  GET_REJECTED_MEDIUMS: 'Failed to get rejected mediums of exchange',
  APPROVE_MEDIUM: 'Failed to approve medium of exchange',
  REJECT_MEDIUM: 'Failed to reject medium of exchange',
  GET_MEDIUMS_FOR_ENTITY: 'Failed to get mediums of exchange for entity',
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
  INITIALIZE: 'Failed to initialize hREA GraphQL client',
  CREATE_RESOURCE_SPEC: `Failed to ${BASE_CONTEXTS.CREATE} hREA resource specification`,
  GET_RESOURCE_SPEC: `Failed to ${BASE_CONTEXTS.READ} hREA resource specification`,
  UPDATE_RESOURCE_SPEC: `Failed to ${BASE_CONTEXTS.UPDATE} hREA resource specification`,
  DELETE_RESOURCE_SPEC: `Failed to ${BASE_CONTEXTS.DELETE} hREA resource specification`,
  GET_RESOURCE_SPECS: `Failed to ${BASE_CONTEXTS.LIST} hREA resource specifications`,
  GET_RESOURCE_SPECS_BY_CLASS: 'Failed to get hREA resource specifications by classification',
  CREATE_PERSON: 'Failed to create person agent',
  UPDATE_PERSON: 'Failed to update person agent',
  CREATE_ORGANIZATION: 'Failed to create organization agent',
  UPDATE_ORGANIZATION: 'Failed to update organization agent',
  GET_AGENT: 'Failed to get agent',
  GET_AGENTS: 'Failed to get agents',
  CREATE_PROPOSAL: `Failed to ${BASE_CONTEXTS.CREATE} hREA proposal`,
  GET_PROPOSAL: `Failed to ${BASE_CONTEXTS.READ} hREA proposal`,
  UPDATE_PROPOSAL: `Failed to ${BASE_CONTEXTS.UPDATE} hREA proposal`,
  DELETE_PROPOSAL: `Failed to ${BASE_CONTEXTS.DELETE} hREA proposal`,
  GET_PROPOSALS: `Failed to ${BASE_CONTEXTS.LIST} hREA proposals`,
  GET_PROPOSALS_BY_AGENT: 'Failed to get hREA proposals by agent',
  CREATE_INTENT: `Failed to ${BASE_CONTEXTS.CREATE} hREA intent`,
  GET_INTENT: `Failed to ${BASE_CONTEXTS.READ} hREA intent`,
  UPDATE_INTENT: `Failed to ${BASE_CONTEXTS.UPDATE} hREA intent`,
  DELETE_INTENT: `Failed to ${BASE_CONTEXTS.DELETE} hREA intent`,
  GET_INTENTS: `Failed to ${BASE_CONTEXTS.LIST} hREA intents`,
  GET_INTENTS_BY_PROPOSAL: 'Failed to get hREA intents by proposal',
  PROPOSE_INTENT: 'Failed to link intent to proposal',
  MAP_TO_HREA: 'Failed to map to hREA format',
  MAP_FROM_HREA: 'Failed to map from hREA format',
  SYNC_WITH_HREA: 'Failed to sync with hREA'
} as const;

// Exchange Error Contexts
export const EXCHANGE_CONTEXTS = {
  // Proposal contexts
  RESPONSE_CREATION: 'Creating exchange response',
  RESPONSE_UPDATE: 'Updating response status',
  RESPONSE_FETCH: 'Fetching exchange response',
  RESPONSE_VALIDATION: 'Validating response data',
  RESPONSE_APPROVAL: 'Approving exchange response',
  RESPONSE_REJECTION: 'Rejecting exchange response',
  RESPONSE_DELETION: 'Deleting exchange response',

  // Agreement contexts
  AGREEMENT_CREATION: 'Creating exchange agreement',
  AGREEMENT_UPDATE: 'Updating agreement status',
  AGREEMENT_FETCH: 'Fetching exchange agreement',
  AGREEMENT_COMPLETION: 'Marking agreement complete',
  AGREEMENT_PROVIDER_COMPLETION: 'Provider marking completion',
  AGREEMENT_RECEIVER_COMPLETION: 'Receiver marking completion',

  // Review contexts
  REVIEW_CREATION: 'Creating exchange review',
  REVIEW_FETCH: 'Fetching exchange review',
  REVIEW_VALIDATION: 'Validating review data',
  REVIEW_STATISTICS: 'Calculating review statistics',

  // Collection contexts
  RESPONSES_FETCH: 'Fetching exchange responses',
  AGREEMENTS_FETCH: 'Fetching exchange agreements',
  REVIEWS_FETCH: 'Fetching exchange reviews',
  EXCHANGE_DASHBOARD: 'Loading exchange dashboard',

  // Business logic contexts
  EXCHANGE_WORKFLOW: 'Processing exchange workflow',
  PERMISSIONS_CHECK: 'Checking exchange permissions',
  STATUS_TRANSITION: 'Processing status transition',
  ENTITY_LINKING: 'Creating entity relationships',

  // Cache contexts
  RESPONSE_CACHE: 'Managing response cache',
  AGREEMENT_CACHE: 'Managing agreement cache',
  REVIEW_CACHE: 'Managing review cache',
  CACHE_INVALIDATION: 'Invalidating exchange cache'
} as const;

// Profile Display domain contexts
export const PROFILE_DISPLAY_CONTEXTS = {
  GET_MOSS_PROFILE: 'Failed to get Moss profile',
  ENRICH_WITH_MOSS_PROFILE: 'Failed to enrich profile with Moss data'
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
  EXCHANGE: EXCHANGE_CONTEXTS,
  PROFILE_DISPLAY: PROFILE_DISPLAY_CONTEXTS
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
export type ExchangeContext = keyof typeof EXCHANGE_CONTEXTS;
export type ProfileDisplayContext = keyof typeof PROFILE_DISPLAY_CONTEXTS;
