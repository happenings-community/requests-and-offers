// Re-export all error types for convenience
export * from './administration.errors';
export * from './cache.errors';
export * from './error-handling';
export * from './exchanges.errors';
export * from './holochain-client.errors';
export * from './hrea.errors';
export * from './mediums-of-exchange.errors';
export * from './offers.errors';
export * from './organizations.errors';
export * from './requests.errors';
export * from './service-types.errors';
export * from './users.errors';

// Export error contexts for standardized messaging
export * from './error-contexts';

// Named exports for convenience - Legacy compatibility
export { CacheNotFoundError, CacheValidationError } from './cache.errors';
export { RequestError, RequestStoreError, RequestsManagementError } from './requests.errors';
export { OfferError, OfferStoreError, OffersManagementError } from './offers.errors';
export {
  ServiceTypeError,
  ServiceTypeStoreError,
  ServiceTypesManagementError
} from './service-types.errors';
export { UserError, UserStoreError, UsersManagementError } from './users.errors';
export {
  OrganizationError,
  OrganizationStoreError,
  OrganizationsManagementError
} from './organizations.errors';
export {
  AdministrationError,
  AdministrationStoreError,
  AdministrationsManagementError
} from './administration.errors';
export {
  MediumOfExchangeError,
  MediumOfExchangeStoreError,
  MediumsOfExchangeManagementError
} from './mediums-of-exchange.errors';
export { ExchangeError } from './exchanges.errors';
export {
  HolochainClientError,
  ConnectionError,
  ZomeCallError,
  SchemaDecodeError
} from './holochain-client.errors';
export { HreaError } from './hrea.errors';
