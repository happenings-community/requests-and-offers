//! A modified client, for Sweettest: writes by zome and type index, with no
//! checks of its own. The integrity zomes are the only thing between these
//! calls and the DHT, which is the point.

use hdk::prelude::*;

/// The DNA's integrity zomes, in `ZomeIndex` order, so a test can find the
/// index of the zome it wants to write into by name.
#[hdk_extern]
pub fn integrity_zome_names(_: ()) -> ExternResult<Vec<String>> {
  Ok(
    dna_info()?
      .zome_names
      .into_iter()
      .map(|name| name.to_string())
      .collect(),
  )
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ForgeEntryInput {
  pub zome_index: u8,
  pub entry_index: u8,
  pub entry: SerializedBytes,
}

/// Creates a public app entry of the given type from the bytes as given.
#[hdk_extern]
pub fn forge_entry(input: ForgeEntryInput) -> ExternResult<ActionHash> {
  create(CreateInput::new(
    EntryDefLocation::app(input.zome_index, input.entry_index),
    EntryVisibility::Public,
    Entry::App(AppEntryBytes::try_from(input.entry).map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?),
    ChainTopOrdering::default(),
  ))
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ForgeUpdateInput {
  pub original_action_hash: ActionHash,
  pub entry: SerializedBytes,
}

/// Updates a record with the bytes as given.
#[hdk_extern]
pub fn forge_update(input: ForgeUpdateInput) -> ExternResult<ActionHash> {
  update(UpdateInput {
    original_action_address: input.original_action_hash,
    entry: Entry::App(AppEntryBytes::try_from(input.entry).map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?),
    chain_top_ordering: ChainTopOrdering::default(),
  })
}

/// Deletes a record.
#[hdk_extern]
pub fn forge_delete(action_hash: ActionHash) -> ExternResult<ActionHash> {
  delete(DeleteInput::new(action_hash, ChainTopOrdering::default()))
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ForgeLinkInput {
  pub base: AnyLinkableHash,
  pub target: AnyLinkableHash,
  pub zome_index: u8,
  pub link_type: u8,
  pub tag: Vec<u8>,
}

/// Creates a link of the given type with the tag as given.
#[hdk_extern]
pub fn forge_link(input: ForgeLinkInput) -> ExternResult<ActionHash> {
  create_link(
    input.base,
    input.target,
    ScopedLinkType {
      zome_index: ZomeIndex(input.zome_index),
      zome_type: LinkType(input.link_type),
    },
    LinkTag::new(input.tag),
  )
}

/// A record, as any zome sees it.
#[hdk_extern]
pub fn forge_get(action_hash: ActionHash) -> ExternResult<Option<Record>> {
  get(action_hash, GetOptions::default())
}
