<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { TabGroup, Tab } from '@skeletonlabs/skeleton';
  import HreaDashboard from '$lib/components/hrea/HreaDashboard.svelte';
  import HREATestInterface from '$lib/components/hrea/HREATestInterface.svelte';

  // The admin's hREA entry: the ValueFlows dashboard first, the entity test
  // managers (the former /admin/hrea-test) as the second tab of the same page.
  let tab = $state(page.url.searchParams.get('tab') === 'test' ? 1 : 0);

  // Keep the open tab in the URL, so the old /admin/hrea-test link lands on it.
  $effect(() => {
    const wanted = tab === 1 ? 'test' : null;
    if (page.url.searchParams.get('tab') === wanted) return;
    const url = new URL(page.url);
    if (wanted) url.searchParams.set('tab', wanted);
    else url.searchParams.delete('tab');
    goto(url, { replaceState: true, keepFocus: true, noScroll: true });
  });
</script>

<svelte:head>
  <title>hREA · ValueFlows - Admin</title>
  <meta
    name="description"
    content="The hREA mirror of this network, read from hREA, and its audit against R&O"
  />
</svelte:head>

<div class="container mx-auto max-w-7xl space-y-6 p-4">
  <h1 class="h1">hREA · ValueFlows</h1>

  <TabGroup>
    <Tab bind:group={tab} name="dashboard" value={0}>Dashboard</Tab>
    <Tab bind:group={tab} name="test-managers" value={1}>Test managers</Tab>

    <svelte:fragment slot="panel">
      {#if tab === 0}
        <HreaDashboard />
      {:else}
        <p class="text-surface-600-300-token text-sm">
          Create and inspect hREA entities directly. A development tool: what you create here is
          written to hREA.
        </p>
        <HREATestInterface />
      {/if}
    </svelte:fragment>
  </TabGroup>
</div>
