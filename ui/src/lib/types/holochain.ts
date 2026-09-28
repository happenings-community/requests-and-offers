import type { ActionHash } from '@holochain/client';

export type UserType = 'creator' | 'advocate';

export type StatusType =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'archived'
  | 'suspended temporarily'
  | 'suspended indefinitely';

export type UserInDHT = {
  name: string;
  nickname: string;
  bio?: string;
  picture?: Uint8Array;
  user_type: UserType;
  email: string;
  phone?: string;
  time_zone?: string;
  location?: string;
};

export type StatusInDHT = {
  status_type: StatusType;
  reason?: string;
  suspended_until?: string;
};

export type OrganizationInDHT = {
  name: string;
  description: string;
  full_legal_name: string;
  logo?: Uint8Array;
  email: string;
  urls: string[];
  location: string;
};

export enum AdministrationEntity {
  Network = 'network',
  Users = 'users',
  Organizations = 'organizations'
}

export type ContactPreference = 'Email' | 'Phone' | { Other: string };

export type TimePreference =
  | 'Morning'
  | 'Afternoon'
  | 'Evening'
  | 'NoPreference'
  | { Other: string };

// Helper functions for preference types
export const ContactPreferenceHelpers = {
  isOther: (pref: ContactPreference): pref is { Other: string } =>
    typeof pref === 'object' && 'Other' in pref,

  createOther: (value: string): { Other: string } => ({ Other: value }),

  getValue: (pref: ContactPreference): string =>
    typeof pref === 'object' && 'Other' in pref ? pref.Other : (pref as string),

  getDisplayValue: (pref: ContactPreference): string =>
    typeof pref === 'object' && 'Other' in pref ? pref.Other || 'Other' : (pref as string)
};

export const TimePreferenceHelpers = {
  isOther: (pref: TimePreference): pref is { Other: string } =>
    typeof pref === 'object' && 'Other' in pref,

  createOther: (value: string): { Other: string } => ({ Other: value }),

  getValue: (pref: TimePreference): string =>
    typeof pref === 'object' && 'Other' in pref ? pref.Other : (pref as string),

  getDisplayValue: (pref: TimePreference): string =>
    typeof pref === 'object' && 'Other' in pref ? pref.Other || 'Other' : (pref as string)
};

export enum InteractionType {
  Virtual = 'Virtual',
  InPerson = 'InPerson'
}

export enum ListingStatus {
  Active = 'Active',
  Archived = 'Archived',
  Deleted = 'Deleted'
}

export type DateRange = {
  start: number | null;
  end: number | null;
};

export type RequestInDHT = {
  title: string;
  description: string;
  contact_preference: ContactPreference;
  date_range?: DateRange;
  time_estimate_hours?: number;
  time_preference: TimePreference;
  time_zone?: string;
  interaction_type: InteractionType;
  links: string[];
  status: ListingStatus;
};

export type OfferInDHT = {
  title: string;
  description: string;
  time_preference: TimePreference;
  time_zone?: string;
  interaction_type: InteractionType;
  links: string[];
  status: ListingStatus;
};

export type ServiceTypeInDHT = {
  name: string;
  description: string;
  technical: boolean;
};

// Input types for coordinator layer (include service type hashes for linking)
export type RequestInput = RequestInDHT & {
  service_type_hashes: ActionHash[];
  medium_of_exchange_hashes: ActionHash[];
  organization?: ActionHash;
};

export type OfferInput = OfferInDHT & {
  service_type_hashes: ActionHash[];
  medium_of_exchange_hashes: ActionHash[];
  organization?: ActionHash;
};

// ============================================================================
// EXCHANGES
// See documentation/architecture/EXCHANGE_RECORD.md. Six append-only entries;
// status is derived by the zome and never stored.
// ============================================================================

export type ListingType = 'Request' | 'Offer';
export type ExchangeDirection = 'Provide' | 'Receive';
export type ResourceKind = 'Service' | 'Currency' | 'Gift' | 'Tbd';

export type ExchangeQuantity = {
  value: number;
  unit: string;
};

export type ExchangeTerm = {
  direction: ExchangeDirection;
  resource_conforms_to: string;
  resource_kind: ResourceKind;
  quantity: ExchangeQuantity | null;
};

export type InterestInDHT = {
  listing: ActionHash;
  listing_type: ListingType;
  user: ActionHash;
};

export type AgreementInDHT = {
  listing: ActionHash;
  listing_type: ListingType;
  interest: ActionHash;
  counterparty: ActionHash;
  provider: ActionHash;
  receiver: ActionHash;
  primary: ExchangeTerm;
  reciprocal: ExchangeTerm;
  medium: string;
  terms: string;
  delivery_timeframe: string;
};

export type ResponseInDHT = {
  agreement: ActionHash;
  accepted: boolean;
  note: string;
};

export type CompletionInDHT = {
  agreement: ActionHash;
};

export type ReviewInDHT = {
  agreement: ActionHash;
  rating: number;
  on_time: boolean;
  as_agreed: boolean;
  comment: string;
};

export type CancellationInDHT = {
  agreement: ActionHash;
  note: string;
};

export type ExchangeStatus =
  | 'Proposed'
  | 'Agreed'
  | 'ProviderDelivered'
  | 'Complete'
  | 'Reviewed'
  | 'Declined'
  | 'Cancelled';

/** The zome's read model for one exchange: the agreement and its children. */
export type ExchangeReadModel = {
  agreement: import('@holochain/client').Record;
  response: import('@holochain/client').Record | null;
  provider_completion: import('@holochain/client').Record | null;
  receiver_completion: import('@holochain/client').Record | null;
  provider_review: import('@holochain/client').Record | null;
  receiver_review: import('@holochain/client').Record | null;
  cancellation: import('@holochain/client').Record | null;
  status: ExchangeStatus;
};

export type CreateAgreementInput = {
  listing: ActionHash;
  listing_type: ListingType;
  interest: ActionHash;
  primary: ExchangeTerm;
  reciprocal: ExchangeTerm;
  medium: string;
  terms: string;
  delivery_timeframe: string;
};

export type ReviewInput = {
  rating: number;
  on_time: boolean;
  as_agreed: boolean;
  comment: string;
};
