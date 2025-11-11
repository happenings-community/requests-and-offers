<script lang="ts">
  import { onMount } from 'svelte';
  import type { UIOrganization, UIUser, UIProject } from '$lib/types/ui';
  import administrationStore from '$lib/stores/administration.store.svelte';
  import {
    getModalStore,
    getToastStore,
    Tab,
    TabGroup,
    type ModalComponent
  } from '@skeletonlabs/skeleton';
  import { Icon, ExclamationTriangle } from 'svelte-hero-icons';
  import { Effect as E } from 'effect';
  import { HolochainClientError } from '$lib/errors';
  import { getUserPictureUrl } from '$lib/utils';
  import { runEffect } from '$lib/utils/effect';
  import UserDetailsModal from '$lib/components/users/UserDetailsModal.svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { encodeHashToBase64 } from '@holochain/client';
  import { storeEventBus } from '$lib/stores/storeEvents';

  const toastStore = getToastStore();
  const modalStore = getModalStore();
  const modalComponent: ModalComponent = { ref: UserDetailsModal };

  function handleViewUser(user: UIUser) {
    if (!user.original_action_hash) return;

    if (page.url.pathname.startsWith('/admin')) {
      modalStore.trigger({
        type: 'component',
        component: modalComponent,
        meta: { user }
      });
    } else {
      goto(`/users/${encodeHashToBase64(user.original_action_hash)}`);
    }
  }

  let dashboardState = $state({
    isLoading: true,
    isRefreshing: false, // Track if we're in the middle of a refresh operation
    tabSet: 0,
    error: null as string | null,
    data: {
      administrators: [] as UIUser[],
      allUsers: [] as UIUser[],
      allOrganizations: [] as UIOrganization[],
      pendingUsers: [] as UIUser[],
      pendingProjects: [] as UIProject[], // Now uses proper project types
      pendingOrganizations: [] as UIOrganization[]
    }
  });

  // Separate loading states for different sections to prevent full dashboard reload
  let sectionLoadingState = $state({
    users: false,
    organizations: false
  });

  // Function to update user data reactively based on status change events
  function updateUserInDashboard(updatedUser: UIUser) {
    const userIndex = dashboardState.data.allUsers.findIndex(
      (u) => u.original_action_hash?.toString() === updatedUser.original_action_hash?.toString()
    );

    if (userIndex !== -1) {
      // Update the user in the allUsers array
      dashboardState.data.allUsers[userIndex] = updatedUser;

      // Update pending users list
      dashboardState.data.pendingUsers = dashboardState.data.allUsers.filter(
        (user: UIUser) => user.status?.status_type === 'pending'
      );

      console.log('✅ User updated reactively in dashboard:', updatedUser.name);
    }
  }

  // Function to update organization data reactively based on status change events
  function updateOrganizationInDashboard(updatedOrg: UIOrganization) {
    const orgIndex = dashboardState.data.allOrganizations.findIndex(
      (o) => o.original_action_hash?.toString() === updatedOrg.original_action_hash?.toString()
    );

    if (orgIndex !== -1) {
      // Update the organization in the allOrganizations array
      dashboardState.data.allOrganizations[orgIndex] = updatedOrg;

      // Update pending organizations list
      dashboardState.data.pendingOrganizations = dashboardState.data.allOrganizations.filter(
        (org: UIOrganization) => org.status?.status_type === 'pending'
      );

      // Update pending projects list (projects are organizations with 'project' in description)
      const pendingProjects = dashboardState.data.allOrganizations.filter((org: UIOrganization) => {
        return (
          org.status?.status_type === 'pending' && org.description.toLowerCase().includes('project')
        );
      }) as UIProject[];
      dashboardState.data.pendingProjects = pendingProjects;

      console.log('✅ Organization updated reactively in dashboard:', updatedOrg.name);
    }
  }

  async function approveUser(user: UIUser) {
    await runEffect(administrationStore.approveUser(user));
    toastStore.trigger({ message: 'User approved.', background: 'variant-filled-success' });
    refreshUsersData();
  }

  async function rejectUser(user: UIUser) {
    await runEffect(administrationStore.rejectUser(user));
    toastStore.trigger({ message: 'User rejected.', background: 'variant-filled-warning' });
    refreshUsersData();
  }

  async function approveOrganization(org: UIOrganization) {
    await runEffect(administrationStore.approveOrganization(org));
    toastStore.trigger({ message: 'Organization approved.', background: 'variant-filled-success' });
    refreshOrganizationsData();
  }

  async function rejectOrganization(org: UIOrganization) {
    await runEffect(administrationStore.rejectOrganization(org));
    toastStore.trigger({ message: 'Organization rejected.', background: 'variant-filled-warning' });
    refreshOrganizationsData();
  }

  async function refreshUsersData() {
    sectionLoadingState.users = true;
    try {
      // Only refresh user data, not administrators (admin status doesn't change when approving users)
      const users = await runEffect(administrationStore.fetchAllUsers());

      dashboardState.data.allUsers = users;
      dashboardState.data.pendingUsers = users.filter(
        (user: UIUser) => user.status?.status_type === 'pending'
      );

      console.log('✅ Users data refreshed');
    } catch (e) {
      const error = e as HolochainClientError;
      console.error('Failed to refresh users data:', error);
      toastStore.trigger({
        message: 'Failed to refresh users data.',
        background: 'variant-filled-error'
      });
    } finally {
      sectionLoadingState.users = false;
    }
  }

  async function refreshOrganizationsData() {
    sectionLoadingState.organizations = true;
    try {
      const orgs = await runEffect(administrationStore.fetchAllOrganizations());

      dashboardState.data.allOrganizations = orgs;
      dashboardState.data.pendingOrganizations = orgs.filter(
        (org: UIOrganization) => org.status?.status_type === 'pending'
      );

      // Update projects data too since projects are organizations
      const pendingProjects = orgs.filter((org: UIOrganization) => {
        return (
          org.status?.status_type === 'pending' && org.description.toLowerCase().includes('project')
        );
      }) as UIProject[];
      dashboardState.data.pendingProjects = pendingProjects;

      console.log('✅ Organizations data refreshed');
    } catch (e) {
      const error = e as HolochainClientError;
      console.error('Failed to refresh organizations data:', error);
      toastStore.trigger({
        message: 'Failed to refresh organizations data.',
        background: 'variant-filled-error'
      });
    } finally {
      sectionLoadingState.organizations = false;
    }
  }

  async function fetchDashboardData() {
    dashboardState.isLoading = true;
    dashboardState.error = null;

    try {
      const results = await runEffect(
        E.all(
          [
            administrationStore.getAllNetworkAdministrators(),
            administrationStore.fetchAllUsers(),
            administrationStore.fetchAllOrganizations(),
            // Projects are organizations classified as 'Project' in hREA
            administrationStore.fetchAllOrganizations()
          ],
          { concurrency: 'inherit' }
        )
      );

      const [admins, users, orgs, projectOrgs] = results as [
        UIUser[],
        UIUser[],
        UIOrganization[],
        UIOrganization[]
      ];
      dashboardState.data.administrators = admins;
      dashboardState.data.allUsers = users;
      dashboardState.data.allOrganizations = orgs;

      dashboardState.data.pendingUsers = users.filter(
        (user: UIUser) => user.status?.status_type === 'pending'
      );
      dashboardState.data.pendingOrganizations = orgs.filter(
        (org: UIOrganization) => org.status?.status_type === 'pending'
      );

      // Projects are organizations with classification 'Project'
      // For now, filter projects from organizations (future: add classification field)
      const pendingProjects = projectOrgs.filter((org: UIOrganization) => {
        return (
          org.status?.status_type === 'pending' &&
          // In future, check org.classification === 'Project'
          org.description.toLowerCase().includes('project')
        );
      }) as UIProject[];
      dashboardState.data.pendingProjects = pendingProjects;
    } catch (e) {
      const error = e as HolochainClientError;
      dashboardState.error = error.message;
      toastStore.trigger({
        message: 'Failed to load dashboard data. Please try again.',
        background: 'variant-filled-error'
      });
    } finally {
      dashboardState.isLoading = false;
    }
  }

  onMount(() => {
    // Initial data fetch
    fetchDashboardData();

    // Set up reactive event listeners for automatic UI updates
    const unsubscribeUserStatus = storeEventBus.on('user:status:updated', (event) => {
      console.log('📡 Admin dashboard received user status update event:', event);
      updateUserInDashboard(event.user);
    });

    const unsubscribeOrganizationStatus = storeEventBus.on(
      'organization:status:updated',
      (event) => {
        console.log('📡 Admin dashboard received organization status update event:', event);
        updateOrganizationInDashboard(event.organization);
      }
    );

    // Cleanup event listeners on component unmount
    return () => {
      unsubscribeUserStatus();
      unsubscribeOrganizationStatus();
    };
  });
</script>

<section class="space-y-8">
  <h1 class="h1">Admin Dashboard</h1>

  <!-- System At a Glance -->
  <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
    <div class="card variant-filled-surface p-4">
      <h3 class="h3">{dashboardState.data.administrators.length}</h3>
      <p class="text-sm text-gray-400">Administrators</p>
    </div>
    <div class="card variant-filled-surface p-4">
      <h3 class="h3">{dashboardState.data.allUsers.length}</h3>
      <p class="text-sm text-gray-400">Total Users</p>
    </div>
    <div class="card variant-filled-surface p-4">
      <h3 class="h3">{dashboardState.data.allOrganizations.length}</h3>
      <p class="text-sm text-gray-400">Total Organizations</p>
    </div>
  </div>

  <!-- Moderation Queue -->
  <div class="card variant-filled-surface p-4">
    <h2 class="h2 mb-4">Moderation Queue</h2>
    {#if dashboardState.isLoading}
      <div class="flex items-center justify-center space-x-2 text-center">
        <span class="loading loading-spinner"></span>
        <span>Loading queue...</span>
      </div>
    {:else if dashboardState.error}
      <div class="alert variant-filled-error">
        <Icon src={ExclamationTriangle} class="h-6 w-6" />
        <span>{dashboardState.error}</span>
        <div class="flex-none">
          <button class="btn-ghost btn btn-sm" onclick={fetchDashboardData}>Try Again</button>
        </div>
      </div>
    {:else}
      <TabGroup justify="justify-start" class="mb-4">
        <Tab bind:group={dashboardState.tabSet} name="pendingUsers" value={0}>
          Pending Users ({dashboardState.data.pendingUsers.length})
        </Tab>
        <Tab bind:group={dashboardState.tabSet} name="pendingOrgs" value={1}>
          Pending Orgs ({dashboardState.data.pendingOrganizations.length})
        </Tab>
        <Tab bind:group={dashboardState.tabSet} name="pendingProjects" value={2}>
          Pending Projects ({dashboardState.data.pendingProjects.length})
        </Tab>
      </TabGroup>

      <!-- Tab Panels -->
      <div class="p-4">
        {#if dashboardState.tabSet === 0}
          <!-- Pending Users Panel -->
          <div class="space-y-4">
            {#if sectionLoadingState.users}
              <div class="flex items-center justify-center space-x-2 py-4 text-center">
                <span class="loading loading-spinner"></span>
                <span>Refreshing users...</span>
              </div>
            {:else}
              {#each dashboardState.data.pendingUsers as user (user.original_action_hash)}
                <div class="flex items-center justify-between rounded-lg bg-surface-800 p-4">
                  <div class="flex items-center gap-4">
                    <img
                      src={getUserPictureUrl(user)}
                      alt="user avatar"
                      class="avatar h-10 w-10 rounded-full"
                    />
                    <button
                      class="text-primary-400 hover:underline"
                      onclick={() => handleViewUser(user)}>{user.name}</button
                    >
                  </div>
                  <div class="flex gap-2">
                    <button
                      class="variant-filled-success btn btn-sm"
                      onclick={() => approveUser(user)}>Approve</button
                    >
                    <button
                      class="variant-filled-warning btn btn-sm"
                      onclick={() => rejectUser(user)}>Reject</button
                    >
                  </div>
                </div>
              {:else}
                <p>No pending users.</p>
              {/each}
            {/if}
          </div>
        {:else if dashboardState.tabSet === 1}
          <!-- Pending Orgs Panel -->
          <div class="space-y-4">
            {#each dashboardState.data.pendingOrganizations as org (org.original_action_hash)}
              <div class="flex items-center justify-between rounded-lg bg-surface-800 p-4">
                <div class="flex items-center gap-4">
                  <span>{org.name}</span>
                </div>
                <div class="flex gap-2">
                  <button
                    class="variant-filled-success btn btn-sm"
                    onclick={() => approveOrganization(org)}>Approve</button
                  >
                  <button
                    class="variant-filled-warning btn btn-sm"
                    onclick={() => rejectOrganization(org)}>Reject</button
                  >
                </div>
              </div>
            {:else}
              <p>No pending organizations.</p>
            {/each}
          </div>
        {:else if dashboardState.tabSet === 2}
          <!-- Pending Projects Panel -->
          <p>Pending projects view is not implemented yet.</p>
        {/if}
      </div>
    {/if}
  </div>
</section>
