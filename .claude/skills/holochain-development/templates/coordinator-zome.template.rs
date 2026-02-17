/// Coordinator Zome Template — HDK 0.6
/// Aligned with dnas/requests_and_offers/zomes/coordinator/requests/
/// Replace {{DomainName}} (PascalCase) and {{domain_name}} (snake_case).

use hdk::prelude::*;
use {{domain_name}}_integrity::*;

// --- Init ---

#[hdk_extern]
pub fn init(_: ()) -> ExternResult<InitCallbackResult> {
    Ok(InitCallbackResult::Pass)
}

// --- Signal Types ---

#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "type")]
pub enum Signal {
    EntryCreated {
        action: SignedActionHashed,
        app_entry: EntryTypes,
    },
    EntryUpdated {
        action: SignedActionHashed,
        app_entry: EntryTypes,
        original_app_entry: EntryTypes,
    },
    EntryDeleted {
        action: SignedActionHashed,
        original_app_entry: EntryTypes,
    },
}

// --- CRUD Operations ---

#[derive(Debug, Serialize, Deserialize)]
pub struct Create{{DomainName}}Input {
    pub {{domain_name}}: {{DomainName}},
}

#[hdk_extern]
pub fn create_{{domain_name}}(input: Create{{DomainName}}Input) -> ExternResult<Record> {
    let hash = create_entry(&EntryTypes::{{DomainName}}(input.{{domain_name}}))?;
    let record = get(hash.clone(), GetOptions::default())?.ok_or(wasm_error!(
        WasmErrorInner::Guest("Could not find the newly created entry".to_string())
    ))?;

    // Index via path
    let path = Path::from("{{domain_name}}s.all");
    create_link(
        path.path_entry_hash()?,
        hash,
        LinkTypes::All{{DomainName}}s,
        (),
    )?;

    Ok(record)
}

#[hdk_extern]
pub fn get_{{domain_name}}(action_hash: ActionHash) -> ExternResult<Option<Record>> {
    get(action_hash, GetOptions::default())
}

#[hdk_extern]
pub fn get_all_{{domain_name}}s() -> ExternResult<Vec<Record>> {
    let path = Path::from("{{domain_name}}s.all");
    let link_filter = LinkTypes::All{{DomainName}}s
        .try_into_filter()
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;

    let links = get_links(
        LinkQuery::new(path.path_entry_hash()?, link_filter)
            .get_options(GetStrategy::Local),
    )?;

    let get_input: Vec<GetInput> = links
        .into_iter()
        .filter_map(|link| link.target.into_action_hash())
        .map(|hash| GetInput::new(hash.into(), GetOptions::default()))
        .collect();

    let records: Vec<Record> = HDK
        .with(|hdk| hdk.borrow().get(get_input))?
        .into_iter()
        .flatten()
        .collect();

    Ok(records)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Update{{DomainName}}Input {
    pub original_{{domain_name}}_hash: ActionHash,
    pub previous_{{domain_name}}_hash: ActionHash,
    pub updated_{{domain_name}}: {{DomainName}},
}

#[hdk_extern]
pub fn update_{{domain_name}}(input: Update{{DomainName}}Input) -> ExternResult<Record> {
    let updated_hash = update_entry(
        input.previous_{{domain_name}}_hash.clone(),
        &input.updated_{{domain_name}},
    )?;

    // Create update tracking link
    create_link(
        input.original_{{domain_name}}_hash,
        updated_hash.clone(),
        LinkTypes::{{DomainName}}Updates,
        (),
    )?;

    let record = get(updated_hash, GetOptions::default())?.ok_or(wasm_error!(
        WasmErrorInner::Guest("Could not find the updated entry".to_string())
    ))?;

    Ok(record)
}

#[hdk_extern]
pub fn delete_{{domain_name}}(action_hash: ActionHash) -> ExternResult<ActionHash> {
    delete_entry(action_hash)
}

// --- Post-Commit Signal ---

#[hdk_extern(infallible)]
pub fn post_commit(committed_actions: Vec<SignedActionHashed>) {
    for action in committed_actions {
        if let Err(err) = signal_action(action) {
            error!("Error signaling new action: {:?}", err);
        }
    }
}

fn signal_action(action: SignedActionHashed) -> ExternResult<()> {
    match action.hashed.content.clone() {
        Action::Create(_) => {
            if let Ok(Some(app_entry)) = get_entry_for_action(&action.hashed.hash) {
                emit_signal(Signal::EntryCreated { action, app_entry })?;
            }
            Ok(())
        }
        Action::Update(update) => {
            if let Ok(Some(app_entry)) = get_entry_for_action(&action.hashed.hash) {
                if let Ok(Some(original_app_entry)) =
                    get_entry_for_action(&update.original_action_address)
                {
                    emit_signal(Signal::EntryUpdated {
                        action,
                        app_entry,
                        original_app_entry,
                    })?;
                }
            }
            Ok(())
        }
        Action::Delete(delete) => {
            if let Ok(Some(original_app_entry)) = get_entry_for_action(&delete.deletes_address) {
                emit_signal(Signal::EntryDeleted {
                    action,
                    original_app_entry,
                })?;
            }
            Ok(())
        }
        _ => Ok(()),
    }
}

fn get_entry_for_action(action_hash: &ActionHash) -> ExternResult<Option<EntryTypes>> {
    let record = match get_details(action_hash.clone(), GetOptions::default())? {
        Some(Details::Record(details)) => details.record,
        _ => return Ok(None),
    };
    let entry = match record.entry().as_option() {
        Some(entry) => entry,
        None => return Ok(None),
    };
    let (zome_index, entry_index) = match record.action().entry_type() {
        Some(EntryType::App(AppEntryDef {
            zome_index,
            entry_index,
            ..
        })) => (zome_index, entry_index),
        _ => return Ok(None),
    };
    EntryTypes::deserialize_from_type(*zome_index, *entry_index, entry)
}
