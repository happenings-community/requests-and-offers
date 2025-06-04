#[cfg(test)]
mod tests {
  use hdi::prelude::{SerializedBytes, UnsafeBytes, ValidateCallbackResult};

  use crate::{validate_user, User};

  #[test]
  fn test_user_is_valid() {
    let user = User {
      name: "John Doe".to_string(),
      nickname: "John".to_string(),
      bio: "I am a software developer".to_string(),
      picture: None,
      user_type: "advocate".to_string(),
      email: "example@example.com".to_string(),
      phone: None,
      time_zone: "UTC".to_string(),
      location: "New York".to_string(),
    };
    let result = validate_user(user).unwrap();
    println!("result: {:#?}", result);
    assert!(result == ValidateCallbackResult::Valid);
  }

  #[test]
  fn test_user_with_invalid_name() {
    let user = User {
      name: "".to_string(),
      nickname: "John".to_string(),
      bio: "I am a software developer".to_string(),
      picture: None,
      user_type: "advocate".to_string(),
      email: "x9e0r@example.com".to_string(),
      phone: None,
      time_zone: "UTC".to_string(),
      location: "New York".to_string(),
    };
    let result = validate_user(user).unwrap();
    assert!(result == ValidateCallbackResult::Invalid(String::from("User name cannot be empty")));
  }

  #[test]
  fn test_user_with_invalid_picture() {
    let user = User {
      name: "John Doe".to_string(),
      nickname: "John".to_string(),
      bio: "I am a software developer".to_string(),
      picture: Some(SerializedBytes::from(UnsafeBytes::from(vec![1, 2, 3]))),
      user_type: "advocate".to_string(),
      email: "x9e0r@example.com".to_string(),
      phone: None,
      time_zone: "UTC".to_string(),
      location: "New York".to_string(),
    };
    let result = validate_user(user).unwrap();
    assert!(
      result == ValidateCallbackResult::Invalid(String::from("User picture must be a valid image"))
    );
  }

  #[test]
  fn test_user_with_invalid_user_type() {
    let user = User {
      name: "John Doe".to_string(),
      nickname: "John".to_string(),
      bio: "I am a software developer".to_string(),
      picture: None,
      user_type: "invalid".to_string(),
      email: "x9e0r@example.com".to_string(),
      phone: None,
      time_zone: "UTC".to_string(),
      location: "New York".to_string(),
    };
    let result = validate_user(user).unwrap();

    assert!(
      result
        == ValidateCallbackResult::Invalid(String::from(
          "User Type must be 'advocate' or 'creator'."
        ))
    );
  }

  #[test]
  fn test_user_with_invalid_email_format() {
    let user = User {
      name: "John Doe".to_string(),
      nickname: "John".to_string(),
      bio: "I am a software developer".to_string(),
      picture: None,
      user_type: "advocate".to_string(),
      email: "invalid_email".to_string(),
      phone: None,
      time_zone: "UTC".to_string(),
      location: "New York".to_string(),
    };
    let result = validate_user(user).unwrap();
    println!("result: {:#?}", result);
    assert!(result == ValidateCallbackResult::Invalid(String::from("Email is not valid")));
  }
}
