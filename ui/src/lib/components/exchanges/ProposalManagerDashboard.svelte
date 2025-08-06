<script lang="ts">
  import { useExchangeProposalsManagement } from '$lib/composables/domain/exchanges';
  import { formatDate } from '$lib/utils';
  import { encodeHashToBase64, decodeHashFromBase64 } from '@holochain/client';
  import type { ProposalStatus } from '$lib/schemas/exchanges.schemas';
  import type { UIExchangeProposal } from '$lib/types/ui';
  import usersStore from '$lib/stores/users.store.svelte';

  // Composables
  const proposalManagement = useExchangeProposalsManagement();
  const { currentUser } = $derived(usersStore);

  // State
  let isInitialized = $state(false);

  // Derived state
  const {
    filteredProposals,
    proposalType,
    statusFilter,
    participantFilter,
    storeLoading,
    storeError,
    pendingProposals,
    acceptedProposals,
    rejectedProposals,
    expiredProposals
  } = $derived(proposalManagement);

  // Initialize on mount
  $effect(() => {
    if (!isInitialized) {
      proposalManagement.initialize();
      isInitialized = true;
    }
  });

  // Status badge styling
  function getStatusClass(status: ProposalStatus): string {
    switch (status) {
      case 'Pending':
        return 'variant-filled-warning';
      case 'Accepted':
        return 'variant-filled-success';
      case 'Rejected':
        return 'variant-filled-error';
      case 'Expired':
        return 'variant-filled-surface';
      default:
        return 'variant-filled-surface';
    }
  }

  function getStatusIcon(status: ProposalStatus): string {
    switch (status) {
      case 'Pending':
        return 'hourglass_empty';
      case 'Accepted':
        return 'check_circle';
      case 'Rejected':
        return 'cancel';
      case 'Expired':
        return 'schedule';
      default:
        return 'help';
    }
  }

  function getProposalTypeIcon(type: 'DirectResponse' | 'CrossLink'): string {
    return type === 'DirectResponse' ? 'reply' : 'link';
  }

  function getProposalTypeClass(type: 'DirectResponse' | 'CrossLink'): string {
    return type === 'DirectResponse' ? 'variant-soft-primary' : 'variant-soft-secondary';
  }

  // Filter handlers
  function handleStatusFilterChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    proposalManagement.setStatusFilter(target.value as ProposalStatus | 'all');
  }

  function handleTypeFilterChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    proposalManagement.setProposalTypeFilter(
      target.value as 'DirectResponse' | 'CrossLink' | 'all'
    );
  }

  function handleParticipantFilterChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    proposalManagement.setParticipantFilter(target.value as 'all' | 'my' | 'received' | 'sent');
  }

  function handleRefresh() {
    proposalManagement.refreshProposals();
  }

  // Proposal actions
  async function handleAcceptProposal(proposalHashBase64: string) {
    try {
      const proposalHash = decodeHashFromBase64(proposalHashBase64);
      await proposalManagement.acceptProposal(proposalHash);
    } catch (error) {
      console.error('Failed to accept proposal:', error);
    }
  }

  async function handleRejectProposal(proposalHashBase64: string, reason?: string) {
    try {
      const proposalHash = decodeHashFromBase64(proposalHashBase64);
      await proposalManagement.rejectProposal(proposalHash, reason);
    } catch (error) {
      console.error('Failed to reject proposal:', error);
    }
  }

  async function handleDeleteProposal(proposalHashBase64: string) {
    try {
      const proposalHash = decodeHashFromBase64(proposalHashBase64);
      await proposalManagement.deleteProposal(proposalHash);
    } catch (error) {
      console.error('Failed to delete proposal:', error);
    }
  }

  // Check if user can manage proposal
  function canUserManageProposal(proposal: UIExchangeProposal): boolean {
    // Users can manage proposals they created or received
    return (
      proposal.creator?.toString() === currentUser?.original_action_hash?.toString() ||
      proposal.target_entity_hash?.toString() === currentUser?.original_action_hash?.toString()
    );
  }

  // Determine if user is the recipient of the proposal
  function isProposalRecipient(proposal: UIExchangeProposal): boolean {
    // This would need to check against the target entity (request/offer) creator
    // For now, simplified logic
    return proposal.creator?.toString() !== currentUser?.original_action_hash?.toString();
  }
</script>

<div class="space-y-6">
  <!-- Header -->
  <header class="flex items-center justify-between">
    <div>
      <h1 class="h2 font-bold">Exchange Proposals</h1>
      <p class="text-surface-600 dark:text-surface-300">
        Manage your sent and received exchange proposals
      </p>
    </div>
    <button class="variant-filled-primary btn" onclick={handleRefresh} disabled={storeLoading}>
      <span class="material-symbols-outlined">refresh</span>
    </button>
  </header>

  <!-- Quick Stats -->
  <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
    <div class="variant-soft-warning card p-4 text-center">
      <div class="text-2xl font-bold">{pendingProposals.length}</div>
      <div class="text-sm">Pending</div>
    </div>
    <div class="variant-soft-success card p-4 text-center">
      <div class="text-2xl font-bold">{acceptedProposals.length}</div>
      <div class="text-sm">Accepted</div>
    </div>
    <div class="variant-soft-error card p-4 text-center">
      <div class="text-2xl font-bold">{rejectedProposals.length}</div>
      <div class="text-sm">Rejected</div>
    </div>
    <div class="variant-soft-surface card p-4 text-center">
      <div class="text-2xl font-bold">{expiredProposals.length}</div>
      <div class="text-sm">Expired</div>
    </div>
  </div>

  <!-- Filters -->
  <div class="card space-y-4 p-4">
    <h3 class="h4 font-semibold">Filter Proposals</h3>
    <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
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
          <option value="Pending">Pending</option>
          <option value="Accepted">Accepted</option>
          <option value="Rejected">Rejected</option>
          <option value="Expired">Expired</option>
        </select>
      </div>

      <!-- Type Filter -->
      <div>
        <label class="label" for="type-filter">
          <span>Type</span>
        </label>
        <select
          id="type-filter"
          class="select"
          value={proposalType}
          onchange={handleTypeFilterChange}
        >
          <option value="all">All Types</option>
          <option value="DirectResponse">Direct Response</option>
          <option value="CrossLink">Cross-Link</option>
        </select>
      </div>

      <!-- Participant Filter -->
      <div>
        <label class="label" for="participant-filter">
          <span>Participation</span>
        </label>
        <select
          id="participant-filter"
          class="select"
          value={participantFilter}
          onchange={handleParticipantFilterChange}
        >
          <option value="all">All Proposals</option>
          <option value="my">Created by Me</option>
          <option value="received">Received from Others</option>
          <option value="sent">Sent by Me</option>
        </select>
      </div>
    </div>

    <!-- Clear Filters -->
    <button
      class="variant-ghost-surface btn-sm btn"
      onclick={() => proposalManagement.clearAllFilters()}
    >
      Clear Filters
    </button>
  </div>

  <!-- Loading State -->
  {#if storeLoading}
    <div class="flex items-center justify-center p-8">
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined animate-spin">hourglass_empty</span>
        <span>Loading proposals...</span>
      </div>
    </div>
  {:else if storeError}
    <!-- Error State -->
    <div class="variant-filled-error alert">
      <span class="material-symbols-outlined">error</span>
      <span>Error loading proposals: {storeError}</span>
    </div>
  {:else if filteredProposals.length === 0}
    <!-- Empty State -->
    <div class="card flex flex-col items-center justify-center p-12 text-center">
      <span class="material-symbols-outlined text-surface-400 mb-4 text-6xl">assignment</span>
      <h3 class="h3 mb-2 font-semibold">No Proposals Found</h3>
      <p class="text-surface-600 dark:text-surface-300 mb-4">
        {statusFilter === 'all' && proposalType === 'all' && participantFilter === 'all'
          ? "You don't have any exchange proposals yet."
          : 'No proposals match your current filters.'}
      </p>
      <div class="flex gap-2">
        <a href="/requests" class="variant-filled-primary btn">
          <span>Browse Requests</span>
        </a>
        <a href="/offers" class="variant-filled-secondary btn">
          <span>Browse Offers</span>
        </a>
      </div>
    </div>
  {:else}
    <!-- Proposals List -->
    <div class="space-y-4">
      {#each filteredProposals as proposal (proposal.original_action_hash)}
        <div class="card p-6">
          <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <!-- Proposal Info -->
            <div class="flex-grow space-y-3">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="h4 font-semibold">{proposal.service_details}</h3>

                <!-- Type Badge -->
                <span class="chip {getProposalTypeClass(proposal.proposal_type)}">
                  <span class="material-symbols-outlined">
                    {getProposalTypeIcon(proposal.proposal_type)}
                  </span>
                  <span
                    >{proposal.proposal_type === 'DirectResponse'
                      ? 'Direct Response'
                      : 'Cross-Link'}</span
                  >
                </span>

                <!-- Status Badge -->
                <span class="chip {getStatusClass(proposal.status)}">
                  <span class="material-symbols-outlined">
                    {getStatusIcon(proposal.status)}
                  </span>
                  <span>{proposal.status}</span>
                </span>
              </div>

              <p class="text-surface-600 dark:text-surface-300">
                <strong>Terms:</strong>
                {proposal.terms}
              </p>

              <div class="flex flex-wrap gap-2">
                <!-- Exchange Medium -->
                <div class="chip variant-soft-tertiary">
                  <span class="material-symbols-outlined">currency_exchange</span>
                  <span>{proposal.exchange_medium}</span>
                </div>

                <!-- Exchange Value -->
                {#if proposal.exchange_value}
                  <div class="chip variant-soft-warning">
                    <span class="material-symbols-outlined">payments</span>
                    <span>{proposal.exchange_value}</span>
                  </div>
                {/if}

                <!-- Delivery Timeframe -->
                {#if proposal.delivery_timeframe}
                  <div class="chip variant-soft-surface">
                    <span class="material-symbols-outlined">schedule</span>
                    <span>{proposal.delivery_timeframe}</span>
                  </div>
                {/if}
              </div>

              <!-- Additional Notes -->
              {#if proposal.notes}
                <div class="variant-soft-surface rounded-container-token p-3">
                  <p class="text-sm"><strong>Notes:</strong> {proposal.notes}</p>
                </div>
              {/if}

              <!-- Timestamps -->
              <div class="text-surface-500 text-sm">
                <span>Created: {formatDate(new Date(Number(proposal.created_at)))}</span>
                {#if proposal.expires_at}
                  <span class="ml-4">
                    Expires: {formatDate(new Date(Number(proposal.expires_at)))}
                  </span>
                {/if}
                {#if proposal.updated_at && proposal.updated_at !== proposal.created_at}
                  <span class="ml-4">
                    Updated: {formatDate(new Date(Number(proposal.updated_at)))}
                  </span>
                {/if}
              </div>
            </div>

            <!-- Actions -->
            {#if proposal.original_action_hash}
              <div class="flex flex-col gap-2 md:items-end">
                <!-- View Details -->
                <a
                  href="/exchanges/proposals/{encodeHashToBase64(proposal.original_action_hash)}"
                  class="variant-filled-primary btn-sm btn"
                >
                  <span class="material-symbols-outlined">visibility</span>
                  <span>View Details</span>
                </a>

                <!-- Status-specific Actions -->
                {#if proposal.status === 'Pending' && canUserManageProposal(proposal)}
                  {#if isProposalRecipient(proposal)}
                    <!-- Recipient can accept/reject -->
                    <button
                      class="variant-filled-success btn-sm btn"
                      onclick={() =>
                        handleAcceptProposal(encodeHashToBase64(proposal.original_action_hash!))}
                    >
                      <span class="material-symbols-outlined">check_circle</span>
                      <span>Accept</span>
                    </button>
                    <button
                      class="variant-filled-error btn-sm btn"
                      onclick={() =>
                        handleRejectProposal(
                          encodeHashToBase64(proposal.original_action_hash!),
                          'Declined by recipient'
                        )}
                    >
                      <span class="material-symbols-outlined">cancel</span>
                      <span>Reject</span>
                    </button>
                  {:else}
                    <!-- Creator can delete pending proposals -->
                    <button
                      class="variant-filled-surface btn-sm btn"
                      onclick={() =>
                        handleDeleteProposal(encodeHashToBase64(proposal.original_action_hash!))}
                    >
                      <span class="material-symbols-outlined">delete</span>
                      <span>Delete</span>
                    </button>
                  {/if}
                {/if}

                <!-- Role indicator -->
                <div class="text-surface-500 text-sm">
                  <span class="chip variant-soft-{isProposalRecipient(proposal) ? 'secondary' : 'primary'}">
                    {isProposalRecipient(proposal) ? '📥 Received' : '📤 Sent by You'}
                  </span>
                </div>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
