import { Data } from 'effect';

// TODO: Migrate to Effect-TS Data.TaggedError pattern in the future
// For now, using legacy Error class for backward compatibility

/**
 * Union type of all possible application errors
 * Import from other error files for type safety
 */
export type ApplicationError =
  | import('./holochain-client.errors').HolochainClientError
  | import('./hrea.errors').HreaError
  | import('./users.errors').UserError
  | import('./administration.errors').AdministrationError
  | import('./offers.errors').OfferError
  | import('./requests.errors').RequestError
  | import('./service-types.errors').ServiceTypeError
  | import('./organizations.errors').OrganizationError
  | import('./exchanges.errors').ExchangeError
  | import('./mediums-of-exchange.errors').MediumOfExchangeError;

// Main Application Runtime Error - legacy class-based pattern
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

// Legacy export for potential future migration
export const AppRuntimeLegacyError = AppRuntimeError;
