import { onMount } from 'svelte';
import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
import mediumsOfExchangeStore from '$lib/stores/mediums_of_exchange.store.svelte';
import administrationStore from '$lib/stores/administration.store.svelte';
import { runEffect } from '$lib/utils/effect';

export type PrerequisiteStatus = {
  serviceTypes: boolean;
  mediumsOfExchange: boolean;
  bothAvailable: boolean;
};

export type PrerequisiteAction = {
  label: string;
  href?: string;
  action?: string;
  variant: string;
  primary?: boolean;
};

export type UsePrerequisitesGuardOptions = {
  requireServiceTypes?: boolean;
  requireMediumsOfExchange?: boolean;
  serviceTypesRedirectPath?: string;
  mediumsOfExchangeRedirectPath?: string;
  autoCheck?: boolean;
};

export type UsePrerequisitesGuard = {
  // State
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly prerequisiteStatus: PrerequisiteStatus | null;
  readonly allPrerequisitesMet: boolean;
  readonly isAdmin: boolean;

  // Computed values
  readonly title: string;
  readonly description: string;
  readonly actions: PrerequisiteAction[];
  readonly adminGuidance: string | null;
  readonly missingPrerequisites: string[];

  // Methods
  checkPrerequisites: () => Promise<void>;
  retry: () => Promise<void>;
  reset: () => void;
};

/**
 * Prerequisites Guard Composable
 *
 * Provides reactive prerequisites checking for service types and mediums of exchange
 * with loading states, error handling, and admin guidance.
 *
 * @param options Configuration options
 * @returns UsePrerequisitesGuard interface
 */
export function usePrerequisitesGuard(
  options: UsePrerequisitesGuardOptions = {}
): UsePrerequisitesGuard {
  const { requireServiceTypes = true, requireMediumsOfExchange = true, autoCheck = true } = options;

  // ========================================================================
  // STATE
  // ========================================================================

  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let prerequisiteStatus = $state<PrerequisiteStatus | null>(null);
  let isAdmin = $state(false);

  // ========================================================================
  // DERIVED STATE
  // ========================================================================

  const allPrerequisitesMet = $derived(() => {
    if (!prerequisiteStatus) return false;

    const serviceTypesOk = !requireServiceTypes || prerequisiteStatus.serviceTypes;
    const mediumsOk = !requireMediumsOfExchange || prerequisiteStatus.mediumsOfExchange;

    return serviceTypesOk && mediumsOk;
  });

  const missingPrerequisites = $derived(() => {
    if (!prerequisiteStatus) return [];

    const missing: string[] = [];

    if (requireServiceTypes && !prerequisiteStatus.serviceTypes) {
      missing.push('service types');
    }

    if (requireMediumsOfExchange && !prerequisiteStatus.mediumsOfExchange) {
      missing.push('mediums of exchange');
    }

    return missing;
  });

  const title = $derived(() => {
    if (allPrerequisitesMet()) return 'Prerequisites Met';
    if (missingPrerequisites().length === 0) return 'Checking Prerequisites...';
    return 'Prerequisites Required';
  });

  const description = $derived(() => {
    if (allPrerequisitesMet()) {
      return 'All required prerequisites are available.';
    }

    const missing = missingPrerequisites();
    if (missing.length === 0) {
      return 'Verifying that all required components are available...';
    }

    const missingText = missing.length === 1 ? missing[0] : missing.join(' and ');

    const verb = missing.length === 1 ? 'must be' : 'must be';

    return `${missingText.charAt(0).toUpperCase() + missingText.slice(1)} ${verb} created/approved by administrators before requests and offers can be created.`;
  });

  const actions = $derived((): PrerequisiteAction[] => {
    const actionList: PrerequisiteAction[] = [];

    // Always provide a retry button
    actionList.push({
      label: 'Check Again',
      action: 'retry',
      variant: 'variant-filled-primary',
      primary: true
    });

    // Always provide a way back home
    actionList.push({
      label: 'Back to Home',
      href: '/',
      variant: 'variant-soft-surface'
    });

    return actionList;
  });

  const adminGuidance = $derived(() => {
    if (!isAdmin || allPrerequisitesMet()) return null;

    const guidance: string[] = [];

    if (requireServiceTypes && prerequisiteStatus && !prerequisiteStatus.serviceTypes) {
      guidance.push(`• Create service types from the Admin Service Types page`);
    }

    if (requireMediumsOfExchange && prerequisiteStatus && !prerequisiteStatus.mediumsOfExchange) {
      guidance.push(`• Approve mediums of exchange from the Admin Mediums of Exchange page`);
    }

    if (guidance.length === 0) return null;

    return `As an administrator, you can resolve these issues:\n${guidance.join('\n')}`;
  });

  // ========================================================================
  // HELPER FUNCTIONS
  // ========================================================================

  async function checkServiceTypes(): Promise<boolean> {
    try {
      await runEffect(serviceTypesStore.getApprovedServiceTypes());
      return serviceTypesStore.approvedServiceTypes.length > 0;
    } catch (err) {
      console.error('Failed to check service types:', err);
      return false;
    }
  }

  async function checkMediumsOfExchange(): Promise<boolean> {
    try {
      await runEffect(mediumsOfExchangeStore.getApprovedMediumsOfExchange());
      return mediumsOfExchangeStore.approvedMediumsOfExchange.length > 0;
    } catch (err) {
      console.error('Failed to check mediums of exchange:', err);
      return false;
    }
  }

  async function checkAdminStatus(): Promise<boolean> {
    try {
      await runEffect(administrationStore.checkIfAgentIsAdministrator());
      return administrationStore.agentIsAdministrator;
    } catch (err) {
      console.error('Failed to check admin status:', err);
      return false;
    }
  }

  // ========================================================================
  // METHODS
  // ========================================================================

  async function checkPrerequisites(): Promise<void> {
    try {
      isLoading = true;
      error = null;

      // Check all prerequisites in parallel
      const [serviceTypesAvailable, mediumsAvailable, adminStatus] = await Promise.all([
        requireServiceTypes ? checkServiceTypes() : Promise.resolve(true),
        requireMediumsOfExchange ? checkMediumsOfExchange() : Promise.resolve(true),
        checkAdminStatus()
      ]);

      isAdmin = adminStatus;

      prerequisiteStatus = {
        serviceTypes: serviceTypesAvailable,
        mediumsOfExchange: mediumsAvailable,
        bothAvailable: serviceTypesAvailable && mediumsAvailable
      };
    } catch (err) {
      console.error('Failed to check prerequisites:', err);
      error = 'Failed to check prerequisites';
      prerequisiteStatus = {
        serviceTypes: false,
        mediumsOfExchange: false,
        bothAvailable: false
      };
    } finally {
      isLoading = false;
    }
  }

  async function retry(): Promise<void> {
    await checkPrerequisites();
  }

  function reset(): void {
    isLoading = false;
    error = null;
    prerequisiteStatus = null;
    isAdmin = false;
  }

  // ========================================================================
  // LIFECYCLE
  // ========================================================================

  // Auto-check on mount if enabled
  if (autoCheck) {
    onMount(() => {
      checkPrerequisites();
    });
  }

  // ========================================================================
  // RETURN INTERFACE
  // ========================================================================

  return {
    // State (readonly)
    get isLoading() {
      return isLoading;
    },
    get error() {
      return error;
    },
    get prerequisiteStatus() {
      return prerequisiteStatus;
    },
    get allPrerequisitesMet() {
      return allPrerequisitesMet();
    },
    get isAdmin() {
      return isAdmin;
    },

    // Computed values (readonly)
    get title() {
      return title();
    },
    get description() {
      return description();
    },
    get actions() {
      return actions();
    },
    get adminGuidance() {
      return adminGuidance();
    },
    get missingPrerequisites() {
      return missingPrerequisites();
    },

    // Methods
    checkPrerequisites,
    retry,
    reset
  };
}
