import { CallableCell } from "@holochain/tryorama";
import { ActionHash, Record, Timestamp } from "@holochain/client";

export interface DateRange {
  start?: Timestamp;
  end?: Timestamp;
}

export enum ContactPreference {
  Email = "Email",
  Phone = "Phone",
  Other = "Other",
}

export enum TimePreference {
  Morning = "Morning",
  Afternoon = "Afternoon",
  Evening = "Evening",
  NoPreference = "NoPreference",
  Other = "Other",
}

export enum ExchangePreference {
  Exchange = "Exchange",
  Arranged = "Arranged",
  PayItForward = "PayItForward",
  Open = "Open",
}

export enum InteractionType {
  Virtual = "Virtual",
  InPerson = "InPerson",
}

export interface Request {
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
}

export const sampleRequest = (overrides: Partial<Request> = {}): Request => ({
  title: "Sample Request",
  description: "This is a sample request description",
  requirements: ["programming", "design"],
  contact_preference: ContactPreference.Email,
  date_range: {
    start: null,
    end: null,
  },
  time_estimate_hours: 5,
  time_preference: TimePreference.Morning,
  time_zone: "UTC-5",
  exchange_preference: ExchangePreference.Exchange,
  interaction_type: InteractionType.Virtual,
  links: ["https://example.com/resource"],
  ...overrides,
});

export const createRequest = async (
  cell: CallableCell,
  request: Request,
  organizationHash?: ActionHash,
  serviceTypeHashes?: ActionHash[],
): Promise<Record> => {
  return cell.callZome({
    zome_name: "requests",
    fn_name: "create_request",
    payload: {
      request,
      organization: organizationHash,
      service_type_hashes: serviceTypeHashes || [],
    },
  });
};

export const getLatestRequestRecord = async (
  cell: CallableCell,
  originalActionHash: ActionHash,
): Promise<Record | undefined> => {
  return cell.callZome({
    zome_name: "requests",
    fn_name: "get_latest_request_record",
    payload: originalActionHash,
  });
};

export const getLatestRequest = async (
  cell: CallableCell,
  originalActionHash: ActionHash,
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
  updatedRequest: Request,
  serviceTypeHashes?: ActionHash[],
): Promise<Record> => {
  return cell.callZome({
    zome_name: "requests",
    fn_name: "update_request",
    payload: {
      original_action_hash: originalActionHash,
      previous_action_hash: previousActionHash,
      updated_request: updatedRequest,
      service_type_hashes: serviceTypeHashes || [],
    },
  });
};

export const getAllRequests = async (
  cell: CallableCell,
): Promise<Array<Record>> => {
  return cell.callZome({
    zome_name: "requests",
    fn_name: "get_all_requests",
    payload: null,
  });
};

export const getUserRequests = async (
  cell: CallableCell,
  userHash: ActionHash,
): Promise<Array<Record>> => {
  return cell.callZome({
    zome_name: "requests",
    fn_name: "get_user_requests",
    payload: userHash,
  });
};

export const getOrganizationRequests = async (
  cell: CallableCell,
  organizationHash: ActionHash,
): Promise<Array<Record>> => {
  return cell.callZome({
    zome_name: "requests",
    fn_name: "get_organization_requests",
    payload: organizationHash,
  });
};

export const deleteRequest = async (
  cell: CallableCell,
  originalActionHash: ActionHash,
): Promise<boolean> => {
  return cell.callZome({
    zome_name: "requests",
    fn_name: "delete_request",
    payload: originalActionHash,
  });
};

export const archiveRequest = async (
  cell: CallableCell,
  originalActionHash: ActionHash,
): Promise<boolean> => {
  return cell.callZome({
    zome_name: "requests",
    fn_name: "archive_request",
    payload: originalActionHash,
  });
};

// Tag-based discovery functions
export const getRequestsByTag = async (
  cell: CallableCell,
  tag: string,
): Promise<Array<Record>> => {
  return cell.callZome({
    zome_name: "requests",
    fn_name: "get_requests_by_tag",
    payload: tag,
  });
};
