//! Sweettest integration tests for the requests-and-offers hApp.
//!
//! Replaces the TypeScript Tryorama tests in `tests/src/requests_and_offers/`.
//!
//! ## Running
//!
//! ```sh
//! # Build the hApp first
//! bun run build:happ
//!
//! # Run all Sweettest integration tests
//! CARGO_TARGET_DIR=target/native-tests cargo test -p requests_and_offers_sweettest
//!
//! # Run with output (verbose)
//! CARGO_TARGET_DIR=target/native-tests cargo test -p requests_and_offers_sweettest -- --nocapture
//!
//! # Run a specific test suite
//! CARGO_TARGET_DIR=target/native-tests cargo test -p requests_and_offers_sweettest --test users
//! ```
//!
//! ## Why a separate CARGO_TARGET_DIR?
//!
//! Zome crates must compile to `wasm32-unknown-unknown`. Sweettest compiles to the
//! native host target. Sharing a target directory causes Cargo to continuously
//! rebuild artifacts when switching between targets.

pub mod common;

pub use common::*;
