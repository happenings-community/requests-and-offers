/* eslint-disable @typescript-eslint/no-explicit-any */
import type { UIOrganization, UIUser } from '$lib/types/ui';
import type { Record } from '@holochain/client';
import { decode } from '@msgpack/msgpack';
import { type ModalSettings, type ModalStore } from '@skeletonlabs/skeleton';

export { showToast } from './toast';

/**
 * Decodes the outputs from the records.
 * @param {Record[]} records - The records to decode.
 * @returns {T[]} The decoded outputs.
 */
export function decodeRecords<T>(records: Record[]): T[] {
  return records.map((r) => decode((r.entry as any).Present.entry)) as T[];
}

/**
 * Decodes the outputs from the records.
 * @param {Record[]} records - The records to decode.
 * @returns {T[]} The decoded outputs.
 */
export function decodeRecord<T>(record: Record): T {
  return decode((record.entry as any).Present.entry) as T;
}

/**
 * Fetches an image from the specified URL and converts it to a Uint8Array.
 *
 * @param {string} url - The URL of the image to fetch.
 * @return {Promise<Uint8Array>} A promise that resolves to a Uint8Array containing the image data.
 */
export async function fetchImageAndConvertToUInt8Array(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  const blob = await response.blob();
  const buffer = await blob.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Formats a date object into a readable string format.
 *
 * @param {Date} date - The date to format.
 * @param {Intl.DateTimeFormatOptions} options - Optional formatting options.
 * @returns {string} The formatted date string.
 */
export function formatDate(
  date: Date,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }
): string {
  return new Intl.DateTimeFormat('en-US', options).format(date);
}

/**
 * Generates a random number between the specified minimum and maximum values (inclusive).
 *
 * @param {number} min - The minimum value for the random number.
 * @param {number} max - The maximum value for the random number.
 * @return {number} The randomly generated number.
 */
export function getRandomNumber(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Adds a new modal to the queue and reverses the order of the existing modals, so that the new one is shown first.
 *
 * @param {ModalSettings} modalSettings - The settings for the new modal.
 * @param {ModalStore} modalStore - The modal store to update.
 */
export function queueAndReverseModal(modalSettings: ModalSettings, modalStore: ModalStore) {
  modalStore.trigger(modalSettings);
  modalStore.update((modals) => modals.reverse());
}

/**
 * Returns the URL of the user's picture, or a default avatar URL if the user doesn't have a picture.
 *
 * @param {UIUser} user - The user to get the picture for.
 * @return {string} The URL of the picture.
 */
export function getUserPictureUrl(user: UIUser): string {
  return user?.picture
    ? URL.createObjectURL(new Blob([new Uint8Array(user.picture)]))
    : '/default_avatar.webp';
}

/**
 * Returns the URL of the organization's logo, or a default avatar URL if the organization doesn't have a logo.
 *
 * @param {UIOrganization} organization - The organization to get the logo for.
 * @return {string} The URL of the logo.
 */
export function getOrganizationLogoUrl(organization: UIOrganization): string {
  console.log('organization logo:', organization.location);
  return organization?.logo
    ? URL.createObjectURL(new Blob([new Uint8Array(organization.logo)]))
    : '/default_avatar.webp';
}

/**
 * Creates a debounced version of a function that delays invoking the function until after wait milliseconds have elapsed since the last time the debounced function was invoked.
 *
 * @param {Function} func - The function to debounce.
 * @param {number} wait - The number of milliseconds to delay.
 * @returns {Function} The debounced function.
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Composable version of debounce for Svelte 5 components with cleanup support
 *
 * @param {Function} fn - The function to debounce.
 * @param {Object} options - Configuration options
 * @param {number} options.delay - The number of milliseconds to delay (default: 300)
 * @returns {Function} The debounced function with cleanup method
 */
export function useDebounce<T extends (...args: any[]) => any>(
  fn: T,
  options: { delay?: number } = {}
): T & { cleanup: () => void } {
  const { delay = 300 } = options;

  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  // Create debounced function
  const debouncedFn = ((...args: Parameters<T>) => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }

    const promise = new Promise<ReturnType<T>>((resolve) => {
      timeoutId = setTimeout(() => {
        resolve(fn(...args));
        timeoutId = undefined;
      }, delay);
    });

    return promise;
  }) as T;

  // Cleanup function
  const cleanup = () => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
  };

  return Object.assign(debouncedFn, { cleanup });
}

/**
 * Sanitizes proxy objects (like Svelte 5 runes) for serialization to external APIs
 * @param obj - The object to sanitize
 * @returns A plain JavaScript object/array without proxy wrappers
 */
export function sanitizeForSerialization<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeForSerialization(item)) as T;
  }

  if (obj instanceof Uint8Array || obj instanceof ArrayBuffer) {
    return obj; // Keep binary data as-is
  }

  if (typeof obj === 'object') {
    const sanitized = {} as T;
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key as keyof T] = sanitizeForSerialization(value);
    }
    return sanitized;
  }

  return obj;
}

/**
 * Simple sanitization using spread operator for shallow objects/arrays
 * @param obj - The object to sanitize
 * @returns A shallow copy without proxy wrappers
 */
export function sanitizeShallow<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return [...obj] as T;
  }

  if (obj && typeof obj === 'object') {
    return { ...obj } as T;
  }

  return obj;
}
