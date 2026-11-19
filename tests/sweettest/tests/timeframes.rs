//! Timeframes, time estimates and amounts on listings (#380, #370, #307, #525):
//! the honest paths read back by a second conductor, every refusal with its
//! reason, and the update rule: a window is checked when it is set or changed,
//! never when it is left as it was, so an expired listing can still be archived.
//!
//! A listing's `time_estimate_hours` is an estimate of the time the task takes,
//! an exact decimal and never exchanged; its `amount` is what it asks or offers
//! in payment, in a unit (a currency, or a time-bank medium).

use holochain::prelude::*;
use holochain::sweettest::*;
use requests_and_offers_sweettest::common::*;
use serde_json::json;

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

fn quantity(value: &str, unit: &str) -> Option<Quantity> {
    Some(Quantity {
        value: value.to_string(),
        unit: unit.to_string(),
    })
}

fn refused<T: std::fmt::Debug>(result: Result<T, String>, reason: &str, what: &str) {
    match result {
        Ok(v) => panic!("{what}: expected a refusal naming \"{reason}\", but it was accepted: {v:?}"),
        Err(e) => assert!(
            e.contains(reason),
            "{what}: refused, but not for \"{reason}\". The error was: {e}"
        ),
    }
}

/// Alice (progenitor, admin) and Bob, both accepted, and one approved service
/// type, which every listing names (#256). Returns (conductors, alice, bob,
/// service type).
async fn two_members() -> (SweetConductorBatch, SweetCell, SweetCell, ActionHash) {
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
    // A progenitor's service type lands approved.
    let service_type: Record = conductors[0]
        .call(&alice.zome("service_types"), "create_service_type", sample_service_type("Gardening"))
        .await;
    let service_type = service_type.signed_action.hashed.hash.clone();
    await_consistency_s(15, [&alice, &bob]).await.unwrap();
    (conductors, alice, bob, service_type)
}

fn request_entry(record: &Record) -> Request {
    record.entry().to_app_option().unwrap().expect("request entry")
}

fn offer_entry(record: &Record) -> Offer {
    record.entry().to_app_option().unwrap().expect("offer entry")
}

/// Each preset, and a window with and without a start, on a request, with an
/// amount in a time-bank medium; Bob reads each back as written.
#[tokio::test(flavor = "multi_thread")]
async fn a_request_carries_a_preset_or_a_window() {
    let (conductors, alice, bob, st) = two_members().await;
    let timeframes = [
        Timeframe::Preset(TimeframePreset::WithinAFewDays),
        Timeframe::Preset(TimeframePreset::WithinTwoWeeks),
        Timeframe::Preset(TimeframePreset::WithinAMonth),
        Timeframe::Preset(TimeframePreset::Flexible),
        window(None, 10),
        window(Some(2), 10),
    ];
    for timeframe in timeframes {
        let mut input = sample_request("Help with gardening", st.clone());
        input.request.timeframe = Some(timeframe.clone());
        input.request.time_estimate_hours = Some("1.5".to_string());
        input.request.amount = quantity("3", "Time Banking");
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
        assert_eq!(request.time_estimate_hours.as_deref(), Some("1.5"));
        assert_eq!(request.amount, quantity("3", "Time Banking"));
    }
}

/// An offer with a time estimate, an amount and a preset, read by a second
/// conductor; and a zero estimate, which is an estimate.
#[tokio::test(flavor = "multi_thread")]
async fn an_offer_carries_a_time_estimate_an_amount_and_a_timeframe() {
    let (conductors, alice, bob, st) = two_members().await;
    let mut input = sample_offer("Web design review", st.clone());
    input.offer.timeframe = Some(Timeframe::Preset(TimeframePreset::WithinAMonth));
    input.offer.time_estimate_hours = Some("2".to_string());
    input.offer.amount = quantity("20", "GBP");
    let record: Record = conductors[0]
        .call(&alice.zome("offers"), "create_offer", input)
        .await;
    let hash = record.signed_action.hashed.hash.clone();
    await_consistency_s(15, [&alice, &bob]).await.unwrap();
    let read: Option<Record> = conductors[1]
        .call(&bob.zome("offers"), "get_latest_offer_record", hash)
        .await;
    let offer = offer_entry(&read.expect("Bob reads the offer"));
    assert_eq!(offer.timeframe, Some(Timeframe::Preset(TimeframePreset::WithinAMonth)));
    assert_eq!(offer.time_estimate_hours.as_deref(), Some("2"));
    assert_eq!(offer.amount, quantity("20", "GBP"));

    let mut zero = sample_offer("Free advice", st.clone());
    zero.offer.time_estimate_hours = Some("0".to_string());
    let _: Record = conductors[0]
        .call(&alice.zome("offers"), "create_offer", zero)
        .await;
}

/// Every window the rules refuse, with its reason, on a request and an offer.
#[tokio::test(flavor = "multi_thread")]
async fn a_window_in_the_past_a_year_out_or_inside_out_is_refused() {
    let (conductors, alice, _bob, st) = two_members().await;
    let attacks = [
        ("a past end", window(None, -1), "must end after the moment it is written"),
        ("an end more than a year out", window(None, 366), "must end within 365 days"),
        ("a start after the end", window(Some(11), 10), "must not start after it ends"),
    ];
    for (what, timeframe, reason) in attacks {
        let mut request = sample_request("Help with gardening", st.clone());
        request.request.timeframe = Some(timeframe.clone());
        let result = conductors[0]
            .call_fallible::<_, Record>(&alice.zome("requests"), "create_request", request)
            .await
            .map_err(|e| format!("{e:?}"));
        refused(result, reason, &format!("a request with {what}"));
        let mut offer = sample_offer("Web design review", st.clone());
        offer.offer.timeframe = Some(timeframe);
        let result = conductors[0]
            .call_fallible::<_, Record>(&alice.zome("offers"), "create_offer", offer)
            .await
            .map_err(|e| format!("{e:?}"));
        refused(result, reason, &format!("an offer with {what}"));
    }
}

/// Time estimates and amounts that are not exact decimals, or amounts that are
/// not above zero with a unit, on a request and an offer.
#[tokio::test(flavor = "multi_thread")]
async fn time_estimates_and_amounts_must_be_decimals() {
    let (conductors, alice, _bob, st) = two_members().await;
    let attacks: Vec<(&str, Option<String>, Option<Quantity>, &str)> = vec![
        ("an estimate with an exponent", Some("1e3".into()), None, "a time estimate is not a decimal"),
        ("a negative estimate", Some("-1".into()), None, "a time estimate is not a decimal"),
        ("an estimate with a comma", Some("1,5".into()), None, "a time estimate is not a decimal"),
        ("a zero amount", None, quantity("0", "GBP"), "an amount must be above zero"),
        ("an amount without a unit", None, quantity("5", ""), "an amount must name its unit"),
        ("a negative amount", None, quantity("-5", "GBP"), "an amount is not a decimal"),
        ("an amount that is not a number", None, quantity("NaN", "GBP"), "an amount is not a decimal"),
    ];
    for (what, hours, amount, reason) in attacks {
        let mut request = sample_request("Help with gardening", st.clone());
        request.request.time_estimate_hours = hours.clone();
        request.request.amount = amount.clone();
        let result = conductors[0]
            .call_fallible::<_, Record>(&alice.zome("requests"), "create_request", request)
            .await
            .map_err(|e| format!("{e:?}"));
        refused(result, reason, &format!("a request with {what}"));
        let mut offer = sample_offer("Web design review", st.clone());
        offer.offer.time_estimate_hours = hours;
        offer.offer.amount = amount;
        let result = conductors[0]
            .call_fallible::<_, Record>(&alice.zome("offers"), "create_offer", offer)
            .await
            .map_err(|e| format!("{e:?}"));
        refused(result, reason, &format!("an offer with {what}"));
    }
}

/// The update rule on a request and an offer: a window left as it was is not
/// checked again, so an expired listing is archived; a window changed to one
/// in the past is refused; a valid new window is accepted.
#[tokio::test(flavor = "multi_thread")]
async fn an_expired_window_is_kept_on_archive_but_not_set_anew() {
    let (conductors, alice, bob, st) = two_members().await;
    // A window that ends a second from now: valid when written, expired by the
    // time the updates below are made.
    let short = Timeframe::Dates {
        start: None,
        end: now_micros() + 1_000_000,
    };

    let mut request = sample_request("Help with gardening", st.clone());
    request.request.timeframe = Some(short.clone());
    let request_record: Record = conductors[0]
        .call(&alice.zome("requests"), "create_request", request.clone())
        .await;
    let request_hash = request_record.signed_action.hashed.hash.clone();

    let mut offer = sample_offer("Web design review", st.clone());
    offer.offer.timeframe = Some(short.clone());
    let offer_record: Record = conductors[0]
        .call(&alice.zome("offers"), "create_offer", offer.clone())
        .await;
    let offer_hash = offer_record.signed_action.hashed.hash.clone();

    await_consistency_s(15, [&alice, &bob]).await.unwrap();
    // Let the window expire: the case is about what happens after it has.
    tokio::time::sleep(std::time::Duration::from_secs(2)).await;

    // The request.
    let update_request = |previous: &ActionHash, updated: &RequestData| {
        json!({
            "original_action_hash": request_hash,
            "previous_action_hash": previous,
            "updated_request": updated,
            "service_type_hash": st,
            "medium_of_exchange_hashes": []
        })
    };
    let archived = RequestData {
        status: "Archived".to_string(),
        ..request.request.clone()
    };
    let archived_record: Record = conductors[0]
        .call(&alice.zome("requests"), "update_request", update_request(&request_hash, &archived))
        .await;
    assert_eq!(request_entry(&archived_record).timeframe, Some(short.clone()));
    let archived_hash = archived_record.signed_action.hashed.hash.clone();
    let moved = RequestData {
        timeframe: Some(window(None, -1)),
        ..request.request.clone()
    };
    let result = conductors[0]
        .call_fallible::<_, Record>(&alice.zome("requests"), "update_request", update_request(&archived_hash, &moved))
        .await
        .map_err(|e| format!("{e:?}"));
    refused(result, "must end after the moment it is written", "a request update moving the window into the past");
    let renewed = RequestData {
        timeframe: Some(window(None, 7)),
        ..request.request.clone()
    };
    let _: Record = conductors[0]
        .call(&alice.zome("requests"), "update_request", update_request(&archived_hash, &renewed))
        .await;

    // The offer.
    let update_offer = |previous: &ActionHash, updated: &OfferData| {
        json!({
            "original_action_hash": offer_hash,
            "previous_action_hash": previous,
            "updated_offer": updated,
            "service_type_hash": st,
            "medium_of_exchange_hashes": []
        })
    };
    let archived = OfferData {
        status: "Archived".to_string(),
        ..offer.offer.clone()
    };
    let archived_record: Record = conductors[0]
        .call(&alice.zome("offers"), "update_offer", update_offer(&offer_hash, &archived))
        .await;
    assert_eq!(offer_entry(&archived_record).timeframe, Some(short));
    let archived_hash = archived_record.signed_action.hashed.hash.clone();
    let moved = OfferData {
        timeframe: Some(window(None, -1)),
        ..offer.offer.clone()
    };
    let result = conductors[0]
        .call_fallible::<_, Record>(&alice.zome("offers"), "update_offer", update_offer(&archived_hash, &moved))
        .await
        .map_err(|e| format!("{e:?}"));
    refused(result, "must end after the moment it is written", "an offer update moving the window into the past");
    let renewed = OfferData {
        timeframe: Some(window(None, 7)),
        ..offer.offer.clone()
    };
    let _: Record = conductors[0]
        .call(&alice.zome("offers"), "update_offer", update_offer(&archived_hash, &renewed))
        .await;
}

/// A timeframe is one or the other: a preset and dates together do not read
/// as a timeframe, so the write is refused before it reaches the zome's rules.
#[tokio::test(flavor = "multi_thread")]
async fn a_preset_and_dates_together_do_not_deserialise() {
    let (conductors, alice, _bob, st) = two_members().await;
    let mut input = serde_json::to_value(sample_request("Help with gardening", st.clone())).unwrap();
    input["request"]["timeframe"] = json!({
        "Preset": "WithinTwoWeeks",
        "Dates": { "start": null, "end": now_micros() + 10 * DAY }
    });
    let result = conductors[0]
        .call_fallible::<_, Record>(&alice.zome("requests"), "create_request", input)
        .await
        .map_err(|e| format!("{e:?}"));
    assert!(
        matches!(&result, Err(e) if e.to_lowercase().contains("deserializ")),
        "a preset and dates together must fail to deserialise: {result:?}"
    );
}
