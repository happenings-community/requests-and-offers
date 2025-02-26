<script lang="ts">
  type Props = {
    skills: string[];
    maxVisible?: number;
  };

  const { 
    skills, 
    maxVisible = 3 
  }: Props = $props();

  // Determine if we need to show "more" indicator
  const visibleSkills = $derived(skills.slice(0, maxVisible));
  const hiddenSkillsCount = $derived(Math.max(0, skills.length - maxVisible));

  // Toggle to show all skills
  let showAllSkills = $state(false);

  function toggleSkillsDisplay() {
    showAllSkills = !showAllSkills;
  }

  // Compute final skills to display
  const displaySkills = $derived(
    showAllSkills ? skills : visibleSkills
  );
</script>

<div class="flex flex-wrap gap-2 items-center">
  {#each displaySkills as skill}
    <span 
      class="chip variant-soft-primary"
      title={skill}
    >
      {skill}
    </span>
  {/each}

  {#if hiddenSkillsCount > 0 && !showAllSkills}
    <button 
      class="chip variant-soft-secondary"
      onclick={toggleSkillsDisplay}
    >
      +{hiddenSkillsCount} more
    </button>
  {/if}

  {#if showAllSkills && hiddenSkillsCount > 0}
    <button 
      class="chip variant-soft-secondary"
      onclick={toggleSkillsDisplay}
    >
      Show less
    </button>
  {/if}
</div>
