<script lang="ts">
  import { RequestProcessState } from '@/types/holochain';

  type Props = {
    state: RequestProcessState;
    showLabel?: boolean;
  };

  const { state, showLabel = false }: Props = $props();

  // Map process states to styling and labels
  const statusConfig = {
    [RequestProcessState.Proposed]: {
      color: 'variant-soft-primary',
      label: 'Proposed'
    },
    [RequestProcessState.Committed]: {
      color: 'variant-soft-secondary',
      label: 'Committed'
    },
    [RequestProcessState.InProgress]: {
      color: 'variant-soft-tertiary',
      label: 'In Progress'
    },
    [RequestProcessState.Completed]: {
      color: 'variant-soft-success',
      label: 'Completed'
    },
    [RequestProcessState.Canceled]: {
      color: 'variant-soft-error',
      label: 'Canceled'
    }
  };

  const config = $derived(
    statusConfig[state] || {
      color: 'variant-soft-surface',
      label: 'Unknown'
    }
  );
</script>

<span
  class="badge {config.color} flex items-center gap-2"
  title={`Request is currently ${config.label}`}
>
  {#if showLabel}
    {config.label}
  {/if}
</span>
