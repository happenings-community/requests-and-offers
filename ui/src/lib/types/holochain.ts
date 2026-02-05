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
