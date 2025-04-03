<script lang="ts">
  import type { Revision } from '@types/ui';

  type Props = {
    statusHistory: Revision[];
    title?: string;
  };

  const { statusHistory, title }: Props = $props();

  let allStatusesColors: string[] = $state([]);

  $effect(() => {
    allStatusesColors = (statusHistory || []).map((status) => {
      switch (status?.status?.status_type) {
        case 'pending':
          return 'primary-400';
        case 'rejected':
        case 'suspended indefinitely':
          return 'error-500';
        case 'accepted':
          return 'green-400';
        case 'suspended temporarily':
          return 'warning-500';
        default:
          return 'surface-400';
      }
    });

    return () => {
      allStatusesColors = [];
    };
  });

  function formatDurationInDays(duration: number): string {
    if (!duration) return 'N/A';
    const totalDays = duration / 1000 / 60 / 60 / 24;
    const roundedDays = Math.ceil(totalDays);
    return `${roundedDays}d`;
  }
</script>

<div class="flex flex-col gap-4">
  {#if title}
    <h2 class="h3 text-center font-semibold">{title}</h2>
  {/if}

  {#if statusHistory.length > 0}
    <div class="hidden overflow-x-auto md:block">
      <table class="table-hover table w-full drop-shadow-lg">
        <thead class="!bg-surface-800 dark:!bg-surface-700">
          <tr>
            <th class="whitespace-nowrap px-2">Timestamp</th>
            <th class="whitespace-nowrap px-2">Name</th>
            <th class="whitespace-nowrap px-2">Status</th>
            <th class="whitespace-nowrap px-2">Reason</th>
            <th class="whitespace-nowrap px-2">Duration</th>
          </tr>
        </thead>

        <tbody>
          {#each statusHistory as revision, i}
            <tr class="whitespace-nowrap text-{allStatusesColors[i] || 'surface-400'}">
              <td>{revision?.timestamp ? new Date(revision.timestamp).toLocaleString() : 'N/A'}</td>
              <td class="whitespace-nowrap capitalize">{revision?.entity?.name || 'N/A'}</td>
              <td class="whitespace-nowrap">{revision?.status?.status_type || 'N/A'}</td>
              <td class="whitespace-nowrap">{revision?.status?.reason || 'N/A'}</td>
              <td class="whitespace-nowrap">
                {#if revision?.status?.duration}
                  {formatDurationInDays(revision.status.duration)}
                {:else}
                  N/A
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Card view for mobile screens -->
    <div class="grid grid-cols-1 gap-4 md:hidden">
      {#each statusHistory as revision, i}
        <div class="card variant-filled bg-surface-800 dark:bg-surface-700 p-4">
          <div class="flex items-center gap-4 text-{allStatusesColors[i] || 'surface-400'}">
            <div class="min-w-0 flex-1 space-y-2">
              <h3 class="h4 truncate font-bold">
                {revision?.entity?.name || 'N/A'}
              </h3>
              <div class="">
                <p class="text-sm opacity-80">
                  {revision?.timestamp ? new Date(revision.timestamp).toLocaleString() : 'N/A'}
                </p>
                <p class="text-sm opacity-80">
                  {revision?.status?.status_type || 'N/A'}
                </p>
              </div>
            </div>
          </div>
          <div class="mt-4 text-{allStatusesColors[i] || 'surface-400'}">
            <p class="text-sm opacity-80">{revision?.status?.reason || 'N/A'}</p>
          </div>
          <div class="mt-4 text-{allStatusesColors[i] || 'surface-400'}">
            <p class="text-sm opacity-80">
              {#if revision?.status?.duration}
                {formatDurationInDays(revision.status.duration)}
              {:else}
                N/A
              {/if}
            </p>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <p class="text-surface-500 text-center">No status history found.</p>
  {/if}
</div>
