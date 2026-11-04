<script lang="ts">
  import { afterNavigate, goto } from '$app/navigation';
  import { backTarget } from '$lib/utils/back';

  /**
   * Back to where the member came from in the app, or to `fallback` when they
   * arrived directly. See `utils/back.ts` for the rule.
   */
  let {
    fallback,
    label = 'Back',
    class: className = 'variant-soft btn'
  }: { fallback: string; label?: string; class?: string } = $props();

  let cameFrom = $state<URL | null>(null);

  // Runs when the page mounts and after each navigation; `from` is null when
  // the page was the first one loaded.
  afterNavigate(({ from }) => {
    cameFrom = from?.url ?? null;
  });

  function back() {
    const target = backTarget(cameFrom, fallback);
    if (target === 'history') history.back();
    else goto(target);
  }
</script>

<button type="button" class="{className} space-x-2" onclick={back} data-testid="back-button">
  <span>🡰</span>
  <span>{label}</span>
</button>
