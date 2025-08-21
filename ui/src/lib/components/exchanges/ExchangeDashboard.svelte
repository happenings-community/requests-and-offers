<!-- ExchangeDashboard.svelte - Main dashboard for managing all exchanges -->
<script lang="ts">
  import {
    Tab,
    TabGroup,
    getModalStore,
    getToastStore,
    type ModalComponent
  } from '@skeletonlabs/skeleton';
  import type { ModalSettings } from '@skeletonlabs/skeleton';
  import { onMount } from 'svelte';
  import { createExchangesStore } from '$lib/stores/exchanges.store.svelte';
  import { useExchangeDetails } from '$lib/composables/domain/exchanges/useExchangeDetails.svelte';
  import { runEffect } from '$lib/utils/effect';

  // UI Components (to be created)
  import ResponsesList from './ResponsesList.svelte';
  import AgreementsList from './AgreementsList.svelte';
  import ReviewsList from './ReviewsList.svelte';
  import ExchangeStatistics from './ExchangeStatistics.svelte';
  import DirectResponseModal from './DirectResponseModal.svelte';
  import usersStore from '$lib/stores/users.store.svelte';

  // Props
  interface Props {
    userId?: string; // Filter by user if provided
  }

  const { userId = undefined }: Props = $props();

  // Stores and composables
  const exchangesStore = createExchangesStore();
  const exchangeDetails = useExchangeDetails();
  const modalStore = getModalStore();
  const toastStore = getToastStore();

  // Get current user for direction detection
  const { currentUser } = $derived(usersStore);
  const currentUserPubkey = $derived(currentUser?.agents?.[0]?.toString());

  // Reactive state
  let tabSet = $state(0);
  let isInitialized = $state(false);

  // Tab configuration
  const tabs = [
    { label: 'All Exchanges', value: 0 },
    { label: 'Proposals', value: 1 },
    { label: 'Active', value: 2 },
    { label: 'Completed', value: 3 },
    { label: 'Reviews', value: 4 }
  ];

  // Computed values
  const responses = () => exchangesStore.responses();
  const pendingResponses = () => exchangesStore.pendingResponses();
  const approvedResponses = () => exchangesStore.approvedResponses();
  const rejectedResponses = () => exchangesStore.rejectedResponses();
  const activeAgreements = () => exchangesStore.activeAgreements();
  const completedAgreements = () => exchangesStore.completedAgreements();
  const reviews = () => exchangesStore.reviews();
  const statistics = () => exchangesStore.reviewStatistics();

  const isLoading = () =>
    exchangesStore.isLoadingResponses() ||
    exchangesStore.isLoadingAgreements() ||
    exchangesStore.isLoadingReviews();

  const hasError = () =>
    exchangesStore.responsesError() ||
    exchangesStore.agreementsError() ||
    exchangesStore.reviewsError();

  // Actions
  const initialize = async () => {
    try {
      console.log('🔄 Initializing Exchange Dashboard...');

      // Fetch different types of responses and agreements
      await Promise.all([
        runEffect(exchangesStore.fetchResponses()), // Outgoing proposals I created
        runEffect(exchangesStore.fetchAgreements()),
        runEffect(exchangesStore.fetchReviews())
      ]);

      console.log(
        `✅ Loaded dashboard data: ${exchangesStore.responses().length} responses, ${exchangesStore.agreements().length} agreements, ${exchangesStore.reviews().length} reviews`
      );

      // Skip statistics fetch entirely to avoid the backend error
      // if (userId) {
      //   try {
      //     await runEffect(exchangesStore.fetchReviewStatistics(userId));
      //     console.log('✅ Loaded review statistics');
      //   } catch (statsError) {
      //     console.warn('Failed to load review statistics, continuing without them:', statsError);
      //   }
      // }

      isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize exchange dashboard:', error);
      isInitialized = true;
    }
  };

  const refreshData = async () => {
    await initialize();
  };

  // Modal component setup
  const directResponseModalComponent: ModalComponent = { ref: DirectResponseModal };

  const openDirectResponseModal = () => {
    const modal: ModalSettings = {
      type: 'component',
      component: directResponseModalComponent,
      title: 'Create Exchange Proposal',
      body: 'Respond to a request or offer with your terms.',
      meta: {
        targetEntityHash: undefined, // TODO: Pass actual target entity when creating proposals for specific requests/offers
        onSuccess: () => {
          console.log('🔄 Exchange proposal created successfully, refreshing dashboard...');
          refreshData();
        }
      }
    };
    modalStore.trigger(modal);
  };

  // Lifecycle
  onMount(() => {
    initialize();
  });

  // Event handlers
  const handleTabChange = (newTab: number) => {
    tabSet = newTab;
  };

  const handleResponseAction = async (action: string, proposalId: string) => {
    let loadingToastId: string | undefined;

    try {
      loadingToastId = toastStore.trigger({
        message: `${action === 'approve' ? 'Approving' : 'Rejecting'} proposal...`,
        background: 'variant-filled-secondary',
        autohide: false,
        hideDismiss: true
      });

      if (action === 'approve') {
        // Update proposal status to 'Approved'
        await runEffect(
          exchangesStore.updateExchangeResponseStatus({
            response_hash: proposalId as any,
            new_status: 'Approved',
            reason: null
          })
        );

        // Create an agreement from the approved proposal
        // Note: In a real implementation, we would fetch proposal details to populate these fields
        await runEffect(
          exchangesStore.createAgreement({
            response_hash: proposalId as any,
            service_details: 'Service details from response',
            exchange_medium: 'Medium from response',
            exchange_value: null,
            delivery_timeframe: null
          })
        );

        toastStore.trigger({
          message: 'Response approved and agreement created successfully!',
          background: 'variant-filled-success'
        });
      } else if (action === 'reject') {
        // Update proposal status to 'Rejected'
        await runEffect(
          exchangesStore.updateExchangeResponseStatus({
            response_hash: proposalId as any,
            new_status: 'Rejected',
            reason: null
          })
        );

        toastStore.trigger({
          message: 'Response rejected successfully.',
          background: 'variant-filled-warning'
        });
      }

      await refreshData();
    } catch (error) {
      console.error(`Failed to ${action} proposal:`, error);
      toastStore.trigger({
        message: `Failed to ${action} proposal: ${error instanceof Error ? error.message : 'Unknown error'}`,
        background: 'variant-filled-error'
      });
    } finally {
      if (loadingToastId) {
        toastStore.close(loadingToastId);
      }
    }
  };

  const handleAgreementAction = async (action: string, agreementId: string) => {
    let loadingToastId: string | undefined;

    try {
      if (action === 'mark_complete') {
        loadingToastId = toastStore.trigger({
          message: 'Marking agreement as complete...',
          background: 'variant-filled-secondary',
          autohide: false,
          hideDismiss: true
        });

        // Mark the agreement as complete by the current user
        await runEffect(
          exchangesStore.markAgreementComplete({
            agreement_hash: agreementId as any,
            validator_role: 'Provider' // This should be determined based on the current user's role
          })
        );

        toastStore.trigger({
          message: 'Agreement marked as complete successfully!',
          background: 'variant-filled-success'
        });
      }

      await refreshData();
    } catch (error) {
      console.error(`Failed to ${action} agreement:`, error);
      toastStore.trigger({
        message: `Failed to ${action} agreement: ${error instanceof Error ? error.message : 'Unknown error'}`,
        background: 'variant-filled-error'
      });
    } finally {
      if (loadingToastId) {
        toastStore.close(loadingToastId);
      }
    }
  };
</script>

<!-- Dashboard Content -->
<div class="space-y-6">
  <div class="flex items-center justify-end gap-3">
    <button class="variant-soft-secondary btn" onclick={refreshData} disabled={isLoading()}>
      {isLoading() ? 'Refreshing...' : 'Refresh'}
    </button>
  </div>

  <!-- Statistics Overview -->
  {#if isInitialized && statistics()}
    <ExchangeStatistics
      stats={statistics()}
      totalProposals={responses().length}
      totalAgreements={activeAgreements().length + completedAgreements().length}
    />
  {/if}

  <!-- Error Display -->
  {#if hasError()}
    <div class="alert variant-filled-error">
      <div class="alert-message">
        <h3>Error Loading Exchanges</h3>
        <p>There was an issue loading your exchange data. Please try refreshing.</p>
      </div>
      <div class="alert-actions">
        <button class="variant-soft-error btn" onclick={refreshData}> Retry </button>
      </div>
    </div>
  {/if}

  <!-- Loading State -->
  {#if !isInitialized && isLoading()}
    <div class="flex items-center justify-center p-8">
      <div class="placeholder h-64 w-full animate-pulse rounded-lg"></div>
    </div>
  {/if}

  <!-- Main Dashboard Content -->
  {#if isInitialized}
    <div class="space-y-4">
      <!-- Tab Navigation -->
      <TabGroup>
        {#each tabs as tab, i}
          <Tab bind:group={tabSet} name="exchanges" value={tab.value}>
            <span>{tab.label}</span>
            <!-- Badge with counts -->
            {#if tab.value === 1}
              <span class="variant-soft-primary badge ml-2">{responses().length}</span>
            {:else if tab.value === 2}
              <span class="variant-soft-warning badge ml-2">{activeAgreements().length}</span>
            {:else if tab.value === 3}
              <span class="variant-soft-success badge ml-2">{completedAgreements().length}</span>
            {:else if tab.value === 4}
              <span class="variant-soft-secondary badge ml-2">{reviews().length}</span>
            {/if}
          </Tab>
        {/each}
      </TabGroup>

      <!-- Tab Content -->
      <div class="min-h-96">
        {#if tabSet === 0}
          <!-- All Exchanges Overview -->
          <div class="space-y-6">
            <!-- Quick Stats -->
            <div class="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div class="card p-4 text-center">
                <div class="text-2xl font-bold text-primary-500">{pendingResponses().length}</div>
                <div class="text-sm text-surface-600 dark:text-surface-400">Pending Proposals</div>
              </div>
              <div class="card p-4 text-center">
                <div class="text-2xl font-bold text-warning-500">{activeAgreements().length}</div>
                <div class="text-sm text-surface-600 dark:text-surface-400">Active Exchanges</div>
              </div>
              <div class="card p-4 text-center">
                <div class="text-2xl font-bold text-success-500">
                  {completedAgreements().length}
                </div>
                <div class="text-sm text-surface-600 dark:text-surface-400">Completed</div>
              </div>
              <div class="card p-4 text-center">
                <div class="text-2xl font-bold text-secondary-500">{reviews().length}</div>
                <div class="text-sm text-surface-600 dark:text-surface-400">Reviews Given</div>
              </div>
            </div>

            <!-- Recent Activity -->
            <div class="space-y-4">
              <h3 class="h4 font-semibold">Recent Activity</h3>

              {#if pendingResponses().length > 0}
                <div class="card p-4">
                  <h4 class="mb-3 font-medium">Pending Proposals ({pendingResponses().length})</h4>
                  <ResponsesList
                    responses={pendingResponses().slice(0, 3)}
                    showActions={true}
                    onAction={handleResponseAction}
                    compact={true}
                    showDirection={true}
                    {currentUserPubkey}
                  />
                  {#if pendingResponses().length > 3}
                    <div class="mt-3 text-center">
                      <button class="variant-ghost-primary btn" onclick={() => handleTabChange(1)}>
                        View All Proposals
                      </button>
                    </div>
                  {/if}
                </div>
              {/if}

              {#if activeAgreements().length > 0}
                <div class="card p-4">
                  <h4 class="mb-3 font-medium">Active Exchanges ({activeAgreements().length})</h4>
                  <AgreementsList
                    agreements={activeAgreements().slice(0, 3)}
                    showActions={true}
                    onAction={handleAgreementAction}
                    compact={true}
                  />
                  {#if activeAgreements().length > 3}
                    <div class="mt-3 text-center">
                      <button class="variant-ghost-primary btn" onclick={() => handleTabChange(2)}>
                        View All Active
                      </button>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          </div>
        {:else if tabSet === 1}
          <!-- Proposals Tab -->
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <h3 class="h4 font-semibold">Exchange Proposals</h3>
              <button class="variant-filled-primary btn" onclick={openDirectResponseModal}>
                Create Proposal
              </button>
            </div>

            <ResponsesList
              responses={responses()}
              showActions={true}
              onAction={handleResponseAction}
              showFilters={true}
              showDirection={true}
              {currentUserPubkey}
            />
          </div>
        {:else if tabSet === 2}
          <!-- Active Exchanges Tab -->
          <div class="space-y-4">
            <h3 class="h4 font-semibold">Active Exchanges</h3>
            <AgreementsList
              agreements={activeAgreements()}
              showActions={true}
              onAction={handleAgreementAction}
            />
          </div>
        {:else if tabSet === 3}
          <!-- Completed Exchanges Tab -->
          <div class="space-y-4">
            <h3 class="h4 font-semibold">Completed Exchanges</h3>
            <AgreementsList agreements={completedAgreements()} showActions={false} />
          </div>
        {:else if tabSet === 4}
          <!-- Reviews Tab -->
          <div class="space-y-4">
            <h3 class="h4 font-semibold">Exchange Reviews</h3>
            <ReviewsList reviews={reviews()} />
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
