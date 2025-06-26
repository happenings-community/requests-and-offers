import { getModalStore } from '@skeletonlabs/skeleton';
import { Effect as E, pipe } from 'effect';
import type {
  UseModalOptions,
  UseModalActions,
  ConfirmOptions,
  ConfirmModalMeta,
  UseToastActions
} from '$lib/types/ui';
import ConfirmModal from '$lib/components/shared/dialogs/ConfirmModal.svelte';
import { showToast } from './index';

/**
 * Modal management composable for consistent modal handling
 * @param options Configuration options for modal behavior
 * @returns Modal actions (open, close, confirm)
 */
export function useModal(options: UseModalOptions = {}): UseModalActions {
  const modalStore = getModalStore();

  const { autoFocus = true, closeOnEscape = true, closeOnOutsideClick = true } = options;

  // Open a modal with a component
  const open = (component: any, props: Record<string, unknown> = {}): Promise<unknown> => {
    return new Promise((resolve) => {
      modalStore.trigger({
        type: 'component',
        component: { ref: component, props },
        response: (result: unknown) => resolve(result)
      });
    });
  };

  // Close the current modal
  const close = (result?: unknown): void => {
    modalStore.close();
  };

  // Show a confirmation dialog using Effect pattern
  const confirmEffect = (
    message: string,
    options: ConfirmOptions = {}
  ): E.Effect<boolean, never> => {
    const { confirmLabel = 'Confirm', cancelLabel = 'Cancel', variant = 'info' } = options;

    return E.promise<boolean>(
      () =>
        new Promise((resolve) => {
          modalStore.trigger({
            type: 'component',
            component: { ref: ConfirmModal },
            meta: {
              id: crypto.randomUUID(),
              message,
              confirmLabel,
              cancelLabel
            } as ConfirmModalMeta,
            response: (confirmed: boolean) => resolve(confirmed)
          });
        })
    );
  };

  // Public confirm function that runs the Effect
  const confirm = async (message: string, options: ConfirmOptions = {}): Promise<boolean> => {
    return E.runPromise(confirmEffect(message, options));
  };

  return {
    open,
    close,
    confirm
  };
}

/**
 * Toast notification composable for consistent toast handling
 * @returns Toast actions (show, success, error, warning, info)
 */
export function useToast(): UseToastActions {
  // Show a toast message with optional type
  const show = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info'): void => {
    // Map warning/info to the supported types in the existing util
    const effectiveType = type === 'warning' || type === 'info' ? 'success' : type;
    showToast(message, effectiveType);
  };

  // Convenience methods for different toast types
  const success = (message: string): void => {
    show(message, 'success');
  };

  const error = (message: string): void => {
    show(message, 'error');
  };

  const warning = (message: string): void => {
    show(message, 'warning');
  };

  const info = (message: string): void => {
    show(message, 'info');
  };

  return {
    show,
    success,
    error,
    warning,
    info
  };
}
