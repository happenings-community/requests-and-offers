import { getToastStore } from '@skeletonlabs/skeleton';
import { UIErrorHandling } from '$lib/errors';
import { Effect as E, pipe } from 'effect';

export interface ToastErrorOptions {
  enableSuccessToast?: boolean;
  enableErrorToast?: boolean;
  successMessage?: string;
  errorPrefix?: string;
  duration?: number;
  variant?: 'filled' | 'ghost' | 'soft';
}

/**
 * Creates an Effect that wraps another Effect with automatic toast notifications
 * for success and error cases using the UIErrorHandling system.
 */
export function withToastNotification<A, E, R>(
  effect: E.Effect<A, E, R>,
  options: ToastErrorOptions = {}
): E.Effect<A, E, R> {
  const {
    enableSuccessToast = false,
    enableErrorToast = true,
    successMessage,
    errorPrefix,
    duration = 4000,
    variant = 'filled'
  } = options;

  const toastStore = getToastStore();

  return pipe(
    effect,
    E.tap((result) => {
      if (enableSuccessToast && successMessage) {
        return E.sync(() => {
          toastStore.trigger({
            message: successMessage,
            background: `variant-${variant}-success`,
            timeout: duration
          });
        });
      }
      return E.void;
    }),
    E.tapError((error) => {
      if (enableErrorToast && UIErrorHandling.shouldDisplayToUser(error)) {
        return E.sync(() => {
          let message = UIErrorHandling.formatForUser(error);

          if (errorPrefix) {
            message = `${errorPrefix}: ${message}`;
          }

          toastStore.trigger({
            message,
            background: `variant-${variant}-error`,
            timeout: duration
          });
        });
      }
      return E.void;
    })
  );
}

/**
 * Convenience function that combines error handling with toast notifications
 * for common use cases.
 */
export function withErrorToast<A, E, R>(
  effect: E.Effect<A, E, R>,
  errorMessage?: string
): E.Effect<A, E, R> {
  return withToastNotification(effect, {
    enableErrorToast: true,
    errorPrefix: errorMessage
  });
}

/**
 * Convenience function that shows success and error toasts
 */
export function withSuccessAndErrorToast<A, E, R>(
  effect: E.Effect<A, E, R>,
  successMessage: string,
  errorPrefix?: string
): E.Effect<A, E, R> {
  return withToastNotification(effect, {
    enableSuccessToast: true,
    enableErrorToast: true,
    successMessage,
    errorPrefix
  });
}

/**
 * Advanced toast middleware with custom success/error handlers
 */
export function withCustomToast<A, E, R>(
  effect: E.Effect<A, E, R>,
  handlers: {
    onSuccess?: (result: A) => string | void;
    onError?: (error: E) => string | void;
    variant?: 'filled' | 'ghost' | 'soft';
    duration?: number;
  }
): E.Effect<A, E, R> {
  const { onSuccess, onError, variant = 'filled', duration = 4000 } = handlers;
  const toastStore = getToastStore();

  return pipe(
    effect,
    E.tap((result) => {
      if (onSuccess) {
        const message = onSuccess(result);
        if (message) {
          return E.sync(() => {
            toastStore.trigger({
              message,
              background: `variant-${variant}-success`,
              timeout: duration
            });
          });
        }
      }
      return E.void;
    }),
    E.tapError((error) => {
      if (onError) {
        const message = onError(error);
        if (message) {
          return E.sync(() => {
            toastStore.trigger({
              message,
              background: `variant-${variant}-error`,
              timeout: duration
            });
          });
        }
      } else if (UIErrorHandling.shouldDisplayToUser(error)) {
        // Default error handling
        return E.sync(() => {
          toastStore.trigger({
            message: UIErrorHandling.formatForUser(error),
            background: `variant-${variant}-error`,
            timeout: duration
          });
        });
      }
      return E.void;
    })
  );
}

/**
 * Toast middleware specifically for form operations
 */
export function withFormToast<A, E, R>(
  effect: E.Effect<A, E, R>,
  operation: 'create' | 'update' | 'delete',
  entityType: string
): E.Effect<A, E, R> {
  const operationPastTense = {
    create: 'created',
    update: 'updated',
    delete: 'deleted'
  };

  return withSuccessAndErrorToast(
    effect,
    `${entityType} ${operationPastTense[operation]} successfully`,
    `Failed to ${operation} ${entityType.toLowerCase()}`
  );
}

/**
 * Toast middleware for async operations with loading states
 */
export function withAsyncToast<A, E, R>(
  effect: E.Effect<A, E, R>,
  options: {
    loadingMessage?: string;
    successMessage?: string;
    errorPrefix?: string;
    showLoadingToast?: boolean;
  }
): E.Effect<A, E, R> {
  const { loadingMessage, successMessage, errorPrefix, showLoadingToast = false } = options;

  const toastStore = getToastStore();
  let loadingToastId: string | undefined;

  return pipe(
    E.sync(() => {
      if (showLoadingToast && loadingMessage) {
        loadingToastId = toastStore.trigger({
          message: loadingMessage,
          background: 'variant-ghost-surface',
          autohide: false
        });
      }
    }),
    E.andThen(() => effect),
    E.tap((result) => {
      return E.sync(() => {
        // Close loading toast
        if (loadingToastId) {
          toastStore.close(loadingToastId);
        }

        // Show success toast
        if (successMessage) {
          toastStore.trigger({
            message: successMessage,
            background: 'variant-filled-success'
          });
        }
      });
    }),
    E.tapError((error) => {
      return E.sync(() => {
        // Close loading toast
        if (loadingToastId) {
          toastStore.close(loadingToastId);
        }

        // Show error toast
        if (UIErrorHandling.shouldDisplayToUser(error)) {
          let message = UIErrorHandling.formatForUser(error);
          if (errorPrefix) {
            message = `${errorPrefix}: ${message}`;
          }

          toastStore.trigger({
            message,
            background: 'variant-filled-error'
          });
        }
      });
    })
  );
}
