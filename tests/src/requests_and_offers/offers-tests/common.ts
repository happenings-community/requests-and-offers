import { CallableCell } from "@holochain/tryorama";
import { ActionHash, Record } from "@holochain/client";

export interface Offer {
  title: string;
  description: string;
  capabilities: string[];
  availability?: string;
}

export const sampleOffer = (overrides: Partial<Offer> = {}): Offer => ({
  title: "Sample Offer",
  description: "This is a sample offer description",
  capabilities: ["programming", "design"],
  availability: "Full-time",
  ...overrides,
});

export const createOffer = async (
  cell: CallableCell,
  offer: Offer,
  organizationHash?: ActionHash
): Promise<Record> => {
  return cell.callZome({
    zome_name: "offers",
    fn_name: "create_offer",
    payload: {
      offer,
      organization: organizationHash,
    },
  });
};

export const getLatestOfferRecord = async (
  cell: CallableCell,
  originalActionHash: ActionHash
): Promise<Record | undefined> => {
  return cell.callZome({
    zome_name: "offers",
    fn_name: "get_latest_offer_record",
    payload: originalActionHash,
  });
};

export const getLatestOffer = async (
  cell: CallableCell,
  originalActionHash: ActionHash
): Promise<Offer> => {
  return cell.callZome({
    zome_name: "offers",
    fn_name: "get_latest_offer",
    payload: originalActionHash,
  });
};

export const updateOffer = async (
  cell: CallableCell,
  originalActionHash: ActionHash,
  previousActionHash: ActionHash,
  updatedOffer: Offer
): Promise<Record> => {
  return cell.callZome({
    zome_name: "offers",
    fn_name: "update_offer",
    payload: {
      original_action_hash: originalActionHash,
      previous_action_hash: previousActionHash,
      updated_offer: updatedOffer,
    },
  });
};

export const getAllOffers = async (
  cell: CallableCell
): Promise<Array<Record>> => {
  return cell.callZome({
    zome_name: "offers",
    fn_name: "get_all_offers",
    payload: null,
  });
};

export const getUserOffers = async (
  cell: CallableCell,
  userHash: ActionHash
): Promise<Array<Record>> => {
  return cell.callZome({
    zome_name: "offers",
    fn_name: "get_user_offers",
    payload: userHash,
  });
};

export const getOrganizationOffers = async (
  cell: CallableCell,
  organizationHash: ActionHash
): Promise<Array<Record>> => {
  return cell.callZome({
    zome_name: "offers",
    fn_name: "get_organization_offers",
    payload: organizationHash,
  });
};

export const getOfferCreator = async (
  cell: CallableCell,
  offerHash: ActionHash
): Promise<ActionHash> => {
  return cell.callZome({
    zome_name: "offers",
    fn_name: "get_offer_creator",
    payload: offerHash,
  });
};

export const getOfferOrganization = async (
  cell: CallableCell,
  offerHash: ActionHash
): Promise<ActionHash> => {
  return cell.callZome({
    zome_name: "offers",
    fn_name: "get_offer_organization",
    payload: offerHash,
  });
};

export const deleteOffer = async (
  cell: CallableCell,
  originalActionHash: ActionHash
): Promise<boolean> => {
  return cell.callZome({
    zome_name: "offers",
    fn_name: "delete_offer",
    payload: originalActionHash,
  });
};
