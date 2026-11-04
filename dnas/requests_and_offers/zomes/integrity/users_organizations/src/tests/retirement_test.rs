//! An organisation retirement is a record: written once, never edited (#234).
use hdi::prelude::*;

use crate::{validate_organization_retirement, OrganizationRetirement};

#[test]
fn a_retirement_is_never_edited() {
  let retirement = OrganizationRetirement {
    organization: ActionHash::from_raw_36(vec![1; 36]),
    grant: ActionHash::from_raw_36(vec![2; 36]),
  };
  let author = AgentPubKey::from_raw_36(vec![3; 36]);
  let original = ActionHash::from_raw_36(vec![4; 36]);
  let verdict = validate_organization_retirement(retirement, &author, Some(&original)).unwrap();
  assert_eq!(
    verdict,
    ValidateCallbackResult::Invalid("a retirement is a record and is never edited".to_string())
  );
}
