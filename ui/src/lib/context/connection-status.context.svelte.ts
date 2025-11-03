import { getContext, setContext } from 'svelte';

/**
 * Connection status context for sharing connection state across layouts
 */
export type ConnectionStatus = 'checking' | 'connected' | 'disconnected' | 'error';
export type AdminLoadingStatus = 'pending' | 'loading' | 'loaded' | 'failed';

export interface ConnectionStatusContext {
  connectionStatus: () => ConnectionStatus;
  lastPingTime: () => Date | null;
  pingError: () => string | null;
  adminLoadingStatus?: () => AdminLoadingStatus;
  networkSeed?: () => string | null;
  networkInfo?: () => { dnaHash: string; roleName: string } | null;
}

const CONNECTION_STATUS_KEY = Symbol('connection-status');

export function setConnectionStatusContext(context: ConnectionStatusContext) {
  setContext(CONNECTION_STATUS_KEY, context);
}

export function getConnectionStatusContext(): ConnectionStatusContext | undefined {
  return getContext(CONNECTION_STATUS_KEY);
}
