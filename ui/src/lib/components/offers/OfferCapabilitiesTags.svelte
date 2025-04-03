<script lang="ts">
  type Props = {
    capabilities: string[];
    maxVisible?: number;
  };

  const { capabilities, maxVisible = 3 }: Props = $props();

  // Determine if we need to show "more" indicator
  const visibleCapabilities = $derived(capabilities.slice(0, maxVisible));
  const hiddenCapabilitiesCount = $derived(Math.max(0, capabilities.length - maxVisible));

  // Toggle to show all capabilities
  let showAllCapabilities = $state(false);

  function toggleCapabilitiesDisplay() {
    showAllCapabilities = !showAllCapabilities;
  }

  // Compute final capabilities to display
  const displayCapabilities = $derived(showAllCapabilities ? capabilities : visibleCapabilities);
</script>

<div class="flex flex-wrap items-center gap-2">
  {#each displayCapabilities as capability}
    <span class="variant-soft-primary chip" title={capability}>
      {capability}
    </span>
  {/each}

  {#if hiddenCapabilitiesCount > 0 && !showAllCapabilities}
    <button class="variant-soft-secondary chip" onclick={toggleCapabilitiesDisplay}>
      +{hiddenCapabilitiesCount} more
    </button>
  {/if}

  {#if showAllCapabilities && hiddenCapabilitiesCount > 0}
    <button class="variant-soft-secondary chip" onclick={toggleCapabilitiesDisplay}>
      Show less
    </button>
  {/if}
</div>
