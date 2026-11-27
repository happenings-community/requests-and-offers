<script lang="ts">
  import { useEffectTask } from '$lib/composables/ui/useEffectTask.svelte';

  /** Hands the component's task to the test, which drives it the way a component's script would. */
  let { onTask }: { onTask: (task: ReturnType<typeof useEffectTask<string, string>>) => void } =
    $props();

  const task = useEffectTask<string, string>();
  onTask(task);
</script>

<p data-testid="running">{task.running ? 'running' : 'idle'}</p>
