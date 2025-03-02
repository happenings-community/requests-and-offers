import { CallableCell } from "@holochain/tryorama";
import { ActionHash, Record } from "@holochain/client";

export enum RequestProcessState {
  Proposed = "Proposed",
  Committed = "Committed",
  InProgress = "InProgress",
  Completed = "Completed",
  Canceled = "Canceled",
}

export interface Request {
  title: string;
  description: string;
  process_state: RequestProcessState;
  skills: string[];
}

export const sampleRequest = (overrides: Partial<Request> = {}): Request => ({
  title: "Sample Request",
  description: "This is a sample request description",
  process_state: RequestProcessState.Proposed,
  skills: ["programming", "design"],
  ...overrides,
});

export const createRequest = async (
  cell: CallableCell,
  request: Request,
  organizationHash?: ActionHash
): Promise<Record> => {
  return cell.callZome({
    zome_name: "requests",
    fn_name: "create_request",
    payload: {
      request,
      organization: organizationHash,
    },
  });
};

export const getLatestRequestRecord = async (
  cell: CallableCell,
  originalActionHash: ActionHash
): Promise<Record | undefined> => {
  return cell.callZome({
    zome_name: "requests",
    fn_name: "get_latest_request_record",
    payload: originalActionHash,
  });
};

export const getLatestRequest = async (
  cell: CallableCell,
  originalActionHash: ActionHash
): Promise<Request> => {
  return cell.callZome({
    zome_name: "requests",
    fn_name: "get_latest_request",
    payload: originalActionHash,
  });
};

export const updateRequest = async (
  cell: CallableCell,
  originalActionHash: ActionHash,
  previousActionHash: ActionHash,
  updatedRequest: Request
): Promise<Record> => {
  return cell.callZome({
    zome_name: "requests",
    fn_name: "update_request",
    payload: {
      original_action_hash: originalActionHash,
      previous_action_hash: previousActionHash,
      updated_request: updatedRequest,
    },
  });
};

export const getAllRequests = async (
  cell: CallableCell
): Promise<Array<Record>> => {
  return cell.callZome({
    zome_name: "requests",
    fn_name: "get_all_requests",
    payload: null,
  });
};

export const getUserRequests = async (
  cell: CallableCell,
  userHash: ActionHash
): Promise<Array<Record>> => {
  return cell.callZome({
    zome_name: "requests",
    fn_name: "get_user_requests",
    payload: userHash,
  });
};

export const getOrganizationRequests = async (
  cell: CallableCell,
  organizationHash: ActionHash
): Promise<Array<Record>> => {
  return cell.callZome({
    zome_name: "requests",
    fn_name: "get_organization_requests",
    payload: organizationHash,
  });
};
