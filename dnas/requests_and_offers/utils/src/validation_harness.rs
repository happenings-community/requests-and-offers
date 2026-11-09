//! Build DHT ops by hand and call an integrity zome's `validate` on the host.
//!
//! Holochain publishes a create or update as several ops that go to different
//! authorities: `CreateEntry` to the entry's neighbourhood, `CreateRecord` to the
//! action's. A Sweettest cannot show what one op alone does, because every
//! honest conductor, the author's included, validates all of an action's ops
//! inline and refuses the commit if any one fails (holochain 0.7.0,
//! `core/workflow/call_zome_workflow.rs:195`, `inline_validation` at `:273`). These helpers let a unit
//! test hand `validate` exactly one op, so the verdict on the record op can be
//! seen on its own.
//!
//! Host only. On wasm the HDI talks to the conductor; on the host it talks to
//! whatever `set_hdi` installed (hdi 0.8.0, `src/hdi.rs:216`). `validate`
//! needs `zome_info` to map entry and link indexes onto the zome's enums, and
//! a pure rule needs nothing else.

use hdk::prelude::hdi::prelude::*;

/// Install a stand-in host whose `zome_info` says the calling zome is zome 0
/// with `entry_types` entry types and `link_types` link types, which is what
/// `EntryTypes::ENUM_LEN` and `LinkTypes::ENUM_LEN` give. Every other host
/// function panics: a rule that reads the DHT cannot be tested this way.
pub fn set_zome_types(entry_types: u8, link_types: u8) {
  struct StandIn(ScopedZomeTypesSet);

  #[allow(unused_variables)]
  impl HdiT for StandIn {
    fn zome_info(&self, _: ()) -> ExternResult<ZomeInfo> {
      Ok(ZomeInfo {
        name: String::default().into(),
        id: ZomeIndex(0),
        properties: Default::default(),
        entry_defs: EntryDefs(Default::default()),
        extern_fns: Default::default(),
        zome_types: self.0.clone(),
      })
    }
    fn verify_signature(&self, input: VerifySignature) -> ExternResult<bool> {
      unimplemented!("verify_signature is not available in the validation harness")
    }
    fn must_get_entry(&self, input: MustGetEntryInput) -> ExternResult<EntryHashed> {
      unimplemented!("must_get_entry is not available in the validation harness")
    }
    fn must_get_action(&self, input: MustGetActionInput) -> ExternResult<SignedActionHashed> {
      unimplemented!("must_get_action is not available in the validation harness")
    }
    fn must_get_valid_record(&self, input: MustGetValidRecordInput) -> ExternResult<Record> {
      unimplemented!("must_get_valid_record is not available in the validation harness")
    }
    fn must_get_agent_activity(
      &self,
      input: MustGetAgentActivityInput,
    ) -> ExternResult<Vec<AgentActivity>> {
      unimplemented!("must_get_agent_activity is not available in the validation harness")
    }
    fn dna_info(&self, _: ()) -> ExternResult<DnaInfo> {
      unimplemented!("dna_info is not available in the validation harness")
    }
    fn trace(&self, _: TraceMsg) -> ExternResult<()> {
      Ok(())
    }
    fn x_salsa20_poly1305_decrypt(
      &self,
      input: XSalsa20Poly1305Decrypt,
    ) -> ExternResult<Option<XSalsa20Poly1305Data>> {
      unimplemented!("decryption is not available in the validation harness")
    }
    fn x_25519_x_salsa20_poly1305_decrypt(
      &self,
      input: X25519XSalsa20Poly1305Decrypt,
    ) -> ExternResult<Option<XSalsa20Poly1305Data>> {
      unimplemented!("decryption is not available in the validation harness")
    }
    fn ed_25519_x_salsa20_poly1305_decrypt(
      &self,
      input: Ed25519XSalsa20Poly1305Decrypt,
    ) -> ExternResult<XSalsa20Poly1305Data> {
      unimplemented!("decryption is not available in the validation harness")
    }
  }

  set_hdi(StandIn(ScopedZomeTypesSet {
    entries: ScopedZomeTypes(vec![(
      ZomeIndex(0),
      (0..entry_types).map(EntryDefIndex).collect(),
    )]),
    links: ScopedZomeTypes(vec![(
      ZomeIndex(0),
      (0..link_types).map(LinkType).collect(),
    )]),
  }));
}

/// The two ops of a create that carry the entry, as `(CreateEntry, CreateRecord)`.
/// `entry_index` is the entry's position in the zome's `EntryTypes`.
pub fn create_ops(entry_index: u8, bytes: SerializedBytes) -> (Op, Op) {
  let entry = app_entry(bytes);
  let create = CreateData {
    entry_type: entry_type(entry_index),
    entry_hash: EntryHash::with_data_sync(&entry),
  };
  both_ops(header(7, 2), ActionData::Create(create), entry)
}

/// The two ops of an update that carry the new entry, as `(CreateEntry, CreateRecord)`.
pub fn update_ops(entry_index: u8, bytes: SerializedBytes) -> (Op, Op) {
  let entry = app_entry(bytes);
  let update = UpdateData {
    original_action_address: action_hash(2),
    original_entry_address: EntryHash::from_raw_36(vec![4; 36]),
    entry_type: entry_type(entry_index),
    entry_hash: EntryHash::with_data_sync(&entry),
  };
  both_ops(header(8, 3), ActionData::Update(update), entry)
}

/// On 0.7 an action is a header shared by every kind plus the kind's own data,
/// so one signed action serves both ops.
fn both_ops(header: ActionHeader, data: ActionData, entry: Entry) -> (Op, Op) {
  let signed = SignedActionHashed::with_presigned(
    ActionHashed::from_content_sync(Action { header, data }),
    signature(),
  );
  let entry_op = Op::CreateEntry(CreateEntry {
    action: signed.clone(),
    entry: entry.clone(),
  });
  let record_op = Op::CreateRecord(CreateRecord {
    record: Record::new(signed, RecordEntry::Present(entry)),
  });
  (entry_op, record_op)
}

fn header(action_seq: u32, prev_fill: u8) -> ActionHeader {
  ActionHeader {
    author: author(),
    timestamp: when(),
    action_seq,
    prev_action: Some(action_hash(prev_fill)),
  }
}

fn app_entry(bytes: SerializedBytes) -> Entry {
  Entry::app(bytes).expect("the test entry fits in an app entry")
}

fn entry_type(entry_index: u8) -> EntryType {
  EntryType::App(AppEntryDef {
    entry_index: EntryDefIndex(entry_index),
    zome_index: ZomeIndex(0),
    visibility: EntryVisibility::Public,
  })
}

fn author() -> AgentPubKey {
  AgentPubKey::from_raw_36(vec![1; 36])
}

fn action_hash(fill: u8) -> ActionHash {
  ActionHash::from_raw_36(vec![fill; 36])
}

fn when() -> Timestamp {
  Timestamp::from_micros(1_760_000_000_000_000)
}

/// Signatures are not checked by app validation; any bytes will do.
fn signature() -> Signature {
  Signature([0; SIGNATURE_BYTES])
}
