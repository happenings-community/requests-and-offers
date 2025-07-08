import { CallableCell } from "@holochain/tryorama";
import { ActionHash, Record } from "@holochain/client";

export interface MediumOfExchange {
  code: string;
  name: string;
  resource_spec_hrea_id?: string | null;
}

export interface MediumOfExchangeInput {
  medium_of_exchange: MediumOfExchange;
}

export const sampleMediumOfExchange = (
  overrides: Partial<MediumOfExchange> = {}
): MediumOfExchange => ({
  code: "USD",
  name: "US Dollar",
  resource_spec_hrea_id: null,
  ...overrides,
});

export async function suggestMediumOfExchange(
  cell: CallableCell,
  mediumOfExchangeInput: MediumOfExchangeInput
): Promise<Record> {
  return cell.callZome({
    zome_name: "mediums_of_exchange",
    fn_name: "suggest_medium_of_exchange",
    payload: mediumOfExchangeInput,
  });
}

export async function getMediumOfExchange(
  cell: CallableCell,
  mediumOfExchangeHash: ActionHash
): Promise<Record | null> {
  return cell.callZome({
    zome_name: "mediums_of_exchange",
    fn_name: "get_medium_of_exchange",
    payload: mediumOfExchangeHash,
  });
}

export async function getAllMediumsOfExchange(
  cell: CallableCell
): Promise<Record[]> {
  return cell.callZome({
    zome_name: "mediums_of_exchange",
    fn_name: "get_all_mediums_of_exchange",
    payload: null,
  });
}

export async function getPendingMediumsOfExchange(
  cell: CallableCell
): Promise<Record[]> {
  return cell.callZome({
    zome_name: "mediums_of_exchange",
    fn_name: "get_pending_mediums_of_exchange",
    payload: null,
  });
}

export async function getApprovedMediumsOfExchange(
  cell: CallableCell
): Promise<Record[]> {
  return cell.callZome({
    zome_name: "mediums_of_exchange",
    fn_name: "get_approved_mediums_of_exchange",
    payload: null,
  });
}

export async function getRejectedMediumsOfExchange(
  cell: CallableCell
): Promise<Record[]> {
  return cell.callZome({
    zome_name: "mediums_of_exchange",
    fn_name: "get_rejected_mediums_of_exchange",
    payload: null,
  });
}

export async function approveMediumOfExchange(
  cell: CallableCell,
  mediumOfExchangeHash: ActionHash
): Promise<void> {
  return cell.callZome({
    zome_name: "mediums_of_exchange",
    fn_name: "approve_medium_of_exchange",
    payload: mediumOfExchangeHash,
  });
}

export async function rejectMediumOfExchange(
  cell: CallableCell,
  mediumOfExchangeHash: ActionHash
): Promise<void> {
  return cell.callZome({
    zome_name: "mediums_of_exchange",
    fn_name: "reject_medium_of_exchange",
    payload: mediumOfExchangeHash,
  });
}
