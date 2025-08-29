import { CallableCell } from "@holochain/tryorama";
import { ActionHash, Record, AgentPubKey } from "@holochain/client";

export enum ExchangeResponseStatus {
  Pending = "Pending",
  Approved = "Approved",
  Rejected = "Rejected",
}

export interface CreateExchangeResponseInput {
  target_entity_hash: ActionHash;
  service_details: string;
  terms: string;
  exchange_medium: string;
  exchange_value?: string;
  delivery_timeframe?: string;
  notes?: string;
}

export interface ExchangeResponse {
  service_details: string;
  terms: string;
  exchange_medium: string;
  exchange_value?: string;
  delivery_timeframe?: string;
  notes?: string;
  created_at: number;
  updated_at: number;
}

export interface UpdateExchangeResponseStatusInput {
  response_hash: ActionHash;
  new_status: ExchangeResponseStatus;
  reason?: string;
}

export const sampleExchangeResponse = (overrides: Partial<CreateExchangeResponseInput> = {}, targetHash: ActionHash): CreateExchangeResponseInput => ({
  target_entity_hash: targetHash,
  service_details: "I can provide web development services",
  terms: "Payment upon completion",
  exchange_medium: "CAD",
  exchange_value: "500",
  delivery_timeframe: "2 weeks",
  notes: "Experienced in React and TypeScript",
  ...overrides,
});

// Alias for backward compatibility
export const sampleResponseInput = sampleExchangeResponse;

export const createExchangeResponse = async (
  cell: CallableCell,
  input: CreateExchangeResponseInput
): Promise<Record> => {
  return cell.callZome({
    zome_name: "exchanges",
    fn_name: "create_exchange_response",
    payload: input,
  });
};

export const getExchangeResponse = async (
  cell: CallableCell,
  responseHash: ActionHash
): Promise<Record | undefined> => {
  return cell.callZome({
    zome_name: "exchanges",
    fn_name: "get_exchange_response",
    payload: responseHash,
  });
};

export const updateResponseStatus = async (
  cell: CallableCell,
  input: UpdateExchangeResponseStatusInput
): Promise<ActionHash> => {
  return cell.callZome({
    zome_name: "exchanges",
    fn_name: "update_response_status",
    payload: input,
  });
};

export const getResponsesForEntity = async (
  cell: CallableCell,
  entityHash: ActionHash
): Promise<Array<Record>> => {
  return cell.callZome({
    zome_name: "exchanges",
    fn_name: "get_responses_for_entity",
    payload: entityHash,
  });
};

export const getResponsesByStatus = async (
  cell: CallableCell,
  status: ExchangeResponseStatus
): Promise<Array<Record>> => {
  return cell.callZome({
    zome_name: "exchanges",
    fn_name: "get_responses_by_status",
    payload: status,
  });
};

export const getAllResponses = async (
  cell: CallableCell
): Promise<Array<Record>> => {
  return cell.callZome({
    zome_name: "exchanges",
    fn_name: "get_all_responses",
    payload: null,
  });
};

export const getResponsesByAgent = async (
  cell: CallableCell,
  agentPubkey: AgentPubKey
): Promise<Array<Record>> => {
  return cell.callZome({
    zome_name: "exchanges",
    fn_name: "get_responses_by_agent",
    payload: agentPubkey,
  });
};

export const getMyResponses = async (
  cell: CallableCell
): Promise<Array<Record>> => {
  return cell.callZome({
    zome_name: "exchanges",
    fn_name: "get_my_responses",
    payload: null,
  });
};

export const getResponsesReceivedByMe = async (
  cell: CallableCell
): Promise<Array<Record>> => {
  return cell.callZome({
    zome_name: "exchanges",
    fn_name: "get_responses_received_by_me",
    payload: null,
  });
};

export const deleteExchangeResponse = async (
  cell: CallableCell,
  responseHash: ActionHash
): Promise<ActionHash> => {
  return cell.callZome({
    zome_name: "exchanges",
    fn_name: "delete_exchange_response",
    payload: responseHash,
  });
};

export const getTargetEntityForResponse = async (
  cell: CallableCell,
  responseHash: ActionHash
): Promise<ActionHash | undefined> => {
  return cell.callZome({
    zome_name: "exchanges",
    fn_name: "get_target_entity_for_response",
    payload: responseHash,
  });
};

export const getResponseStatusHistory = async (
  cell: CallableCell,
  responseHash: ActionHash
): Promise<Array<Record>> => {
  return cell.callZome({
    zome_name: "exchanges",
    fn_name: "get_response_status_history",
    payload: responseHash,
  });
};

export const getResponseLatestStatus = async (
  cell: CallableCell,
  responseHash: ActionHash
): Promise<Record | undefined> => {
  return cell.callZome({
    zome_name: "exchanges",
    fn_name: "get_response_latest_status",
    payload: responseHash,
  });
};
