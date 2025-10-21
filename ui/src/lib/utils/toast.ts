import { getToastStore, type ToastStore } from '@skeletonlabs/skeleton';

let toastStore: ToastStore;

export function initializeToast() {
  toastStore = getToastStore();
}

export function showToast(message: string, type: 'success' | 'error' = 'success', timeout = 5000) {
  if (!toastStore) {
    console.error(
      'Toast not initialized. Make sure to call initializeToast() in a root component.'
    );
    return;
  }

  toastStore.trigger({
    message,
    background: type === 'success' ? 'variant-filled-success' : 'variant-filled-error',
    timeout
  });
}

// Profile-specific toast messages
export function showProfileToast(status: 'missing' | 'pending' | 'rejected' | 'suspended' | 'unknown', action?: string) {
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
    submitted: 'Profile submitted for review. You\'ll receive a notification once approved.'
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
