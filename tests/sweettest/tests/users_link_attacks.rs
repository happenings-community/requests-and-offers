//! Trying to break who a User's agents and an agent's User are.
//!
//! `UserAgents` (User to agent key) is what `get_user_agents` reads, and
//! `send_message` encrypts a copy of every message to each key it returns. So
//! a forged `UserAgents` link from another member's User to one's own key
//! would hand the forger a copy of every message sent to that member.
//! `MyUser` (agent key to User) is what `get_agent_user` reads, so a forged
//! one lets an agent pass as another member.
//!
//! The real coordinator only ever writes these links for its own User, so the
//! tests use the test-only `users_probe` zome (tests/zomes/users_probe) to
//! hand the integrity zome raw links. Every forged write must be refused by
//! validation, each test checks that the refusal names the rule it broke, and
//! each group ends with a valid write through the same probe, which shows the
//! probe itself works.

use holochain::prelude::*;
use holochain::sweettest::*;
use requests_and_offers_sweettest::common::*;
use serde::Serialize;

#[derive(Serialize, Debug)]
struct ProbeUserAgentsLink {
    user: ActionHash,
    agent: AgentPubKey,
}

#[derive(Serialize, Debug)]
struct ProbeMyUserLink {
    agent: AgentPubKey,
    user: ActionHash,
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

struct World {
    conductors: SweetConductorBatch,
    alice: SweetCell,
    bob: SweetCell,
    alice_user: ActionHash,
    bob_user: ActionHash,
}

async fn user_of(conductor: &SweetConductor, cell: &SweetCell) -> ActionHash {
    let links: Vec<Link> = conductor
        .call(&cell.zome("users_organizations"), "get_agent_user", cell.agent_pubkey().clone())
        .await;
    links[0].target.clone().into_action_hash().expect("a MyUser link targets an action")
}

async fn world() -> World {
    let (conductors, alice, bob) = setup_two_agents_with_users_probe().await;
    conductors[0]
        .call::<_, Record>(&alice.zome("users_organizations"), "create_user", sample_user("Alice"))
        .await;
    conductors[1]
        .call::<_, Record>(&bob.zome("users_organizations"), "create_user", sample_user("Bob"))
        .await;
    await_consistency_s(15, [&alice, &bob]).await.unwrap();
    let alice_user = user_of(&conductors[0], &alice).await;
    let bob_user = user_of(&conductors[1], &bob).await;
    World { conductors, alice, bob, alice_user, bob_user }
}

impl World {
    async fn user_agents_link(
        &self,
        who: usize,
        user: &ActionHash,
        agent: &AgentPubKey,
    ) -> Result<ActionHash, String> {
        let cell = if who == 0 { &self.alice } else { &self.bob };
        self.conductors[who]
            .call_fallible::<_, ActionHash>(
                &cell.zome("users_probe"),
                "probe_create_user_agents_link",
                ProbeUserAgentsLink { user: user.clone(), agent: agent.clone() },
            )
            .await
            .map_err(|e| format!("{e:?}"))
    }

    async fn my_user_link(
        &self,
        who: usize,
        agent: &AgentPubKey,
        user: &ActionHash,
    ) -> Result<ActionHash, String> {
        let cell = if who == 0 { &self.alice } else { &self.bob };
        self.conductors[who]
            .call_fallible::<_, ActionHash>(
                &cell.zome("users_probe"),
                "probe_create_my_user_link",
                ProbeMyUserLink { agent: agent.clone(), user: user.clone() },
            )
            .await
            .map_err(|e| format!("{e:?}"))
    }

    async fn delete(&self, who: usize, link: &ActionHash) -> Result<ActionHash, String> {
        let cell = if who == 0 { &self.alice } else { &self.bob };
        self.conductors[who]
            .call_fallible::<_, ActionHash>(&cell.zome("users_probe"), "probe_delete_link", link.clone())
            .await
            .map_err(|e| format!("{e:?}"))
    }
}

// ---------------------------------------------------------------------------
// UserAgents
// ---------------------------------------------------------------------------

#[tokio::test(flavor = "multi_thread")]
async fn only_a_users_author_may_link_agents_to_it() {
    let w = world().await;
    let bob_key = w.bob.agent_pubkey().clone();

    // Bob links Alice's User to his own key: he would receive a copy of every
    // message sent to Alice.
    let forged = w.user_agents_link(1, &w.alice_user, &bob_key).await;
    refused(forged, "only a User's author may link agents to it", "Bob linking Alice's User to his key");

    // Bob linking his own User to his own key is what create_user does.
    w.user_agents_link(1, &w.bob_user, &bob_key)
        .await
        .expect("Bob linking his own User to his key must be accepted");

    // And Alice's agents are still only Alice.
    await_consistency_s(15, [&w.alice, &w.bob]).await.unwrap();
    let agents: Vec<AgentPubKey> = w.conductors[0]
        .call(&w.alice.zome("users_organizations"), "get_user_agents", w.alice_user.clone())
        .await;
    assert_eq!(agents, vec![w.alice.agent_pubkey().clone()]);
}

// ---------------------------------------------------------------------------
// MyUser
// ---------------------------------------------------------------------------

#[tokio::test(flavor = "multi_thread")]
async fn a_my_user_link_starts_at_its_authors_key_and_ends_at_its_authors_user() {
    let w = world().await;
    let alice_key = w.alice.agent_pubkey().clone();
    let bob_key = w.bob.agent_pubkey().clone();

    // Bob claims a User for Alice's key.
    let from_other_key = w.my_user_link(1, &alice_key, &w.bob_user).await;
    refused(
        from_other_key,
        "a MyUser link must start at its author's own key",
        "Bob linking Alice's key to his User",
    );

    // Bob claims Alice's User as his own.
    let to_other_user = w.my_user_link(1, &bob_key, &w.alice_user).await;
    refused(
        to_other_user,
        "a MyUser link must point to a User its author wrote",
        "Bob linking his key to Alice's User",
    );

    // Bob linking his own key to his own User is what create_user does.
    w.my_user_link(1, &bob_key, &w.bob_user)
        .await
        .expect("Bob linking his key to his own User must be accepted");
}

// ---------------------------------------------------------------------------
// Deletes
// ---------------------------------------------------------------------------

#[tokio::test(flavor = "multi_thread")]
async fn only_the_author_of_a_user_link_may_delete_it() {
    let w = world().await;
    let alice_key = w.alice.agent_pubkey().clone();

    let agents_link = w
        .user_agents_link(0, &w.alice_user, &alice_key)
        .await
        .expect("Alice linking her User to her key");
    let my_user_link = w
        .my_user_link(0, &alice_key, &w.alice_user)
        .await
        .expect("Alice linking her key to her User");
    await_consistency_s(15, [&w.alice, &w.bob]).await.unwrap();

    refused(
        w.delete(1, &agents_link).await,
        "only the author of a link may delete it",
        "Bob deleting Alice's UserAgents link",
    );
    refused(
        w.delete(1, &my_user_link).await,
        "only the author of a link may delete it",
        "Bob deleting Alice's MyUser link",
    );

    w.delete(0, &agents_link).await.expect("Alice deleting her own UserAgents link");
    w.delete(0, &my_user_link).await.expect("Alice deleting her own MyUser link");
}
