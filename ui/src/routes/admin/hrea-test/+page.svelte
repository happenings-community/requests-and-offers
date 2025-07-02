<script lang="ts">
  import HREATestInterface from '$lib/components/hrea/HREATestInterface.svelte';
</script>

<svelte:head>
  <title>hREA Test Interface - Admin</title>
  <meta
    name="description"
    content="Test interface for hREA (Holochain Resource-Event-Agent) entities"
  />
</svelte:head>

<div class="container mx-auto max-w-7xl space-y-6 p-4">
  <!-- Header Section -->
  <div class="space-y-4">
    <div class="flex items-center gap-3">
      <div
        class="from-primary-500 to-secondary-500 flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br"
      >
        <i class="fa-solid fa-network-wired text-xl text-white"></i>
      </div>
      <div>
        <h1 class="h1">hREA Test Interface</h1>
        <p class="text-surface-600-300-token">
          Administrative interface for testing Holochain Resource-Event-Agent operations
        </p>
      </div>
    </div>

    <!-- Info Card -->
    <div class="card bg-surface-50-900-token border-surface-200-700-token border p-4">
      <div class="flex items-start gap-3">
        <i class="fa-solid fa-info-circle text-primary-500 mt-1 text-xl"></i>
        <div class="space-y-2">
          <h3 class="h4">About hREA Integration</h3>
          <p class="text-surface-600-300-token text-sm">
            This interface allows you to test the integration between our Holochain application and
            the
            <strong>hREA (Holochain Resource-Event-Agent)</strong> framework. hREA provides a standardized
            way to model economic activities and resource flows in decentralized networks.
          </p>
          <div class="mt-3 flex flex-wrap gap-2">
            <span class="badge variant-soft-primary">
              <i class="fa-solid fa-users mr-1 text-xs"></i>
              Agents
            </span>
            <span class="badge variant-soft-secondary">
              <i class="fa-solid fa-list-check mr-1 text-xs"></i>
              Resource Specs
            </span>
            <span class="badge variant-soft-tertiary">
              <i class="fa-solid fa-handshake mr-1 text-xs"></i>
              Proposals
            </span>
            <span class="badge variant-soft-success">
              <i class="fa-solid fa-bullseye mr-1 text-xs"></i>
              Intents
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Main Interface -->
  <HREATestInterface />

  <!-- Footer Note -->
  <div class="p-4 text-center">
    <p class="text-surface-500-400-token text-xs">
      ⚠️ This is a development/testing interface. Use with caution in production environments.
    </p>
  </div>
</div>
