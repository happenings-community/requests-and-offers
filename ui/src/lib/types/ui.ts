import type { ActionHash, AgentPubKey } from '@holochain/client';
import type {
  UserInDHT,
  StatusInDHT,
  OrganizationInDHT,
  RequestInDHT,
  OfferInDHT,
  ServiceTypeInDHT
} from './holochain';
import type * as Effect from 'effect/Effect';
import type { Record as HolochainRecord } from '@holochain/client';
import type { Schema as S } from 'effect';

export enum OrganizationRole {
  Member = 'member',
  Coordinator = 'coordinator'
}

export type UIStatus = StatusInDHT & {
  duration?: number;
  original_action_hash?: ActionHash;
  previous_action_hash?: ActionHash;
};

export type Revision = {
  status: UIStatus;
  timestamp: number;
  entity: UIUser | UIOrganization;
};

export type UIUser = UserInDHT & {
  agents?: AgentPubKey[];
  remaining_time?: number;
  original_action_hash?: ActionHash;
  previous_action_hash?: ActionHash;
  status?: UIStatus;
  status_history?: Revision[];
  organizations?: ActionHash[];
  role?: OrganizationRole;
  service_type_hashes?: ActionHash[];
};

export type UIOrganization = OrganizationInDHT & {
  members: ActionHash[];
  coordinators: ActionHash[];
  status?: UIStatus;
  original_action_hash?: ActionHash;
  previous_action_hash?: ActionHash;
};

export type UIRequest = RequestInDHT & {
  original_action_hash?: ActionHash;
  previous_action_hash?: ActionHash;
  creator?: ActionHash;
  organization?: ActionHash;
  created_at?: number;
  updated_at?: number;
  service_type_hashes?: ActionHash[];
};

export type UIOffer = OfferInDHT & {
  original_action_hash?: ActionHash;
  previous_action_hash?: ActionHash;
  creator?: ActionHash;
  organization?: ActionHash;
  created_at?: number;
  updated_at?: number;
  service_type_hashes?: ActionHash[];
};

export type UIServiceType = ServiceTypeInDHT & {
  original_action_hash?: ActionHash;
  previous_action_hash?: ActionHash;
  creator?: ActionHash;
  created_at?: number;
  updated_at?: number;
  status: 'pending' | 'approved' | 'rejected';
};

export type AlertModalMeta = {
  id: string;
  message: string;
  confirmLabel?: string;
};

export type ConfirmModalMeta = {
  id: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

export type PromptModalMeta = {
  id: string;
  message: string;
  inputs: {
    label: string;
    type: 'text' | 'number' | 'password';
    name: string;
    placeholder?: string;
    value?: string;
    required?: boolean;
    min?: number;
    max?: number;
  }[];
  confirmText?: string;
};

// Composable-related UI types
// Standard composable options interface
export interface UseComposableOptions<TState = {}> {
  initialState?: Partial<TState>;
  onStateChange?: (state: TState) => void;
  dependencies?: Record<string, unknown>;
}

// Standard composable return interface
export interface UseComposableReturn<TState, TActions> {
  // State (always derived for reactivity)
  state: TState;

  // Computed/derived values
  computed?: Record<string, unknown>;

  // Actions (Effect-based functions)
  actions: TActions;

  // Cleanup function
  cleanup?: () => void;
}

// Base state interface that all composables should extend
export interface BaseComposableState {
  isLoading: boolean;
  error: string | null;
}

// Management composable options
export interface UseManagementOptions<TEntity> {
  autoLoad?: boolean;
  cacheEnabled?: boolean;
  onEntityChange?: (entities: TEntity[]) => void;
  initialState?: Partial<BaseComposableState>;
  onStateChange?: (state: BaseComposableState) => void;
}

// Management composable actions
export interface UseManagementActions<TEntity, TInput> {
  load: () => Promise<void>;
  create: (input: TInput) => Promise<TEntity>;
  update: (id: string, input: Partial<TInput>) => Promise<TEntity>;
  delete: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

// Search composable options
export interface UseSearchOptions<TEntity> {
  debounceMs?: number;
  minSearchLength?: number;
  urlParamSync?: boolean;
  onResultsChange?: (results: TEntity[]) => void;
  tagCloudBehavior?: 'toggle' | 'add-only';
  initialState?: Partial<SearchComposableState>;
  onStateChange?: (state: SearchComposableState) => void;
}

// Search composable state
export interface SearchComposableState extends BaseComposableState {
  searchTerm: string;
  selectedFilterTags: string[];
  tagFilterMode: 'any' | 'all';
  showAdvancedSearch: boolean;
}

// Search composable actions
export interface UseSearchActions<TEntity> {
  search: (term: string) => void;
  filter: (filters: Record<string, unknown>) => void;
  clearSearch: () => void;
  clearFilters: () => void;
  clearAll: () => void;
  filterEntities: (entities: TEntity[]) => TEntity[];
  handleTagFilterChange: (tags: string[]) => void;
  toggleAdvancedSearch: () => void;
  handleTagCloudClick: (tag: string) => void;
}

// Modal composable options
export interface UseModalOptions {
  autoFocus?: boolean;
  closeOnEscape?: boolean;
  closeOnOutsideClick?: boolean;
}

// Modal composable actions
export interface UseModalActions {
  open: (component: any, props?: Record<string, unknown>) => Promise<unknown>;
  close: (result?: unknown) => void;
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
}

// Confirm modal options
export interface ConfirmOptions {
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
}

// ============================================================================
// Toast Composable Types
// ============================================================================

export interface UseToastActions {
  show: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

// ============================================================================
// Pagination Composable Types
// ============================================================================

export interface UsePaginationOptions {
  items: readonly any[];
  initialPage?: number;
  pageSize: number;
  pageSizeOptions?: readonly number[];
}

export interface UsePaginationState {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface UsePaginationActions {
  goToPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  updateItems: (newItems: readonly any[]) => void;
  setPageSize: (size: number) => void;
}

export interface UsePagination {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  canGoPrevious: boolean;
  canGoNext: boolean;
  paginatedItems: readonly any[];
  goToPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  updateItems: (newItems: readonly any[]) => void;
  setPageSize: (size: number) => void;
  pageSizeOptions: readonly number[];
}

// Utility types for common patterns
export type ComposableCleanupFunction = () => void;
export type ComposableStateUpdater<T> = (updater: () => void) => void;

// =================================================================
// Form Validation Composable
// =================================================================

export type FormErrors<T> = Partial<Record<keyof T, string>>;

export type FormState<T extends object> = {
  values: T;
  errors: FormErrors<T>;
  touched: Partial<Record<keyof T, boolean>>;
};

export type FormActions<T extends object> = {
  updateField: <K extends keyof T>(field: K, value: T[K]) => void;
  setTouched: (field: keyof T, isTouched: boolean) => void;
  validateField: (field: keyof T) => Promise<boolean>;
  validateForm: () => Effect.Effect<
    T,
    { _tag: 'ValidationError'; errors: FormErrors<T> } | { _tag: 'UnknownError'; error: unknown }
  >;
  reset: () => void;
};

export type UseFormValidation<T extends object> = {
  isValid: boolean;
  isDirty: boolean;
} & FormState<T> &
  FormActions<T>;

export interface UseFormValidationOptions<T extends object> {
  schema: S.Schema<T>;
  initialValues: T;
}
