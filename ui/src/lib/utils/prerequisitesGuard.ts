import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
import mediumsOfExchangeStore from '$lib/stores/mediums_of_exchange.store.svelte';
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
 * Checks if approved mediums of exchange are available in the system.
 * This is useful for conditionally showing/hiding create buttons for requests and offers.
 *
 * @returns Promise<boolean> - true if approved MoE exist, false otherwise
 */
export async function checkMediumsOfExchangeAvailable(): Promise<boolean> {
  try {
    await runEffect(mediumsOfExchangeStore.getApprovedMediumsOfExchange());
    return mediumsOfExchangeStore.approvedMediumsOfExchange.length > 0;
  } catch (error) {
    console.error('Failed to check mediums of exchange availability:', error);
    return false; // Assume no MoE on error
  }
}

/**
 * Checks if both prerequisites (service types and mediums of exchange) are available.
 * This provides a comprehensive check for request/offer creation readiness.
 *
 * @returns Promise<{serviceTypes: boolean, mediumsOfExchange: boolean, bothAvailable: boolean}>
 */
export async function checkAllPrerequisitesAvailable(): Promise<{
  serviceTypes: boolean;
  mediumsOfExchange: boolean;
  bothAvailable: boolean;
}> {
  const [serviceTypes, mediumsOfExchange] = await Promise.all([
    checkServiceTypesAvailable(),
    checkMediumsOfExchangeAvailable()
  ]);

  return {
    serviceTypes,
    mediumsOfExchange,
    bothAvailable: serviceTypes && mediumsOfExchange
  };
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

/**
 * Gets a user-friendly message for when mediums of exchange are not available.
 *
 * @param entityType - 'request' or 'offer'
 * @returns string - message to display to user
 */
export function getNoMediumsOfExchangeMessage(entityType: 'request' | 'offer'): string {
  return `Mediums of exchange must be approved by administrators before ${entityType}s can be created.`;
}

/**
 * Gets a comprehensive message when prerequisites are missing.
 *
 * @param prerequisites - result from checkAllPrerequisitesAvailable()
 * @param entityType - 'request' or 'offer'
 * @returns string - message to display to user
 */
export function getPrerequisitesMessage(
  prerequisites: { serviceTypes: boolean; mediumsOfExchange: boolean },
  entityType: 'request' | 'offer'
): string {
  const missing = [];

  if (!prerequisites.serviceTypes) {
    missing.push('service types');
  }

  if (!prerequisites.mediumsOfExchange) {
    missing.push('mediums of exchange');
  }

  if (missing.length === 0) {
    return '';
  }

  const missingText = missing.length === 1 ? missing[0] : missing.join(' and ');
  const verb = missing.length === 1 ? 'must be' : 'must be';

  return `${missingText.charAt(0).toUpperCase() + missingText.slice(1)} ${verb} created/approved by administrators before ${entityType}s can be created.`;
}
