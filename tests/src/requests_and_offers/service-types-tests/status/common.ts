import { CallableCell } from "@holochain/tryorama";
import { ActionHash, Record } from "@holochain/client";
import { ServiceType, ServiceTypeInput } from "../common";

/**
 * Helper function to suggest a service type (any user)
 */
export async function suggestServiceType(
  cell: CallableCell,
  serviceTypeInput: ServiceTypeInput
): Promise<Record> {
  return cell.callZome({
    zome_name: "service_types",
    fn_name: "suggest_service_type",
    payload: serviceTypeInput,
  });
}

/**
 * Helper function to get all pending service types (admin only)
 */
export async function getPendingServiceTypes(
  cell: CallableCell
): Promise<Record[]> {
  return cell.callZome({
    zome_name: "service_types",
    fn_name: "get_pending_service_types",
    payload: null,
  });
}

/**
 * Helper function to get all approved service types (public)
 */
export async function getApprovedServiceTypes(
  cell: CallableCell
): Promise<Record[]> {
  return cell.callZome({
    zome_name: "service_types",
    fn_name: "get_approved_service_types",
    payload: null,
  });
}

/**
 * Helper function to get all rejected service types (admin only)
 */
export async function getRejectedServiceTypes(
  cell: CallableCell
): Promise<Record[]> {
  return cell.callZome({
    zome_name: "service_types",
    fn_name: "get_rejected_service_types",
    payload: null,
  });
}

/**
 * Helper function to approve a service type (admin only)
 */
export async function approveServiceType(
  cell: CallableCell,
  serviceTypeHash: ActionHash
): Promise<void> {
  return cell.callZome({
    zome_name: "service_types",
    fn_name: "approve_service_type",
    payload: serviceTypeHash,
  });
}

/**
 * Helper function to reject a service type (admin only)
 */
export async function rejectServiceType(
  cell: CallableCell,
  serviceTypeHash: ActionHash
): Promise<void> {
  return cell.callZome({
    zome_name: "service_types",
    fn_name: "reject_service_type",
    payload: serviceTypeHash,
  });
}

/**
 * Helper function to reject an approved service type (admin only)
 */
export async function rejectApprovedServiceType(
  cell: CallableCell,
  serviceTypeHash: ActionHash
): Promise<void> {
  return cell.callZome({
    zome_name: "service_types",
    fn_name: "reject_approved_service_type",
    payload: serviceTypeHash,
  });
}

/**
 * Helper function to check if a service type is approved (internal use)
 */
export async function isServiceTypeApproved(
  cell: CallableCell,
  serviceTypeHash: ActionHash
): Promise<boolean> {
  return cell.callZome({
    zome_name: "service_types",
    fn_name: "is_service_type_approved",
    payload: serviceTypeHash,
  });
}

/**
 * Sample service type for testing with status-related fields
 */
export const sampleServiceTypeForStatus = (
  overrides: Partial<ServiceType> = {}
): ServiceType => ({
  name: "Status Test Service",
  description: "A service type for testing status functionality",
  category: "Testing",
  tags: ["test", "status"],
  verified: false,
  ...overrides,
});
