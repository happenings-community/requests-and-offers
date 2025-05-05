export type UserType = 'creator' | 'advocate';

export type StatusType =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'suspended temporarily'
  | 'suspended indefinitely';

export type UserInDHT = {
  name: string;
  nickname: string;
  bio?: string;
  picture?: Uint8Array;
  user_type: UserType;
  skills?: string[];
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

export enum ContactPreference {
  Email = 'Email',
  Phone = 'Phone',
  Other = 'Other'
}

export enum TimePreference {
  Morning = 'Morning',
  Afternoon = 'Afternoon',
  Evening = 'Evening',
  NoPreference = 'NoPreference',
  Other = 'Other'
}

export enum ExchangePreference {
  Exchange = 'Exchange',
  Arranged = 'Arranged',
  PayItForward = 'PayItForward',
  Open = 'Open'
}

export enum InteractionType {
  Virtual = 'Virtual',
  InPerson = 'InPerson'
}

export type DateRange = {
  start: number | null;
  end: number | null;
};

export type RequestInDHT = {
  title: string;
  description: string;
  requirements: string[];
  contact_preference: ContactPreference;
  date_range?: DateRange;
  time_estimate_hours?: number;
  time_preference: TimePreference;
  time_zone?: string;
  exchange_preference: ExchangePreference;
  interaction_type: InteractionType;
  links: string[];
};

export type OfferInDHT = {
  title: string;
  description: string;
  capabilities: string[];
  time_preference: TimePreference;
  time_zone?: string;
  exchange_preference: ExchangePreference;
  interaction_type: InteractionType;
  links: string[];
};
