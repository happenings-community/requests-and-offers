// Exchange Composables - Layer 3 Bridge Components
// These composables provide the bridge between the store layer and UI components
// Following the established 7-layer Effect-TS architecture

// General exchanges management (dashboard/overview)
export { useExchangesManagement } from './useExchangesManagement.svelte';
export type { 
  UseExchangesManagement, 
  ExchangesManagementState, 
  ExchangesManagementActions 
} from './useExchangesManagement.svelte';

// Specialized exchange composables for specific workflows

// 1. Proposal Management (URGENT priority - foundation for all UI work)
export { useExchangeProposalsManagement } from './useExchangeProposalsManagement.svelte';
export type { 
  UseExchangeProposalsManagement, 
  ExchangeProposalsManagementState, 
  ExchangeProposalsManagementActions 
} from './useExchangeProposalsManagement.svelte';

// 2. Agreement Management (HIGH priority)
export { useExchangeAgreementManagement } from './useExchangeAgreementManagement.svelte';
export type { 
  UseExchangeAgreementManagement, 
  ExchangeAgreementManagementState, 
  ExchangeAgreementManagementActions 
} from './useExchangeAgreementManagement.svelte';

// 3. Exchange Details (HIGH priority - single source of truth)
export { useExchangeDetails } from './useExchangeDetails.svelte';
export type { 
  UseExchangeDetails, 
  ExchangeDetailsState, 
  ExchangeDetailsActions,
  ExchangeAction
} from './useExchangeDetails.svelte';

// 4. Cancellation Management (MEDIUM priority)
export { useExchangeCancellationManagement } from './useExchangeCancellationManagement.svelte';
export type { 
  UseExchangeCancellationManagement, 
  ExchangeCancellationManagementState, 
  ExchangeCancellationManagementActions 
} from './useExchangeCancellationManagement.svelte';

// 5. Feedback Management (MEDIUM priority)
export { useExchangeFeedbackManagement } from './useExchangeFeedbackManagement.svelte';
export type { 
  UseExchangeFeedbackManagement, 
  ExchangeFeedbackManagementState, 
  ExchangeFeedbackManagementActions,
  ReviewStats
} from './useExchangeFeedbackManagement.svelte';