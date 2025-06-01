import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
import { runEffect } from '$lib/utils/effect';

/**
 * Checks if service types are available in the system.
 * This is useful for conditionally showing/hiding create buttons for requests and offers.
 *
 * @returns Promise<boolean> - true if service types exist, false otherwise
 */
export async function checkServiceTypesAvailable(): Promise<boolean> {
  try {
    await runEffect(serviceTypesStore.getAllServiceTypes());
    return serviceTypesStore.serviceTypes.length > 0;
  } catch (error) {
    console.error('Failed to check service types availability:', error);
    return false; // Assume no service types on error
  }
}

/**
 * Gets a user-friendly message for when service types are not available.
 *
 * @param entityType - 'request' or 'offer'
 * @returns string - message to display to user
 */
export function getNoServiceTypesMessage(entityType: 'request' | 'offer'): string {
  return `Service types must be created by administrators before ${entityType}s can be created.`;
}
