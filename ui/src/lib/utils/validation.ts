import { Effect, Either, ParseResult } from 'effect';
import { Schema } from 'effect';
import * as FormSchemas from '../schemas/form.schemas';
import { RequestInput } from '../schemas/requests.schemas';
import { ArrayFormatter, TreeFormatter } from 'effect/ParseResult';

/**
 * Validation service using Effect Schema
 * Provides utilities for validating and sanitizing form data
 */

// Type helpers for extracting schema types
export type CreateRequestFormData = Schema.Schema.Type<typeof FormSchemas.CreateRequestFormSchema>;
export type CreateOfferFormData = Schema.Schema.Type<typeof FormSchemas.CreateOfferFormSchema>;
export type LoginFormData = Schema.Schema.Type<typeof FormSchemas.LoginFormSchema>;
export type RegisterFormData = Schema.Schema.Type<typeof FormSchemas.RegisterFormSchema>;

/**
 * Validates and sanitizes form data using Effect Schema
 */
export class ValidationService {
  /**
   * Validates create request form data using simple form schema
   */
  static validateCreateRequest = (data: unknown) =>
    Effect.gen(function* () {
      return yield* Schema.decodeUnknown(FormSchemas.CreateRequestFormSchema)(data);
    });

  /**
   * Validates complete request input data using comprehensive RequestInput schema
   * This provides full validation for all request fields
   */
  static validateRequestInput = (data: unknown) =>
    Effect.gen(function* () {
      return yield* Schema.decodeUnknown(RequestInput)(data);
    });

  /**
   * Validates create offer form data
   */
  static validateCreateOffer = (data: unknown) =>
    Effect.gen(function* () {
      return yield* Schema.decodeUnknown(FormSchemas.CreateOfferFormSchema)(data);
    });

  /**
   * Validates login form data
   */
  static validateLogin = (data: unknown) =>
    Effect.gen(function* () {
      return yield* Schema.decodeUnknown(FormSchemas.LoginFormSchema)(data);
    });

  /**
   * Validates registration form data
   */
  static validateRegister = (data: unknown) =>
    Effect.gen(function* () {
      return yield* Schema.decodeUnknown(FormSchemas.RegisterFormSchema)(data);
    });

  /**
   * Validates search query
   */
  static validateSearchQuery = (query: unknown) =>
    Effect.gen(function* () {
      return yield* Schema.decodeUnknown(FormSchemas.SearchQuerySchema)(query);
    });

  /**
   * Validates and sanitizes tags
   */
  static validateTags = (tags: unknown) =>
    Effect.gen(function* () {
      return yield* Schema.decodeUnknown(FormSchemas.TagsSchema)(tags);
    });

  /**
   * Validates filter options
   */
  static validateFilterOptions = (options: unknown) =>
    Effect.gen(function* () {
      return yield* Schema.decodeUnknown(FormSchemas.FilterOptionsSchema)(options);
    });

  /**
   * Safely validates data and returns Either result
   */
  static validateSafe =
    <A, I>(schema: Schema.Schema<A, I, never>) =>
    (data: unknown) =>
      Schema.decodeUnknownEither(schema)(data);

  /**
   * Validates data synchronously (throws on error)
   */
  static validateSync =
    <A, I>(schema: Schema.Schema<A, I, never>) =>
    (data: unknown) =>
      Schema.decodeUnknownSync(schema)(data);

  /**
   * Encodes validated data back to its input format
   */
  static encode =
    <A, I, R>(schema: Schema.Schema<A, I, R>) =>
    (data: A) =>
      Effect.gen(function* () {
        return yield* Schema.encode(schema)(data);
      });

  /**
   * Gets default values for a form schema
   */
  static getDefaults = <A, I, R>(schema: Schema.Schema<A, I, R>) =>
    Effect.gen(function* () {
      // For schemas with defaults, we can parse an empty object
      return yield* Schema.decodeUnknown(schema)({});
    });
}

/**
 * Utility functions for common validation patterns
 */
export const ValidationUtils = {
  /**
   * Validates email format
   */
  isValidEmail: (email: string): boolean => {
    return Either.isRight(Schema.decodeUnknownEither(FormSchemas.EmailSchema)(email));
  },

  /**
   * Validates password strength
   */
  isValidPassword: (password: string): boolean => {
    return Either.isRight(Schema.decodeUnknownEither(FormSchemas.PasswordSchema)(password));
  },

  /**
   * Sanitizes and validates a single tag
   */
  sanitizeTag: (tag: string): Either.Either<string, ParseResult.ParseError> => {
    return Schema.decodeUnknownEither(FormSchemas.TagSchema)(tag);
  },

  /**
   * Sanitizes title (trims whitespace)
   */
  sanitizeTitle: (title: string): Either.Either<string, ParseResult.ParseError> => {
    return Schema.decodeUnknownEither(FormSchemas.TitleSchema)(title);
  },

  /**
   * Sanitizes description (trims whitespace)
   */
  sanitizeDescription: (description: string): Either.Either<string, ParseResult.ParseError> => {
    return Schema.decodeUnknownEither(FormSchemas.DescriptionSchema)(description);
  },

  /**
   * Validates and formats search query
   */
  sanitizeSearchQuery: (query: string): Either.Either<string, ParseResult.ParseError> => {
    return Schema.decodeUnknownEither(FormSchemas.SearchQuerySchema)(query);
  }
};

/**
 * Error formatting utilities
 */
export const ValidationErrors = {
  /**
   * Formats validation errors for display
   */
  formatError: (error: ParseResult.ParseError): string => {
    // You can customize this based on your error display needs
    return TreeFormatter.formatErrorSync(error);
  },

  /**
   * Extracts field-specific errors for form validation
   */
  getFieldErrors: (error: ParseResult.ParseError): Record<string, string> => {
    const formatted = ArrayFormatter.formatErrorSync(error);
    const fieldErrors: Record<string, string> = {};

    formatted.forEach((issue) => {
      if (issue.path && issue.path.length > 0) {
        const fieldName = issue.path[issue.path.length - 1];
        fieldErrors[String(fieldName)] = issue.message;
      }
    });

    return fieldErrors;
  }
};
