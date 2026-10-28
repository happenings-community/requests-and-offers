//! Premise check for the record-op gap.
//!
//! `must_get_valid_record` answers from the record op's verdict alone: the
//! read behind it takes `validation_status` from the action's `CreateRecord`
//! op and never looks at the `CreateEntry` op (holochain_state 0.7.0,
//! `dht_store/reads.rs:926-946`, `get_record_details`). This test shows that
//! on running conductors by marking one op rejected in Bob's DHT database and
//! reading the record through a zome call.
//!
//! The read goes through `update_user`, whose first step is
//! `must_get_valid_record(original)` and whose next step refuses a caller who
//! is not the author. So, called by Bob on Alice's record: "Not the author"
//! means the record was returned; anything else means it was not.

use holochain::prelude::*;
use holochain::sweettest::*;
use holochain_state::data::{open_db, DbKey, Dht, HolochainDataConfig};
use requests_and_offers_sweettest::common::*;
use std::sync::{Arc, Mutex};

/// Reject one op of `record` in `conductor`'s DHT store, by writing its row.
/// Returns how many rows changed.
///
/// The store's own `reject_chain_ops` cannot do this: the update behind it is
/// guarded by `locally_validated = 0` (holochain_data 0.7.0,
/// `dht/inner/chain_op.rs:159-160`), so an op the node validated itself,
/// Alice's own and the one Bob validated on receipt, keeps its verdict. An op
/// fetched from a peer sits in the same `ChainOp` table (holochain_state 0.7.0,
/// `dht_store/cache.rs:3-5`), one row per op hash, so one update covers every
/// copy the node holds and there is no separate cache database.
///
/// The database is encrypted with a key derived from the conductor's
/// passphrase. A Sweettest conductor is built with `ConductorBuilder::test`,
/// which uses the fixed passphrase `"passphrase"` (holochain 0.7.0,
/// `conductor/conductor/builder.rs:417-420`); the locked key is written to
/// `<data root>/databases/db.key` (`conductor/space.rs:128-134`), and
/// `open_db` applies it the way the conductor does.
async fn reject_op(
    conductor: &SweetConductor,
    cell: &SweetCell,
    record: &Record,
    op_type: ChainOpType,
) -> u64 {
    let signed = Signed::new(
        record.signed_action.hashed.content.clone(),
        record.signed_action.signature.clone(),
    );
    let entry = match &record.entry {
        RecordEntry::Present(entry) => OpEntry::Present(entry.clone()),
        _ => OpEntry::ActionOnly,
    };
    let hash = ChainOp::from_type(op_type, signed, entry).to_hash();

    let databases = conductor.db_path().join("databases");
    let locked = std::fs::read_to_string(databases.join("db.key"))
        .expect("the conductor's locked database key");
    let passphrase = Arc::new(Mutex::new(sodoken::LockedArray::from(b"passphrase".to_vec())));
    let key = DbKey::load(locked, passphrase).await.expect("the database key");
    let db = open_db(
        &databases,
        Dht::new(Arc::new(cell.dna_hash().clone())),
        HolochainDataConfig::default().with_key(key),
    )
    .await
    .expect("the cell's DHT database");
    sqlx::query("UPDATE ChainOp SET validation_status = ? WHERE hash = ?")
        .bind(i64::from(RecordValidity::Rejected))
        .bind(hash.get_raw_36().to_vec())
        .execute(db.pool())
        .await
        .expect("the status update")
        .rows_affected()
}

/// Bob asks for Alice's record through `update_user`. See the module doc.
async fn bob_reads(conductors: &SweetConductorBatch, bob: &SweetCell, original: ActionHash) -> String {
    let input = UpdateUserInput {
        original_action_hash: original.clone(),
        previous_action_hash: original,
        updated_user: sample_user("Bob's edit"),
    };
    match conductors[1]
        .call_fallible::<_, Record>(&bob.zome("users_organizations"), "update_user", input)
        .await
    {
        Ok(_) => "the record was returned and updated".to_string(),
        Err(e) => format!("{e:?}"),
    }
}

#[tokio::test(flavor = "multi_thread")]
async fn the_record_read_ignores_the_entry_ops_verdict() {
    let (conductors, alice, bob) = setup_two_agents().await;

    let record: Record = conductors[0]
        .call(&alice.zome("users_organizations"), "create_user", sample_user("Alice"))
        .await;
    let hash = record.signed_action.hashed.hash.clone();
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let both_valid = bob_reads(&conductors, &bob, hash.clone()).await;
    println!("PREMISE both ops valid:      {both_valid}");
    assert!(
        both_valid.contains("Not the author"),
        "with both ops valid the record is returned and the author check refuses Bob"
    );

    let changed = reject_op(&conductors[1], &bob, &record, ChainOpType::CreateEntry).await;
    assert_eq!(changed, 1, "Bob holds Alice's CreateEntry op");
    let entry_rejected = bob_reads(&conductors, &bob, hash.clone()).await;
    println!("PREMISE entry op rejected:   {entry_rejected}");
    assert!(
        entry_rejected.contains("Not the author"),
        "the record is still returned once the entry op is rejected"
    );

    // Control: reject the record op everywhere Bob can read it from, so the
    // read has no valid source left.
    for (conductor, cell) in [(&conductors[0], &alice), (&conductors[1], &bob)] {
        let changed = reject_op(conductor, cell, &record, ChainOpType::CreateRecord).await;
        assert_eq!(changed, 1, "each node holds the CreateRecord op");
    }
    let record_rejected = bob_reads(&conductors, &bob, hash).await;
    println!("PREMISE record op rejected:  {record_rejected}");
    assert!(
        !record_rejected.contains("Not the author"),
        "with the record op rejected the read fails before the author check"
    );
}
