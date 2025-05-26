import { CallableCell } from "@holochain/tryorama";
import { Record } from "@holochain/client";

export async function createServiceType(
  cell: CallableCell,
  serviceTypeInput: any
): Promise<Record> {
  return cell.callZome({
    zome_name: "service_types",
    fn_name: "create_service_type",
    payload: serviceTypeInput,
  });
}

export async function getAllServiceTypes(
  cell: CallableCell
): Promise<Record[]> {
  return cell.callZome({
    zome_name: "service_types",
    fn_name: "get_all_service_types",
    payload: null,
  });
}

export async function getServiceType(
  cell: CallableCell,
  serviceTypeHash: any
): Promise<Record> {
  return cell.callZome({
    zome_name: "service_types",
    fn_name: "get_service_type",
    payload: serviceTypeHash,
  });
}

export async function updateServiceType(
  cell: CallableCell,
  updateInput: any
): Promise<any> {
  return cell.callZome({
    zome_name: "service_types",
    fn_name: "update_service_type",
    payload: updateInput,
  });
}

export async function deleteServiceType(
  cell: CallableCell,
  serviceTypeHash: any
): Promise<any> {
  return cell.callZome({
    zome_name: "service_types",
    fn_name: "delete_service_type",
    payload: serviceTypeHash,
  });
}

export async function getRequestsForServiceType(
  cell: CallableCell,
  serviceTypeHash: any
): Promise<Record[]> {
  return cell.callZome({
    zome_name: "service_types",
    fn_name: "get_requests_for_service_type",
    payload: serviceTypeHash,
  });
}

export async function getOffersForServiceType(
  cell: CallableCell,
  serviceTypeHash: any
): Promise<Record[]> {
  return cell.callZome({
    zome_name: "service_types",
    fn_name: "get_offers_for_service_type",
    payload: serviceTypeHash,
  });
}
