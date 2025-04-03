<script lang="ts">
  type Props = {
    requirements: string[];
    maxVisible?: number;
  };

  const { requirements, maxVisible = 3 }: Props = $props();

  // Determine if we need to show "more" indicator
  const visibleRequirements = $derived(requirements.slice(0, maxVisible));
  const hiddenRequirementsCount = $derived(Math.max(0, requirements.length - maxVisible));

  // Toggle to show all requirements
  let showAllRequirements = $state(false);

  function toggleRequirementsDisplay() {
    showAllRequirements = !showAllRequirements;
  }

  // Compute final requirements to display
  const displayRequirements = $derived(showAllRequirements ? requirements : visibleRequirements);
</script>

<div class="flex flex-wrap items-center gap-2">
  {#each displayRequirements as requirement}
    <span class="variant-soft-primary chip" title={requirement}>
      {requirement}
    </span>
  {/each}

  {#if hiddenRequirementsCount > 0 && !showAllRequirements}
    <button class="variant-soft-secondary chip" onclick={toggleRequirementsDisplay}>
      +{hiddenRequirementsCount} more
    </button>
  {/if}

  {#if showAllRequirements && hiddenRequirementsCount > 0}
    <button class="variant-soft-secondary chip" onclick={toggleRequirementsDisplay}>
      Show less
    </button>
  {/if}
</div>
