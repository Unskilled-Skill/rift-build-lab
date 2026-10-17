use std::path::PathBuf;

use rbl_core::CoreError;
use rbl_core::bundle::{load_file, managed_uid, parse_bytes, validate};
use rbl_core::catalog::Catalog;
use rbl_core::error::ERROR_CODES;
use rbl_core::json::parse_strict;
use serde_json::{Value, json};

fn repo(path: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..").join(path)
}
fn read(path: &str) -> String {
    std::fs::read_to_string(repo(path)).unwrap()
}
fn companion_catalog() -> Catalog {
    Catalog::from_companion_json(&read("companion/catalog.json")).unwrap()
}
fn parity() -> Value {
    serde_json::from_str(&read("tests/fixtures/bundle-parity.json")).unwrap()
}

#[test]
fn validates_every_parity_case_exactly_like_the_python_companion() {
    let catalog = companion_catalog();
    let cases = parity()["cases"].as_array().unwrap().clone();
    assert!(cases.len() >= 50);
    for case in cases {
        let name = case["name"].as_str().unwrap();
        match validate(&case["bundle"], &catalog) {
            Ok(valid) => {
                assert_eq!(case["accept"], true, "{name}: Rust accepted a bundle Python rejects");
                assert_eq!(valid.item_set()["uid"], case["uid"], "{name}: managed uid");
                assert_eq!(valid.value()["labels"], case["labels"], "{name}: catalog labels");
                let mut rest = valid.into_value();
                let mut expected = case["bundle"].clone();
                for v in [&mut rest, &mut expected] {
                    v["itemSet"].as_object_mut().unwrap().remove("uid");
                    v.as_object_mut().unwrap().remove("labels");
                }
                assert_eq!(rest, expected, "{name}: everything except uid and labels is preserved");
            }
            Err(error) => {
                assert_eq!(case["accept"], false, "{name}: Rust rejected a bundle Python accepts ({error})");
                assert_eq!(error.to_string(), case["message"].as_str().unwrap(), "{name}: message");
                assert_eq!(error.code(), "invalid-bundle");
            }
        }
    }
}

#[test]
fn loads_files_like_the_python_companion() {
    use base64_decode as decode;
    let dir = tempfile::tempdir().unwrap();
    for case in parity()["files"].as_array().unwrap() {
        let name = case["name"].as_str().unwrap();
        let path = dir.path().join(name);
        std::fs::write(&path, decode(case["bytes"].as_str().unwrap())).unwrap();
        match load_file(&path) {
            Ok(_) => assert_eq!(case["accept"], true, "{name}"),
            Err(error) => {
                assert_eq!(case["accept"], false, "{name}: {error}");
                // Python parses NaN and then rejects it as an invalid bundle; strict JSON rejects it as syntax.
                if name != "nan.riftbuild.json" {
                    assert_eq!(error.to_string(), case["message"].as_str().unwrap(), "{name}");
                }
            }
        }
    }
}

#[test]
fn published_catalog_filters_to_the_same_items_as_the_companion_catalog() {
    let published = Catalog::from_published_json(&read("public/data/catalog.json")).unwrap();
    assert_eq!(published, companion_catalog());
    assert!(published.item_name("3003").is_some());
    assert_eq!(published.rune_name(5008), Some("Adaptive force"));
}

#[test]
fn managed_item_set_ids_match_python_uuid5() {
    let real = &parity()["cases"][0];
    assert_eq!(managed_uid(real["bundle"]["championId"].as_i64().unwrap()), real["uid"].as_str().unwrap());
    assert_ne!(managed_uid(1), managed_uid(2));
}

#[test]
fn strict_json_rejects_duplicates_at_any_depth_trailing_data_and_non_finite_numbers() {
    assert_eq!(parse_strict(r#"{"a":{"b":[{"c":1}]}}"#).unwrap(), json!({"a":{"b":[{"c":1}]}}));
    let duplicate = CoreError::InvalidBundle { reason: "Duplicate JSON fields are not accepted." };
    assert_eq!(parse_strict(r#"{"a":{"b":[{"c":1,"c":2}]}}"#), Err(duplicate));
    for text in [r#"{"a":1} {}"#, r#"{"a":NaN}"#, r#"{"a":Infinity}"#, "", "{'a':1}"] {
        assert_eq!(parse_strict(text), Err(CoreError::InvalidBundle { reason: "The import is not valid JSON." }), "{text}");
    }
    assert!(parse_bytes(&vec![b' '; 65537]).is_err());
    assert_eq!(parse_bytes(b"\xef\xbb\xbf{}").unwrap(), json!({}));
}

#[test]
fn error_codes_match_the_shared_typescript_list() {
    let shared: Vec<String> = serde_json::from_str(&read("tests/fixtures/error-codes.json")).unwrap();
    assert_eq!(ERROR_CODES.to_vec(), shared);
    let samples = [
        CoreError::ClientUnavailable,
        CoreError::Tls,
        CoreError::NotSignedIn,
        CoreError::UnsafePhase { phase: "InProgress".into() },
        CoreError::PatchMismatch { client: "16.21".into(), data: "16.20".into() },
        CoreError::Rejected { status: 400 },
        CoreError::RuneCapacity,
        CoreError::AmbiguousOwnership,
        CoreError::PartialApply { failures: "items".into() },
        CoreError::ReadbackMismatch,
        CoreError::BackupFailed,
        CoreError::InvalidBundle { reason: "x" },
        CoreError::SelectionChanged,
        CoreError::NoBuildForRole,
        CoreError::DataIncompatible { reason: "x" },
        CoreError::Internal,
    ];
    let codes: Vec<&str> = samples.iter().map(CoreError::code).collect();
    assert_eq!(codes, ERROR_CODES.to_vec());
    for error in &samples {
        assert_eq!(serde_json::to_value(error).unwrap()["code"], error.code());
        let message = error.to_string();
        assert!(!message.contains("http") && !message.contains("riot:"), "{message}");
    }
}

/// Minimal standard base64 decoder for fixtures (keeps dev-dependencies small).
fn base64_decode(text: &str) -> Vec<u8> {
    let alphabet = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut bits = 0u32;
    let mut count = 0;
    let mut out = Vec::new();
    for byte in text.bytes().filter(|b| *b != b'=') {
        bits = (bits << 6) | alphabet.iter().position(|a| *a == byte).unwrap() as u32;
        count += 6;
        if count >= 8 {
            count -= 8;
            out.push((bits >> count) as u8);
            bits &= (1 << count) - 1;
        }
    }
    out
}
