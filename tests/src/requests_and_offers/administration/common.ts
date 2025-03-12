import { CallableCell } from "@holochain/tryorama";
import { ActionHash, Record, Link, AgentPubKey } from "@holochain/client";

export type StatusType =
  | "pending"
  | "accepted"
  | "rejected"
  | "suspended temporarily"
  | "suspended indefinitely";

export enum AdministrationEntity {
  Network = "network",
  Users = "users",
  Organizations = "organizations",
}

export type Status = {
  status_type: StatusType;
  reason?: string;
  suspended_until?: number;
};

export async function getAllUsers(cell: CallableCell): Promise<Link[]> {
  return cell.callZome({
    zome_name: "users_organizations",
    fn_name: "get_all_users",
  });
}

export async function registerNetworkAdministrator(
  cell: CallableCell,
  entity_original_action_hash: ActionHash,
  agent_pubkeys: AgentPubKey[]
): Promise<boolean> {
  return cell.callZome({
    zome_name: "administration",
    fn_name: "register_administrator",
    payload: {
      entity: AdministrationEntity.Network,
      entity_original_action_hash,
      agent_pubkeys,
    },
  });
}

export async function getAllAdministratorsLinks(
  cell: CallableCell
): Promise<Link[]> {
  return cell.callZome({
    zome_name: "administration",
    fn_name: "get_all_administrators_links",
    payload: "network",
  });
}

export function checkIfEntityIsAdministrator(
  cell: CallableCell,
  entity_original_action_hash: ActionHash
): Promise<boolean> {
  return cell.callZome({
    zome_name: "administration",
    fn_name: "check_if_entity_is_administrator",
    payload: {
      entity: AdministrationEntity.Network,
      entity_original_action_hash,
    },
  });
}

export async function checkIfAgentIsAdministrator(
  cell: CallableCell,
  agent_pubkey: AgentPubKey
): Promise<boolean> {
  return cell.callZome({
    zome_name: "administration",
    fn_name: "check_if_agent_is_administrator",
    payload: {
      entity: AdministrationEntity.Network,
      agent_pubkey,
    },
  });
}

export async function removeAdministrator(
  cell: CallableCell,
  entity_original_action_hash: ActionHash,
  agent_pubkeys: AgentPubKey[]
): Promise<boolean> {
  return cell.callZome({
    zome_name: "administration",
    fn_name: "remove_administrator",
    payload: {
      entity: AdministrationEntity.Network,
      entity_original_action_hash,
      agent_pubkeys,
    },
  });
}

export async function addAdministrator(
  cell: CallableCell,
  entity: string,
  agent_pubkeys: AgentPubKey[]
): Promise<boolean> {
  return cell.callZome({
    zome_name: "administration",
    fn_name: "add_administrator",
    payload: {
      entity,
      entity_original_action_hash: null, // For network administrators, this can be null
      agent_pubkeys,
    },
  });
}

export async function getLatestStatusRecordForEntity(
  cell: CallableCell,
  entity: AdministrationEntity,
  entity_original_action_hash: ActionHash
): Promise<Record | null> {
  return cell.callZome({
    zome_name: "administration",
    fn_name: "get_latest_status_record_for_entity",
    payload: {
      entity,
      entity_original_action_hash,
    },
  });
}

export async function getLatestStatusForEntity(
  cell: CallableCell,
  entity: AdministrationEntity,
  entity_original_action_hash: ActionHash
): Promise<Status | null> {
  return cell.callZome({
    zome_name: "administration",
    fn_name: "get_latest_status_for_entity",
    payload: {
      entity,
      entity_original_action_hash,
    },
  });
}

export async function updateEntityStatus(
  cell: CallableCell,
  entity: AdministrationEntity,
  entity_original_action_hash: ActionHash,
  status_original_action_hash: ActionHash,
  status_previous_action_hash: ActionHash,
  new_status: Status
): Promise<Record> {
  return cell.callZome({
    zome_name: "administration",
    fn_name: "update_entity_status",
    payload: {
      entity,
      entity_original_action_hash,
      status_original_action_hash,
      status_previous_action_hash,
      new_status,
    },
  });
}

export async function suspendEntityTemporarily(
  cell: CallableCell,
  entity: AdministrationEntity,
  entity_original_action_hash: ActionHash,
  status_original_action_hash: ActionHash,
  status_previous_action_hash: ActionHash,
  reason: string,
  duration_in_days: number
): Promise<boolean> {
  return cell.callZome({
    zome_name: "administration",
    fn_name: "suspend_entity_temporarily",
    payload: {
      entity,
      entity_original_action_hash,
      status_original_action_hash,
      status_previous_action_hash,
      reason,
      duration_in_days,
    },
  });
}

export async function suspendEntityIndefinitely(
  cell: CallableCell,
  entity: AdministrationEntity,
  entity_original_action_hash: ActionHash,
  status_original_action_hash: ActionHash,
  status_previous_action_hash: ActionHash,
  reason: string
): Promise<boolean> {
  return cell.callZome({
    zome_name: "administration",
    fn_name: "suspend_entity_indefinitely",
    payload: {
      entity,
      entity_original_action_hash,
      status_original_action_hash,
      status_previous_action_hash,
      reason,
    },
  });
}

export async function unsuspendEntity(
  cell: CallableCell,
  entity: AdministrationEntity,
  entity_original_action_hash: ActionHash,
  status_original_action_hash: ActionHash,
  status_previous_action_hash: ActionHash
): Promise<boolean> {
  return cell.callZome({
    zome_name: "administration",
    fn_name: "unsuspend_entity",
    payload: {
      entity,
      entity_original_action_hash,
      status_original_action_hash,
      status_previous_action_hash,
    },
  });
}

export async function unsuspendEntityIfTimePassed(
  cell: CallableCell,
  entity: AdministrationEntity,
  entity_original_action_hash: ActionHash,
  status_original_action_hash: ActionHash,
  status_previous_action_hash: ActionHash
): Promise<boolean> {
  return cell.callZome({
    zome_name: "administration",
    fn_name: "unsuspend_entity_if_time_passed",
    payload: {
      entity,
      entity_original_action_hash,
      status_original_action_hash,
      status_previous_action_hash,
    },
  });
}

export async function getAllRevisionsForStatus(
  cell: CallableCell,
  status_original_action_hash: ActionHash
): Promise<Record[]> {
  return cell.callZome({
    zome_name: "administration",
    fn_name: "get_all_revisions_for_status",
    payload: status_original_action_hash,
  });
}
