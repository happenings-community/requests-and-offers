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

export type RequestInDHT = {
  title: string;
  description: string;
  requirements: string[];
  urgency?: string;
};

export type OfferInDHT = {
  title: string;
  description: string;
  capabilities: string[];
  availability?: string;
};
