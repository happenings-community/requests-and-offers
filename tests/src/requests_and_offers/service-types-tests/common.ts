import { CallableCell } from "@holochain/tryorama";
import { ActionHash, Record } from "@holochain/client";

export interface ServiceType {
  name: string;
  description?: string;
  category?: string;
  tags: string[];
  verified: boolean;
}

export interface ServiceTypeInput {
  service_type: ServiceType;
}

export interface UpdateServiceTypeInput {
  original_service_type_hash: ActionHash;
  previous_service_type_hash: ActionHash;
  updated_service_type: ServiceType;
}

export interface ServiceTypeLinkInput {
  service_type_hash: ActionHash;
  action_hash: ActionHash;
  entity: string; // "request" or "offer"
}

export interface GetServiceTypeForEntityInput {
  original_action_hash: ActionHash;
  entity: string; // "request" or "offer"
}

export interface UpdateServiceTypeLinksInput {
  action_hash: ActionHash;
  entity: string; // "request" or "offer"
  new_service_type_hashes: ActionHash[];
}

export const sampleServiceType = (
  overrides: Partial<ServiceType> = {},
): ServiceType => ({
  name: "Web Development",
  description: "Frontend and backend web development services",
  category: "Technology",
  tags: ["javascript", "react", "nodejs"],
  verified: false,
  ...overrides,
});

export async function createServiceType(
  cell: CallableCell,
  serviceTypeInput: ServiceTypeInput,
): Promise<Record> {
  return cell.callZome({
    zome_name: "service_types",
    fn_name: "create_service_type",
    payload: serviceTypeInput,
  });
}

export async function getAllServiceTypes(
  cell: CallableCell,
): Promise<Record[]> {
  return cell.callZome({
    zome_name: "service_types",
    fn_name: "get_all_service_types",
    payload: null,
  });
}

export async function getServiceType(
  cell: CallableCell,
  serviceTypeHash: ActionHash,
): Promise<Record | null> {
  return cell.callZome({
    zome_name: "service_types",
    fn_name: "get_service_type",
    payload: serviceTypeHash,
  });
}

export async function getLatestServiceTypeRecord(
  cell: CallableCell,
  originalActionHash: ActionHash,
): Promise<Record | null> {
  return cell.callZome({
    zome_name: "service_types",
    fn_name: "get_latest_service_type_record",
    payload: originalActionHash,
  });
}

export async function updateServiceType(
  cell: CallableCell,
  updateInput: UpdateServiceTypeInput,
): Promise<ActionHash> {
  return cell.callZome({
    zome_name: "service_types",
    fn_name: "update_service_type",
    payload: updateInput,
  });
}

export async function deleteServiceType(
  cell: CallableCell,
  serviceTypeHash: ActionHash,
): Promise<ActionHash> {
  return cell.callZome({
    zome_name: "service_types",
    fn_name: "delete_service_type",
    payload: serviceTypeHash,
  });
}

export async function getRequestsForServiceType(
  cell: CallableCell,
  serviceTypeHash: ActionHash,
): Promise<Record[]> {
  return cell.callZome({
    zome_name: "service_types",
    fn_name: "get_requests_for_service_type",
    payload: serviceTypeHash,
  });
}

export async function getOffersForServiceType(
  cell: CallableCell,
  serviceTypeHash: ActionHash,
): Promise<Record[]> {
  return cell.callZome({
    zome_name: "service_types",
    fn_name: "get_offers_for_service_type",
    payload: serviceTypeHash,
  });
}

export async function linkToServiceType(
  cell: CallableCell,
  input: ServiceTypeLinkInput,
): Promise<void> {
  return cell.callZome({
    zome_name: "service_types",
    fn_name: "link_to_service_type",
    payload: input,
  });
}

export async function unlinkFromServiceType(
  cell: CallableCell,
  input: ServiceTypeLinkInput,
): Promise<void> {
  return cell.callZome({
    zome_name: "service_types",
    fn_name: "unlink_from_service_type",
    payload: input,
  });
}

export async function updateServiceTypeLinks(
  cell: CallableCell,
  input: UpdateServiceTypeLinksInput,
): Promise<void> {
  return cell.callZome({
    zome_name: "service_types",
    fn_name: "update_service_type_links",
    payload: input,
  });
}

export async function getServiceTypesForEntity(
  cell: CallableCell,
  input: GetServiceTypeForEntityInput,
): Promise<ActionHash[]> {
  return cell.callZome({
    zome_name: "service_types",
    fn_name: "get_service_types_for_entity",
    payload: input,
  });
}

export async function deleteAllServiceTypeLinksForEntity(
  cell: CallableCell,
  input: GetServiceTypeForEntityInput,
): Promise<void> {
  return cell.callZome({
    zome_name: "service_types",
    fn_name: "delete_all_service_type_links_for_entity",
    payload: input,
  });
}

// Tag-related test functions
export async function getAllServiceTypeTags(
  cell: CallableCell,
): Promise<string[]> {
  return cell.callZome({
    zome_name: "service_types",
    fn_name: "get_all_service_type_tags",
    payload: null,
  });
}

export async function getServiceTypesByTag(
  cell: CallableCell,
  tag: string,
): Promise<Record[]> {
  return cell.callZome({
    zome_name: "service_types",
    fn_name: "get_service_types_by_tag",
    payload: tag,
  });
}

export async function getServiceTypesByTags(
  cell: CallableCell,
  tags: string[],
): Promise<Record[]> {
  return cell.callZome({
    zome_name: "service_types",
    fn_name: "get_service_types_by_tags",
    payload: tags,
  });
}

export async function searchServiceTypesByTagPrefix(
  cell: CallableCell,
  prefix: string,
): Promise<Record[]> {
  return cell.callZome({
    zome_name: "service_types",
    fn_name: "search_service_types_by_tag_prefix",
    payload: prefix,
  });
}

export async function getTagStatistics(
  cell: CallableCell,
): Promise<Array<[string, number]>> {
  return cell.callZome({
    zome_name: "service_types",
    fn_name: "get_tag_statistics",
    payload: null,
  });
}

// Helper function to create service types with specific tags for testing
export const sampleServiceTypeWithTags = (
  name: string,
  tags: string[],
  overrides: Partial<ServiceType> = {},
): ServiceType => ({
  name,
  description: `${name} service description`,
  category: "Technology",
  tags,
  verified: false,
  ...overrides,
});
