import type { ActionHash, AgentPubKey } from '@holochain/client';
import type {
  UserInDHT,
  StatusInDHT,
  OrganizationInDHT,
  RequestInDHT,
  OfferInDHT,
  ServiceTypeInDHT
} from './holochain';

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
    type: 'text' | 'number';
    name: string;
    placeholder?: string;
    value?: string;
    required?: boolean;
    min?: number;
    max?: number;
  }[];
  confirmText?: string;
};
