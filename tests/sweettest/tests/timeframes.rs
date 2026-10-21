//! Timeframes and quantities on listings (#370, #307): the honest paths
//! read back by a second conductor, every refusal with its reason, and the
//! update rule: dates are checked when set or changed, never when left as
//! they were, so an expired listing can still be archived.

use holochain::prelude::*;
use holochain::sweettest::*;
use requests_and_offers_sweettest::common::*;

const DAY: i64 = 24 * 60 * 60 * 1_000_000;

fn now_micros() -> i64 {
    Timestamp::now().as_micros()
}

fn window(start_days: Option<i64>, end_days: i64) -> Timeframe {
    Timeframe::Dates {
        start: start_days.map(|d| now_micros() + d * DAY),
        end: now_micros() + end_days * DAY,
    }
}

fn refused<T: std::fmt::Debug>(result: Result<T, String>, reason: &str, what: &str) {
    match result {
        Ok(v) => panic!("{what}: expected a refusal naming \"{reason}\", but it was accepted: {v:?}"),
        Err(e) => assert!(e.contains(reason), "{what}: refused, but not for \"{reason}\". The error was: {e}"),
    }
}

/// Alice (progenitor, admin) accepted; Bob accepted. Returns (conductors, alice, bob).
async fn two_members() -> (SweetConductorBatch, SweetCell, SweetCell) {
    let (conductors, alice, bob) = setup_two_agents_with_alice_as_progenitor().await;
    conductors[0]
        .call::<_, Record>(&alice.zome("users_organizations"), "create_user", sample_user("Alice"))
        .await;
    conductors[1]
        .call::<_, Record>(&bob.zome("users_organizations"), "create_user", sample_user("Bob"))
        .await;
    await_consistency_s(15, [&alice, &bob]).await.unwrap();
    for (i, cell) in [(0, &alice), (1, &bob)] {
        let links: Vec<Link> = conductors[i]
            .call(&cell.zome("users_organizations"), "get_agent_user", cell.agent_pubkey().clone())
            .await;
        let user = links[0].target.clone().into_action_hash().unwrap();
        accept_entity(&conductors[0], &alice, ENTITY_USERS, user).await;
    }
    await_consistency_s(15, [&alice, &bob]).await.unwrap();
    (conductors, alice, bob)
}

fn request_entry(record: &Record) -> Request {
    record.entry().to_app_option().unwrap().expect("request entry")
}

fn update_request_input(original: &ActionHash, previous: &ActionHash, updated: &RequestData) -> serde_json::Value {
    serde_json::json!({
        "original_action_hash": original,
        "previous_action_hash": previous,
        "updated_request": updated,
        "service_type_hashes": [],
        "medium_of_exchange_hashes": []
    })
}

/// Each preset, and a window with and without a start, on a request; Bob
/// reads each back as written.
#[tokio::test(flavor = "multi_thread")]
async fn a_request_carries_a_preset_or_a_window() {
    let (conductors, alice, bob) = two_members().await;
    let timeframes = [
        Timeframe::Preset(TimeframePreset::WithinAFewDays),
        Timeframe::Preset(TimeframePreset::WithinTwoWeeks),
        Timeframe::Preset(TimeframePreset::WithinAMonth),
        Timeframe::Preset(TimeframePreset::Flexible),
        window(None, 10),
        window(Some(2), 10),
    ];
    for timeframe in timeframes {
        let mut input = sample_request("Help with gardening");
        input.request.timeframe = Some(timeframe.clone());
        input.request.amount = Some(Quantity { value: 3.0, unit: "Time bank hours".to_string() });
        let record: Record = conductors[0]
            .call(&alice.zome("requests"), "create_request", input)
            .await;
        let hash = record.signed_action.hashed.hash.clone();
        await_consistency_s(15, [&alice, &bob]).await.unwrap();
        let read: Option<Record> = conductors[1]
            .call(&bob.zome("requests"), "get_latest_request_record", hash)
            .await;
        let request = request_entry(&read.expect("Bob reads the request"));
        assert_eq!(request.timeframe, Some(timeframe.clone()), "{timeframe:?}");
        assert_eq!(request.amount.as_ref().map(|q| q.value), Some(3.0));
    }
}

/// An offer with hours, an amount and a preset, read by a second conductor.
#[tokio::test(flavor = "multi_thread")]
async fn an_offer_carries_hours_an_amount_and_a_timeframe() {
    let (conductors, alice, bob) = two_members().await;
    let mut input = sample_offer("Web design review");
    input.offer.timeframe = Some(Timeframe::Preset(TimeframePreset::WithinAMonth));
    input.offer.time_estimate_hours = Some(2.0);
    input.offer.amount = Some(Quantity { value: 20.0, unit: "GBP".to_string() });
    let record: Record = conductors[0]
        .call(&alice.zome("offers"), "create_offer", input)
        .await;
    let hash = record.signed_action.hashed.hash.clone();
    await_consistency_s(15, [&alice, &bob]).await.unwrap();
    let read: Option<Record> = conductors[1]
        .call(&bob.zome("offers"), "get_latest_offer_record", hash)
        .await;
    let offer: Offer = read.expect("Bob reads the offer").entry().to_app_option().unwrap().expect("offer entry");
    assert_eq!(offer.timeframe, Some(Timeframe::Preset(TimeframePreset::WithinAMonth)));
    assert_eq!(offer.time_estimate_hours, Some(2.0));
    assert_eq!(offer.amount, Some(Quantity { value: 20.0, unit: "GBP".to_string() }));

    // Zero hours is a figure.
    let mut zero = sample_offer("Free advice");
    zero.offer.time_estimate_hours = Some(0.0);
    let _: Record = conductors[0].call(&alice.zome("offers"), "create_offer", zero).await;
}

/// Every window the rules refuse, with its reason, on a request and an offer.
#[tokio::test(flavor = "multi_thread")]
async fn a_window_in_the_past_a_year_out_or_inside_out_is_refused() {
    let (conductors, alice, _bob) = two_members().await;
    let attacks = [
        ("a past end", window(None, -1), "must end after the moment it is written"),
        ("an end more than a year out", window(None, 366), "must end within 365 days"),
        ("a start after the end", window(Some(11), 10), "must not start after it ends"),
    ];
    for (what, timeframe, reason) in attacks {
        let mut request = sample_request("Help with gardening");
        request.request.timeframe = Some(timeframe.clone());
        let result = conductors[0]
            .call_fallible::<_, Record>(&alice.zome("requests"), "create_request", request)
            .await
            .map_err(|e| format!("{e:?}"));
        refused(result, reason, &format!("a request with {what}"));
        let mut offer = sample_offer("Web design review");
        offer.offer.timeframe = Some(timeframe);
        let result = conductors[0]
            .call_fallible::<_, Record>(&alice.zome("offers"), "create_offer", offer)
            .await
            .map_err(|e| format!("{e:?}"));
        refused(result, reason, &format!("an offer with {what}"));
    }
}

/// Hours and amounts that are not figures, on a request and an offer.
#[tokio::test(flavor = "multi_thread")]
async fn hours_and_amounts_must_be_figures() {
    let (conductors, alice, _bob) = two_members().await;
    let q = |value: f64, unit: &str| Some(Quantity { value, unit: unit.to_string() });
    let attacks: Vec<(&str, Option<f64>, Option<Quantity>, &str)> = vec![
        ("NaN hours", Some(f64::NAN), None, "hours must be a finite number"),
        ("infinite hours", Some(f64::INFINITY), None, "hours must be a finite number"),
        ("negative hours", Some(-1.0), None, "hours cannot be negative"),
        ("a zero amount", Some(1.0), q(0.0, "GBP"), "above zero"),
        ("a negative amount", Some(1.0), q(-5.0, "GBP"), "above zero"),
        ("a NaN amount", Some(1.0), q(f64::NAN, "GBP"), "above zero"),
        ("an infinite amount", Some(1.0), q(f64::INFINITY, "GBP"), "above zero"),
        ("an amount without a unit", Some(1.0), q(5.0, ""), "with a unit"),
    ];
    for (what, hours, amount, reason) in attacks {
        let mut request = sample_request("Help with gardening");
        request.request.time_estimate_hours = hours;
        request.request.amount = amount.clone();
        let result = conductors[0]
            .call_fallible::<_, Record>(&alice.zome("requests"), "create_request", request)
            .await
            .map_err(|e| format!("{e:?}"));
        refused(result, reason, &format!("a request with {what}"));
        let mut offer = sample_offer("Web design review");
        offer.offer.time_estimate_hours = hours;
        offer.offer.amount = amount;
        let result = conductors[0]
            .call_fallible::<_, Record>(&alice.zome("offers"), "create_offer", offer)
            .await
            .map_err(|e| format!("{e:?}"));
        refused(result, reason, &format!("an offer with {what}"));
    }
}

/// The update rule: a window left as it was is not re-checked, so an expired
/// listing is archived; a window changed to one in the past is refused.
#[tokio::test(flavor = "multi_thread")]
async fn an_expired_window_is_kept_on_archive_but_not_set_anew() {
    let (conductors, alice, bob) = two_members().await;
    // A window that ends one second from now: valid when written, expired by
    // the time the update below is made.
    let short = Timeframe::Dates { start: None, end: now_micros() + 1_000_000 };
    let mut input = sample_request("Help with gardening");
    input.request.timeframe = Some(short.clone());
    let record: Record = conductors[0]
        .call(&alice.zome("requests"), "create_request", input.clone())
        .await;
    let hash = record.signed_action.hashed.hash.clone();
    await_consistency_s(15, [&alice, &bob]).await.unwrap();
    // Let the window expire; the case is about what happens after it has.
    tokio::time::sleep(std::time::Duration::from_secs(2)).await;

    // Archiving with the window unchanged is accepted.
    let archived = RequestData { status: "Archived".to_string(), ..input.request.clone() };
    let archived_record: Record = conductors[0]
        .call(&alice.zome("requests"), "update_request", update_request_input(&hash, &hash, &archived))
        .await;
    assert_eq!(request_entry(&archived_record).timeframe, Some(short));
    let archived_hash = archived_record.signed_action.hashed.hash.clone();

    // Changing the window to one in the past is refused.
    let moved = RequestData { timeframe: Some(window(None, -1)), ..input.request.clone() };
    let result = conductors[0]
        .call_fallible::<_, Record>(
            &alice.zome("requests"),
            "update_request",
            update_request_input(&hash, &archived_hash, &moved),
        )
        .await
        .map_err(|e| format!("{e:?}"));
    refused(result, "must end after the moment it is written", "an update moving the window into the past");

    // Changing it to a valid window is accepted.
    let renewed = RequestData { timeframe: Some(window(None, 7)), ..input.request.clone() };
    let _: Record = conductors[0]
        .call(&alice.zome("requests"), "update_request", update_request_input(&hash, &archived_hash, &renewed))
        .await;
}
