<script lang="ts">
  import { onMount } from 'svelte';
  import {
    getConnectionStatusContext,
    type ConnectionStatus
  } from '$lib/context/connection-status.context.svelte';

  // Kangaroo API interface for desktop app
  interface KangarooAPI {
    getConfig(): Promise<{
      bootstrapUrl?: string;
      signalUrl?: string;
      networkSeed?: string;
    }>;
  }

  // Type guard function to check if Kangaroo API is available
  function hasKangarooAPI(window: Window): window is Window & { __KANGAROO__: KangarooAPI } {
    return '__KANGAROO__' in window && typeof (window as any).__KANGAROO__ === 'object';
  }

  // Props for connection status
  type Props = {
    connectionStatus?: ConnectionStatus;
    lastPingTime?: Date | null;
    pingError?: string | null;
    networkSeed?: string | null;
    networkInfo?: { dnaHash: string; roleName: string } | null;
  };

  const { connectionStatus, lastPingTime, pingError, networkSeed, networkInfo }: Props = $props();

  // Get connection status from context as fallback
  const connectionContext = getConnectionStatusContext();

  // Use props first, then context, then default
  const finalConnectionStatus = $derived(
    connectionStatus ?? connectionContext?.connectionStatus() ?? 'checking'
  );
  const finalLastPingTime = $derived(lastPingTime ?? connectionContext?.lastPingTime() ?? null);
  const finalPingError = $derived(pingError ?? connectionContext?.pingError?.() ?? null);
  const finalNetworkSeed = $derived(networkSeed ?? connectionContext?.networkSeed?.() ?? null);
  const finalNetworkInfo = $derived(networkInfo ?? connectionContext?.networkInfo?.() ?? null);

  // Bootstrap server status type
  type BootstrapStatus =
    | 'checking'
    | 'connected'
    | 'disconnected'
    | 'error'
    | 'unknown'
    | 'unavailable';

  // Network configuration state (will be populated dynamically)
  let networkConfig = $state({
    bootstrapUrl: 'Loading...',
    signalUrl: 'Loading...',
    networkSeed: 'Loading...',
    bootstrapStatus: 'checking' as BootstrapStatus
  });

  function getConnectionText(status: typeof finalConnectionStatus): string {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'checking':
        return 'Checking...';
      case 'disconnected':
        return 'Disconnected';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  }

  async function fetchNetworkConfig() {
    try {
      // Since this is a Kangaroo desktop app, get config from the IPC bridge
      let kangarooConfig = null;

      // Try to get the real config from the Kangaroo desktop app
      if (hasKangarooAPI(window)) {
        try {
          kangarooConfig = await window.__KANGAROO__.getConfig();
        } catch (error) {
          console.warn('Failed to get kangaroo config from IPC:', error);
        }
      }

      if (kangarooConfig) {
        networkConfig.bootstrapUrl = kangarooConfig.bootstrapUrl || 'Unknown';
        networkConfig.signalUrl = kangarooConfig.signalUrl || 'Unknown';
        networkConfig.networkSeed = kangarooConfig.networkSeed || 'Unknown';
        networkConfig.bootstrapStatus = 'unknown';
      } else {
        // No kangaroo config available - cannot determine actual bootstrap server
        networkConfig.bootstrapUrl = 'Not available';
        networkConfig.signalUrl = 'Not available';
        networkConfig.bootstrapStatus = 'unknown';
      }
    } catch (error) {
      networkConfig.bootstrapStatus = 'error';
      networkConfig.bootstrapUrl = 'Error';
      networkConfig.signalUrl = 'Error';
      console.warn('Failed to fetch network config:', error);
    }
  }

  function getTooltipLines(status: typeof finalConnectionStatus): string[] {
    const baseText = `Connection Status: ${getConnectionText(status)}`;
    const lines: string[] = [];

    if (status === 'connected' && finalLastPingTime) {
      const timeStr = finalLastPingTime.toLocaleTimeString();
      lines.push(`${baseText} (verified at ${timeStr})`);

      // Add network seed information if available
      if (finalNetworkSeed) {
        lines.push(`🌐 Network Seed: ${finalNetworkSeed}`);
        if (finalNetworkInfo) {
          lines.push(`🔬 DNA: ${finalNetworkInfo.dnaHash.slice(0, 8)}...`);
          lines.push(`🎭 Role: ${finalNetworkInfo.roleName}`);
        }
        lines.push(`💡 Compare seeds with other users to verify network`);
      }

      // Add network configuration
      lines.push(`🌐 Bootstrap Server: ${networkConfig.bootstrapUrl}`);
      lines.push(`📡 Signal Server: ${networkConfig.signalUrl}`);

      return lines;
    }

    if ((status === 'disconnected' || status === 'error') && finalPingError) {
      lines.push(`${baseText} - ${finalPingError}`);

      // Add network configuration even when disconnected
      lines.push(`🌐 Bootstrap Server: ${networkConfig.bootstrapUrl}`);
      lines.push(`📡 Signal Server: ${networkConfig.signalUrl}`);

      return lines;
    }

    // Add network configuration for checking status too
    return [
      baseText,
      `🌐 Bootstrap Server: ${networkConfig.bootstrapUrl}`,
      `📡 Signal Server: ${networkConfig.signalUrl}`
    ];
  }

  // Fetch network configuration when component mounts
  onMount(() => {
    fetchNetworkConfig();

    // Refresh network status every 30 seconds
    const interval = setInterval(fetchNetworkConfig, 30000);

    return () => clearInterval(interval);
  });
</script>

<div
  class="z-20 max-w-md rounded-lg border border-surface-700 bg-surface-800 p-4 text-white"
  data-popup="popupStatus"
>
  <div class="space-y-2">
    {#each getTooltipLines(finalConnectionStatus) as line}
      {#if line.includes('Connected')}
        <div class="font-semibold text-success-400">{line}</div>
      {:else if line.includes('Network Seed:')}
        <div class="text-sm">
          <span class="font-medium">🌐 Network Seed:</span>
          <span class="ml-2 break-all font-mono text-xs">{line.split('Network Seed: ')[1]}</span>
        </div>
      {:else if line.includes('DNA:')}
        <div class="text-sm">
          <span class="font-medium">🔬 DNA:</span>
          <span class="ml-2 break-all font-mono text-xs">{finalNetworkInfo?.dnaHash}</span>
        </div>
      {:else if line.includes('Role:')}
        <div class="text-sm">
          <span class="font-medium">🎭 Role:</span>
          <span class="ml-2">{line.split('Role: ')[1]}</span>
        </div>
      {:else if line.includes('Config Network Seed:')}
        <div class="text-sm">
          <span class="font-medium">🌐 Config Network Seed:</span>
          <span class="ml-2 break-all font-mono text-xs"
            >{line.split('Config Network Seed: ')[1]}</span
          >
        </div>
      {:else if line.includes('Bootstrap Server:')}
        <div class="text-sm">
          <span class="font-medium">🌐 Bootstrap Server:</span>
          <span class="ml-2 break-all font-mono text-xs">{line.split('Bootstrap Server: ')[1]}</span
          >
        </div>
      {:else if line.includes('Signal Server:')}
        <div class="text-sm">
          <span class="font-medium">📡 Signal Server:</span>
          <span class="ml-2 break-all font-mono text-xs">{line.split('Signal Server: ')[1]}</span>
        </div>
        {#if networkConfig.signalUrl.includes('holostrap.holo.host') && networkConfig.bootstrapUrl.includes('bootstrap.holo.host')}
          <div class="mt-1 text-xs text-warning-400">
            ⚠️ Mismatch: Signal server different domain from bootstrap
          </div>
        {/if}
      {:else if line.includes('Tip:') || line.includes('Compare seeds')}
        <div class="text-info-300 mt-2 border-t border-surface-600 pt-2 text-sm">
          💡 {line.split('Tip: ')[1] || line.split('💡 ')[1] || line}
        </div>
      {:else if line.includes('Error:')}
        <div class="text-sm text-error-400">❌ {line}</div>
      {:else if line.trim().length > 0}
        <div class="text-sm text-surface-300">{line}</div>
      {/if}
    {/each}
  </div>
</div>
