<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import OrganizationsTable from '$lib/components/organizations/OrganizationsTable.svelte';
  import { useOrganizationsManagement } from '$lib/composables';
  import usersStore from '$lib/stores/users.store.svelte';
  import { ConicGradient, type ConicStop } from '@skeletonlabs/skeleton';

  const management = useOrganizationsManagement({ filter: 'accepted' });
  const { currentUser } = $derived(usersStore);

  const conicStops: ConicStop[] = [
    { color: 'transparent', start: 0, end: 0 },
    { color: 'rgb(var(--color-primary-500))', start: 75, end: 50 }
  ];

  onMount(() => {
    management.loadOrganizations();
    usersStore.refreshCurrentUser();
  });

  function handleCreateOrganization() {
    if (!currentUser) {
      // This case should ideally be handled by disabling the button,
      // but we keep it for robustness.
      return;
    }
    goto('/organizations/create');
  }
</script>

<section class="flex flex-col gap-8">
  <h1 class="h1 text-center">Organizations</h1>

  {#if management.error}
    <div class="alert variant-filled-error">
      <p>{management.error}</p>
      <button class="btn btn-sm variant-soft" onclick={management.loadOrganizations}> Try Again </button>
    </div>
  {/if}

  {#if currentUser}
    <button onclick={handleCreateOrganization} class="btn variant-filled-primary w-fit self-center">
      Create Organization
    </button>
  {/if}

  {#if management.isLoading}
    <ConicGradient stops={conicStops} spin>Loading</ConicGradient>
  {:else if management.organizations.length > 0}
    <OrganizationsTable organizations={management.organizations} />
  {:else}
     <p class="text-center text-surface-500">No organizations found.</p>
  {/if}
</section>
