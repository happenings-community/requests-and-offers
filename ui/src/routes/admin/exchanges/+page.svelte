<script lang="ts">
  import { onMount } from 'svelte';
  import { getToastStore, TabGroup, Tab } from '@skeletonlabs/skeleton';
  import { AgreementDashboard } from '$lib/components/exchanges';
  import usersStore from '$lib/stores/users.store.svelte';
  import administrationStore from '$lib/stores/administration.store.svelte';
  import { isUserApproved } from '$lib/utils';
  import ProposalManagerDashboard from '$lib/components/exchanges/ProposalManagerDashboard.svelte';

  const toastStore = getToastStore();
  const { currentUser } = $derived(usersStore);
  const { agentIsAdministrator } = $derived(administrationStore);

  // State
  let tabIndex = $state(0);
  let isLoading = $state(true);

  // Check if user is approved admin
  const userApproved = $derived(() => {
    return currentUser && isUserApproved(currentUser) && agentIsAdministrator;
  });

  onMount(async () => {
    isLoading = false;
  });
</script>

<svelte:head>
  <title>Admin - Exchange Monitoring - Requests & Offers</title>
  <meta
    name="description"
    content="Administrator view for monitoring all exchange proposals, agreements, and progress across the platform"
  />
</svelte:head>

<section class="space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="h1 text-primary-400 font-bold">Exchange Monitoring</h1>
      <p class="text-surface-400">
        Monitor and manage all exchange proposals, agreements, and progress across the platform
      </p>
    </div>
  </div>

  {#if isLoading}
    <!-- Loading state -->
    <div class="flex items-center justify-center p-8">
      <div class="flex items-center gap-4">
        <span class="animate-spin text-2xl">⏳</span>
        <p class="text-lg">Loading exchange data...</p>
      </div>
    </div>
  {:else if !currentUser}
    <!-- Not logged in -->
    <div class="card variant-soft-error p-8 text-center">
      <span class="material-symbols-outlined text-error-500 mb-4 text-6xl">no_accounts</span>
      <h2 class="h2 mb-4">Access Denied</h2>
      <p class="text-error-700 dark:text-error-300 mb-4">
        You need to be logged in as an administrator to access this page.
      </p>
      <a href="/user" class="variant-filled-primary btn"> Login </a>
    </div>
  {:else if !userApproved}
    <!-- User not approved or not admin -->
    <div class="card variant-soft-error p-8 text-center">
      <span class="material-symbols-outlined text-error-500 mb-4 text-6xl">block</span>
      <h2 class="h2 mb-4">Administrator Access Required</h2>
      <p class="text-error-700 dark:text-error-300 mb-4">
        {#if !agentIsAdministrator}
          You do not have administrator privileges to access this page.
        {:else}
          Your administrator account is pending approval.
        {/if}
      </p>
      <a href="/admin" class="variant-filled-secondary btn"> Back to Admin Dashboard </a>
    </div>
  {:else}
    <!-- Statistics Overview -->
    <div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
      <div class="card variant-filled-surface p-4 text-center">
        <span class="material-symbols-outlined text-primary-400 mb-2 text-3xl">Handshake</span>
        <h3 class="h4 font-semibold">Active Proposals</h3>
        <p class="text-primary-400 text-2xl font-bold">-</p>
        <p class="text-surface-400 text-sm">Pending decisions</p>
      </div>

      <div class="card variant-filled-surface p-4 text-center">
        <span class="material-symbols-outlined text-secondary-400 mb-2 text-3xl">Assignment</span>
        <h3 class="h4 font-semibold">Active Agreements</h3>
        <p class="text-secondary-400 text-2xl font-bold">-</p>
        <p class="text-surface-400 text-sm">In progress</p>
      </div>

      <div class="card variant-filled-surface p-4 text-center">
        <span class="material-symbols-outlined text-tertiary-400 mb-2 text-3xl">Trending Up</span>
        <h3 class="h4 font-semibold">Total Exchanges</h3>
        <p class="text-tertiary-400 text-2xl font-bold">-</p>
        <p class="text-surface-400 text-sm">All time</p>
      </div>
    </div>

    <!-- Warning Notice -->
    <div class="card variant-soft-warning p-4">
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined text-warning-600">info</span>
        <div>
          <h3 class="font-semibold">Administrator View</h3>
          <p class="text-warning-700 dark:text-warning-300 text-sm">
            You are viewing all exchanges across the platform. This includes sensitive user data.
            Please respect user privacy and use this information responsibly.
          </p>
        </div>
      </div>
    </div>

    <!-- Main exchange monitoring interface -->
    <div class="card variant-filled-surface">
      <TabGroup>
        <Tab bind:group={tabIndex} name="proposals" value={0}>
          <span class="flex items-center gap-2">
            <span>All Proposals</span>
          </span>
        </Tab>
        <Tab bind:group={tabIndex} name="agreements" value={1}>
          <span class="flex items-center gap-2">
            <span>All Agreements</span>
          </span>
        </Tab>
        <Tab bind:group={tabIndex} name="analytics" value={2}>
          <span class="flex items-center gap-2">
            <span>Analytics</span>
          </span>
        </Tab>

        <!-- Tab Panels -->
        <svelte:fragment slot="panel">
          {#if tabIndex === 0}
            <div class="p-6">
              <div class="mb-4 flex items-center justify-between">
                <div>
                  <h2 class="h3 font-semibold">All Exchange Proposals</h2>
                  <p class="text-surface-400">
                    Monitor all proposals across the platform (sent and received by all users)
                  </p>
                </div>

                <!-- Filter controls could go here -->
                <div class="flex gap-2">
                  <select class="select">
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="accepted">Accepted</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>

              <ProposalManagerDashboard />
            </div>
          {:else if tabIndex === 1}
            <div class="p-6">
              <div class="mb-4 flex items-center justify-between">
                <div>
                  <h2 class="h3 font-semibold">All Active Agreements</h2>
                  <p class="text-surface-400">
                    Monitor all active exchanges and their progress across the platform
                  </p>
                </div>

                <!-- Filter controls -->
                <div class="flex gap-2">
                  <select class="select">
                    <option value="all">All Status</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <AgreementDashboard />
            </div>
          {:else if tabIndex === 2}
            <div class="p-6">
              <h2 class="h3 mb-4 font-semibold">Exchange Analytics</h2>
              <p class="text-surface-400 mb-6">Platform-wide exchange statistics and trends</p>

              <!-- Analytics placeholder -->
              <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div class="card variant-filled-surface p-6">
                  <h3 class="h4 mb-4 font-semibold">
                    <span class="material-symbols-outlined mr-2">timeline</span>
                    Exchange Trends
                  </h3>
                  <div class="text-surface-400 flex h-40 items-center justify-center">
                    <div class="text-center">
                      <span class="material-symbols-outlined mb-2 text-4xl">bar_chart</span>
                      <p class="text-sm">Analytics visualization coming soon</p>
                    </div>
                  </div>
                </div>

                <div class="card variant-filled-surface p-6">
                  <h3 class="h4 mb-4 font-semibold">
                    <span class="material-symbols-outlined mr-2">pie_chart</span>
                    Success Rates
                  </h3>
                  <div class="space-y-3">
                    <div class="flex justify-between">
                      <span class="text-sm">Proposal Acceptance Rate</span>
                      <span class="text-sm font-medium">-%</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-sm">Agreement Completion Rate</span>
                      <span class="text-sm font-medium">-%</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-sm">Average Exchange Duration</span>
                      <span class="text-sm font-medium">- days</span>
                    </div>
                  </div>
                </div>

                <div class="card variant-filled-surface p-6">
                  <h3 class="h4 mb-4 font-semibold">
                    <span class="material-symbols-outlined mr-2">category</span>
                    Popular Categories
                  </h3>
                  <div class="text-surface-400 flex h-32 items-center justify-center">
                    <div class="text-center">
                      <span class="material-symbols-outlined mb-2 text-3xl">auto_graph</span>
                      <p class="text-sm">Category analytics coming soon</p>
                    </div>
                  </div>
                </div>

                <div class="card variant-filled-surface p-6">
                  <h3 class="h4 mb-4 font-semibold">
                    <span class="material-symbols-outlined mr-2">groups</span>
                    User Activity
                  </h3>
                  <div class="space-y-3">
                    <div class="flex justify-between">
                      <span class="text-sm">Active Users (30 days)</span>
                      <span class="text-sm font-medium">-</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-sm">New Exchanges This Month</span>
                      <span class="text-sm font-medium">-</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-sm">Most Active Organizations</span>
                      <span class="text-sm font-medium">-</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Future enhancement note -->
              <div class="card variant-soft-surface mt-6 p-4">
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined">construction</span>
                  <div>
                    <h4 class="font-semibold">Analytics Development</h4>
                    <p class="text-surface-400 text-sm">
                      Detailed analytics and reporting features are planned for future releases.
                      This will include real-time metrics, trend analysis, and performance insights.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          {/if}
        </svelte:fragment>
      </TabGroup>
    </div>
  {/if}
</section>
