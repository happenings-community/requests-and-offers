// Simplified Exchange Composables - Basic workflow only
// Following the simplified exchange process plan with 3 core entities

// General exchanges management (simplified dashboard)
export { useExchangesManagement } from './useExchangesManagement.svelte';
export type { 
  UseExchangesManagement, 
  ExchangesManagementState, 
  ExchangesManagementActions 
} from './useExchangesManagement.svelte';

// Core exchange composables for simplified workflow

// 1. Proposal Management (create, approve/reject proposals)
export { useExchangeProposalsManagement } from './useExchangeProposalsManagement.svelte';
export type { 
  UseExchangeProposalsManagement, 
  ExchangeProposalsManagementState, 
  ExchangeProposalsManagementActions 
} from './useExchangeProposalsManagement.svelte';

// 2. Agreement Management (mark complete, basic workflow)
export { useExchangeAgreementManagement } from './useExchangeAgreementManagement.svelte';
export type { 
  UseExchangeAgreementManagement, 
  ExchangeAgreementManagementState, 
  ExchangeAgreementManagementActions 
} from './useExchangeAgreementManagement.svelte';

// 3. Exchange Details (single source of truth for exchange data)
export { useExchangeDetails } from './useExchangeDetails.svelte';
export type { 
  UseExchangeDetails, 
  ExchangeDetailsState, 
  ExchangeDetailsActions,
  ExchangeAction
} from './useExchangeDetails.svelte';

// 4. Basic Feedback Management (simple star ratings + reviews)
export { useExchangeFeedbackManagement } from './useExchangeFeedbackManagement.svelte';
export type { 
  UseExchangeFeedbackManagement, 
  ExchangeFeedbackManagementState, 
  ExchangeFeedbackManagementActions,
  ReviewStats
} from './useExchangeFeedbackManagement.svelte';