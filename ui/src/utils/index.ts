/* eslint-disable @typescript-eslint/no-explicit-any */
import type { UIOrganization, UIUser } from '@/types/ui';
import type { Record } from '@holochain/client';
import { decode } from '@msgpack/msgpack';
import { type ModalSettings, type ModalStore } from '@skeletonlabs/skeleton';

/**
 * Decodes the outputs from the records.
 * @param {Record[]} records - The records to decode.
 * @returns {T[]} - The decoded outputs.
 */
export function decodeRecords<T>(records: Record[]): T[] {
  return records.map((r) => decode((r.entry as any).Present.entry)) as T[];
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
 * Generates a random number between the specified minimum and maximum values (inclusive).
 *
 * @param {number} min - The minimum value for the random number.
 * @param {number} max - The maximum value for the random number.
 * @return {number} The randomly generated number.
 */
export function getRandomNumber(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function queueAndReverseModal(modalSettings: ModalSettings, modalStore: ModalStore) {
  modalStore.trigger(modalSettings);
  modalStore.update((modals) => modals.reverse());
}

// Get user picture URL
export function getUserPictureUrl(user: UIUser): string {
  return user?.picture
    ? URL.createObjectURL(new Blob([new Uint8Array(user.picture)]))
    : '/default_avatar.webp';
}

// Get organization logo URL
export function getOrganizationLogoUrl(organization: UIOrganization): string {
  console.log('organization logo:', organization.location);
  return organization?.logo
    ? URL.createObjectURL(new Blob([new Uint8Array(organization.logo)]))
    : '/default_avatar.webp';
}
