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
