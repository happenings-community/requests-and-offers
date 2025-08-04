<script lang="ts">
  import { useExchangeAgreementManagement } from '$lib/composables/domain/exchanges';
  import { formatDate } from '$lib/utils';
  import { encodeHashToBase64 } from '@holochain/client';
  import type { AgreementStatus } from '$lib/schemas/exchanges.schemas';
  import type { UIAgreement } from '$lib/types/ui';

  // Composables
  const agreementManagement = useExchangeAgreementManagement();

  // State
  let isInitialized = $state(false);

  // Derived state
  const { filteredAgreements, statusFilter, roleFilter, storeLoading, storeError } =
    $derived(agreementManagement);

  // Initialize on mount
  $effect(() => {
    if (!isInitialized) {
      agreementManagement.initialize();
      isInitialized = true;
    }
  });

  // Status badge styling
  function getStatusClass(status: AgreementStatus): string {
    switch (status) {
      case 'Active':
        return 'variant-filled-primary';
      case 'InProgress':
        return 'variant-filled-warning';
      case 'Completed':
        return 'variant-filled-success';
      case 'CancelledMutual':
      case 'CancelledProvider':
      case 'CancelledReceiver':
        return 'variant-filled-surface';
      case 'Failed':
      case 'Disputed':
        return 'variant-filled-error';
      default:
        return 'variant-filled-surface';
    }
  }

  function getStatusIcon(status: AgreementStatus): string {
    switch (status) {
      case 'Active':
        return 'play_circle';
      case 'InProgress':
        return 'timelapse';
      case 'Completed':
        return 'check_circle';
      case 'CancelledMutual':
      case 'CancelledProvider':
      case 'CancelledReceiver':
        return 'cancel';
      case 'Failed':
        return 'error';
      case 'Disputed':
        return 'gavel';
      default:
        return 'help';
    }
  }

  function getRoleBadgeClass(isProvider: boolean): string {
    return isProvider ? 'variant-soft-primary' : 'variant-soft-secondary';
  }

  function getRoleIcon(isProvider: boolean): string {
    return isProvider ? 'business_center' : 'person';
  }

  function handleStatusFilterChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    agreementManagement.setStatusFilter(target.value as AgreementStatus | 'all');
  }

  function handleRoleFilterChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    agreementManagement.setRoleFilter(target.value as 'provider' | 'receiver' | 'all');
  }

  function handleRefresh() {
    agreementManagement.refreshAgreements();
  }
</script>

<div class="space-y-6">
  <!-- Header -->
  <header class="flex items-center justify-between">
    <div>
      <h1 class="h2 font-bold">Exchange Agreements</h1>
      <p class="text-surface-600 dark:text-surface-300">
        Track your active exchanges and agreements
      </p>
    </div>
    <button class="variant-filled-primary btn" onclick={handleRefresh} disabled={storeLoading}>
      <span>Refresh</span>
    </button>
  </header>

  <!-- Filters -->
  <div class="card space-y-4 p-4">
    <h3 class="h4 font-semibold">Filter Agreements</h3>
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <!-- Status Filter -->
      <div>
        <label class="label" for="status-filter">
          <span>Status</span>
        </label>
        <select
          id="status-filter"
          class="select"
          value={statusFilter}
          onchange={handleStatusFilterChange}
        >
          <option value="all">All Status</option>
          <option value="Active">Active</option>
          <option value="InProgress">In Progress</option>
          <option value="Completed">Completed</option>
          <option value="CancelledMutual">Cancelled (Mutual)</option>
          <option value="CancelledProvider">Cancelled (Provider)</option>
          <option value="CancelledReceiver">Cancelled (Receiver)</option>
          <option value="Failed">Failed</option>
          <option value="Disputed">Disputed</option>
        </select>
      </div>

      <!-- Role Filter -->
      <div>
        <label class="label" for="role-filter">
          <span>Your Role</span>
        </label>
        <select
          id="role-filter"
          class="select"
          value={roleFilter}
          onchange={handleRoleFilterChange}
        >
          <option value="all">All Roles</option>
          <option value="provider">Provider</option>
          <option value="receiver">Receiver</option>
        </select>
      </div>
    </div>

    <!-- Clear Filters -->
    <button
      class="variant-ghost-surface btn-sm btn"
      onclick={() => agreementManagement.clearAllFilters()}
    >
      Clear Filters
    </button>
  </div>

  <!-- Loading State -->
  {#if storeLoading}
    <div class="flex items-center justify-center p-8">
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined animate-spin">hourglass_empty</span>
        <span>Loading agreements...</span>
      </div>
    </div>
  {:else if storeError}
    <!-- Error State -->
    <div class="variant-filled-error alert">
      <span class="material-symbols-outlined">error</span>
      <span>Error loading agreements: {storeError}</span>
    </div>
  {:else if filteredAgreements.length === 0}
    <!-- Empty State -->
    <div class="card flex flex-col items-center justify-center p-12 text-center">
      <span class="material-symbols-outlined text-surface-400 mb-4 text-6xl">handshake</span>
      <h3 class="h3 mb-2 font-semibold">No Agreements Found</h3>
      <p class="text-surface-600 dark:text-surface-300 mb-4">
        {statusFilter === 'all' && roleFilter === 'all'
          ? "You don't have any exchange agreements yet."
          : 'No agreements match your current filters.'}
      </p>
      <a href="/requests" class="variant-filled-primary btn">
        <span>Browse Requests</span>
      </a>
    </div>
  {:else}
    <!-- Agreements List -->
    <div class="space-y-4">
      {#each filteredAgreements as agreement (agreement.original_action_hash)}
        <div class="card p-6">
          <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <!-- Agreement Info -->
            <div class="flex-grow space-y-2">
              <div class="flex items-center gap-3">
                <h3 class="h4 font-semibold">{agreement.service_details}</h3>
                <span class="chip {getStatusClass(agreement.status)}">
                  <span class="material-symbols-outlined">
                    {getStatusIcon(agreement.status)}
                  </span>
                  <span>{agreement.status}</span>
                </span>
              </div>

              <p class="text-surface-600 dark:text-surface-300">
                {agreement.agreed_terms}
              </p>

              <div class="flex flex-wrap gap-2">
                <!-- Exchange Medium -->
                <div class="chip variant-soft-tertiary">
                  <span class="material-symbols-outlined">currency_exchange</span>
                  <span>{agreement.exchange_medium}</span>
                </div>

                <!-- Exchange Value -->
                {#if agreement.exchange_value}
                  <div class="chip variant-soft-warning">
                    <span class="material-symbols-outlined">payments</span>
                    <span>{agreement.exchange_value}</span>
                  </div>
                {/if}

                <!-- Delivery Timeframe -->
                {#if agreement.delivery_timeframe}
                  <div class="chip variant-soft-surface">
                    <span class="material-symbols-outlined">schedule</span>
                    <span>{agreement.delivery_timeframe}</span>
                  </div>
                {/if}
              </div>

              <!-- Dates -->
              <div class="text-surface-500 text-sm">
                <span>Created: {formatDate(new Date(Number(agreement.created_at)))}</span>
                {#if agreement.start_date}
                  <span class="ml-4">
                    Started: {formatDate(new Date(Number(agreement.start_date)))}
                  </span>
                {/if}
                {#if agreement.completion_date}
                  <span class="ml-4">
                    Completed: {formatDate(new Date(Number(agreement.completion_date)))}
                  </span>
                {/if}
              </div>
            </div>

            <!-- Actions -->
            <div class="flex flex-col gap-2 md:items-end">
              <!-- Role Badge -->
              {#each [agreementManagement.getUserRoleInAgreement(agreement)] as userRole}
                {#if userRole !== 'none'}
                  <div class="chip {getRoleBadgeClass(userRole === 'provider')}">
                    <span class="material-symbols-outlined">
                      {getRoleIcon(userRole === 'provider')}
                    </span>
                    <span>{userRole === 'provider' ? 'Provider' : 'Receiver'}</span>
                  </div>
                {/if}
              {/each}

              <!-- View Details Button -->
              {#if agreement.original_action_hash}
                <a
                  href="/exchanges/agreements/{encodeHashToBase64(agreement.original_action_hash)}"
                  class="variant-filled-primary btn-sm btn"
                >
                  <span class="material-symbols-outlined">visibility</span>
                  <span>View Details</span>
                </a>
              {/if}

              <!-- Status-specific Actions -->
              {#if agreement.original_action_hash}
                {#if agreement.status === 'Active'}
                  <button
                    class="variant-filled-secondary btn-sm btn"
                    onclick={() =>
                      agreementManagement.updateAgreementStatus(
                        agreement.original_action_hash!,
                        'InProgress'
                      )}
                  >
                    <span class="material-symbols-outlined">play_arrow</span>
                    <span>Start Work</span>
                  </button>
                {:else if agreement.status === 'InProgress'}
                  {#each [agreementManagement.getUserRoleInAgreement(agreement)] as userRole}
                    {#if userRole !== 'none'}
                      <button
                        class="variant-filled-success btn-sm btn"
                        onclick={() =>
                          agreementManagement.validateCompletion(agreement.original_action_hash!, {
                            validator_role: userRole === 'provider' ? 'Provider' : 'Receiver'
                          })}
                      >
                        <span class="material-symbols-outlined">check_circle</span>
                        <span>Mark Complete</span>
                      </button>
                    {/if}
                  {/each}
                {/if}
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
