import { getToastStore, type ToastSettings, type ToastStore } from '@skeletonlabs/skeleton';
import { escapeHtml } from '$lib/utils/safe-html';

let toastStore: ToastStore;

/**
 * Skeleton's Toast renders a toast's message and action label as HTML
 * (`{@html t.message}` in Toast.svelte), and messages often carry text from the
 * network: a zome error, a member's name, a listing's title. So every toast is
 * escaped on its way in. No toast in the app uses markup on purpose.
 */
export function escapeToast(settings: ToastSettings): ToastSettings {
  return {
    ...settings,
    message: escapeHtml(settings.message),
    ...(settings.action
      ? { action: { ...settings.action, label: escapeHtml(settings.action.label) } }
      : {})
  };
}

const ESCAPED = Symbol('toast-escaped');

/**
 * Makes `trigger` escape what it is given. Every component's `getToastStore()`
 * returns this same store from context, so doing it once here covers the calls
 * that use the store directly as well as `showToast`. Safe to call twice.
 */
export function escapeToasts(store: ToastStore): ToastStore {
  const marked = store as ToastStore & { [ESCAPED]?: true };
  if (marked[ESCAPED]) return store;
  const trigger = store.trigger.bind(store);
  store.trigger = (settings: ToastSettings) => trigger(escapeToast(settings));
  marked[ESCAPED] = true;
  return store;
}

export function initializeToast() {
  toastStore = escapeToasts(getToastStore());
}

export function showToast(
  message: string,
  type: 'success' | 'error' = 'success',
  timeout = 5000,
  action?: { label: string; response: () => void }
) {
  if (!toastStore) {
    console.error(
      'Toast not initialized. Make sure to call initializeToast() in a root component.'
    );
    return;
  }

  toastStore.trigger({
    message,
    background: type === 'success' ? 'variant-filled-success' : 'variant-filled-error',
    timeout,
    ...(action ? { action } : {})
  });
}

// Profile-specific toast messages
export function showProfileToast(
  status: 'missing' | 'pending' | 'rejected' | 'suspended' | 'unknown',
  action?: string
) {
  if (!toastStore) {
    console.error(
      'Toast not initialized. Make sure to call initializeToast() in a root component.'
    );
    return;
  }

  const messages = {
    missing: `Please create a profile to ${action || 'perform this action'}`,
    pending: `Your profile is pending approval. You'll be notified once it's reviewed.`,
    rejected: `Your profile has been rejected. Please contact administrators for assistance.`,
    suspended: `Your profile has been suspended. Please contact support for details.`,
    unknown: `Profile status unknown. Please contact support for assistance.`
  };

  const backgrounds = {
    missing: 'variant-filled-warning',
    pending: 'variant-filled-warning',
    rejected: 'variant-filled-error',
    suspended: 'variant-filled-error',
    unknown: 'variant-filled-error'
  };

  toastStore.trigger({
    message: messages[status],
    background: backgrounds[status],
    timeout: 6000
  });
}

export function showProfileActionToast(status: 'created' | 'updated' | 'submitted') {
  if (!toastStore) {
    console.error(
      'Toast not initialized. Make sure to call initializeToast() in a root component.'
    );
    return;
  }

  const messages = {
    created: 'Profile created successfully! Please wait for administrator approval.',
    updated: 'Profile updated successfully!',
    submitted: "Profile submitted for review. You'll receive a notification once approved."
  };

  toastStore.trigger({
    message: messages[status],
    background: 'variant-filled-success',
    timeout: 5000
  });
}

export function showAccessDeniedToast(feature: string, profileStatus: string) {
  if (!toastStore) {
    console.error(
      'Toast not initialized. Make sure to call initializeToast() in a root component.'
    );
    return;
  }

  toastStore.trigger({
    message: `Access denied: ${feature}. Profile status: ${profileStatus}`,
    background: 'variant-filled-error',
    timeout: 5000
  });
}
