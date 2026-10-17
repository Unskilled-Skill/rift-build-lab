use std::num::NonZeroU64;
use std::sync::Arc;
use std::time::Duration;

use rbl_core::CoreError;
use rbl_core::lcu::lockfile::parse_lockfile;
use rbl_core::lcu::transport::{Lcu, LcuClient, LcuRequest, TransportError};
use rcgen::{BasicConstraints, CertificateParams, IsCa, Issuer, KeyPair, date_time_ymd};
use rustls::pki_types::{CertificateDer, PrivateKeyDer, PrivatePkcs8KeyDer};
use serde_json::{Value, json};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::sync::oneshot;

const PASSWORD: &str = "VERY_SECRET-pass_1";

struct Pki {
    ca_pem: String,
    chain: Vec<CertificateDer<'static>>,
    key: Vec<u8>,
}

fn ca() -> (CertificateParams, KeyPair, String) {
    let key = KeyPair::generate().unwrap();
    let mut params = CertificateParams::new(Vec::<String>::new()).unwrap();
    params.is_ca = IsCa::Ca(BasicConstraints::Unconstrained);
    let cert = params.self_signed(&key).unwrap();
    (params, key, cert.pem())
}

/// Leaf for `rd-client` (never 127.0.0.1), like Riot's local certificate, signed by `issuer` or self-signed.
fn leaf(issuer: Option<(&CertificateParams, &KeyPair)>, expired: bool) -> (CertificateDer<'static>, Vec<u8>) {
    let key = KeyPair::generate().unwrap();
    let mut params = CertificateParams::new(vec!["rd-client".to_string()]).unwrap();
    if expired {
        params.not_before = date_time_ymd(2000, 1, 1);
        params.not_after = date_time_ymd(2001, 1, 1);
    }
    let cert = match issuer {
        Some((ca_params, ca_key)) => params.signed_by(&key, &Issuer::from_params(ca_params, ca_key)).unwrap(),
        None => params.self_signed(&key).unwrap(),
    };
    (cert.der().clone(), key.serialize_der())
}

enum Leaf {
    WrongName,
    Untrusted,
    Expired,
    SelfSigned,
}

fn pki(kind: Leaf) -> Pki {
    let (ca_params, ca_key, ca_pem) = ca();
    let (other_params, other_key, _) = ca();
    let (cert, key) = match kind {
        Leaf::WrongName => leaf(Some((&ca_params, &ca_key)), false),
        Leaf::Untrusted => leaf(Some((&other_params, &other_key)), false),
        Leaf::Expired => leaf(Some((&ca_params, &ca_key)), true),
        Leaf::SelfSigned => leaf(None, false),
    };
    Pki { ca_pem, chain: vec![cert], key }
}

enum Reply {
    Status(u16, Vec<u8>),
    Drop,
    Hang,
}

/// One-connection TLS server; returns its port and the raw request it received.
async fn serve(pki: &Pki, reply: Reply) -> (u16, oneshot::Receiver<String>) {
    let provider = Arc::new(rustls::crypto::ring::default_provider());
    let config = rustls::ServerConfig::builder_with_provider(provider)
        .with_safe_default_protocol_versions()
        .unwrap()
        .with_no_client_auth()
        .with_single_cert(pki.chain.clone(), PrivateKeyDer::Pkcs8(PrivatePkcs8KeyDer::from(pki.key.clone())))
        .unwrap();
    let acceptor = tokio_rustls::TlsAcceptor::from(Arc::new(config));
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    let (tx, rx) = oneshot::channel();
    tokio::spawn(async move {
        let (tcp, _) = listener.accept().await.unwrap();
        let Ok(mut tls) = acceptor.accept(tcp).await else { return };
        let mut raw = Vec::new();
        let mut buf = [0u8; 8192];
        loop {
            let n = tls.read(&mut buf).await.unwrap_or(0);
            if n == 0 {
                break;
            }
            raw.extend_from_slice(&buf[..n]);
            let text = String::from_utf8_lossy(&raw).to_string();
            if let Some(end) = text.find("\r\n\r\n") {
                let length = text
                    .lines()
                    .find_map(|l| l.to_ascii_lowercase().strip_prefix("content-length:").map(|v| v.trim().parse::<usize>().unwrap()))
                    .unwrap_or(0);
                if raw.len() >= end + 4 + length {
                    break;
                }
            }
        }
        let _ = tx.send(String::from_utf8_lossy(&raw).to_string());
        match reply {
            Reply::Status(status, body) => {
                let head = format!(
                    "HTTP/1.1 {status} X\r\nContent-Length: {}\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n",
                    body.len()
                );
                let _ = tls.write_all(head.as_bytes()).await;
                let _ = tls.write_all(&body).await;
                let _ = tls.shutdown().await;
            }
            Reply::Drop => drop(tls),
            Reply::Hang => tokio::time::sleep(Duration::from_secs(30)).await,
        }
    });
    (port, rx)
}

fn client(pki: &Pki, port: u16, timeout: Duration) -> LcuClient {
    let credentials = parse_lockfile(&format!("LeagueClientUx:42:{port}:{PASSWORD}:https")).unwrap();
    LcuClient::with_root(credentials, pki.ca_pem.as_bytes(), timeout).unwrap()
}

async fn call(kind: Leaf, reply: Reply, request: LcuRequest) -> (Result<Value, TransportError>, Option<String>) {
    let pki = pki(kind);
    let (port, rx) = serve(&pki, reply).await;
    let result = client(&pki, port, Duration::from_millis(1500)).call(request).await;
    (result, rx.await.ok())
}

fn id(n: u64) -> NonZeroU64 {
    NonZeroU64::new(n).unwrap()
}

fn assert_clean(error: &TransportError) {
    for shown in [error.to_string(), format!("{error:?}")] {
        assert!(!shown.contains(PASSWORD) && !shown.contains("127.0.0.1") && !shown.contains("lol-"), "{shown}");
    }
}

#[tokio::test]
async fn accepts_a_riot_root_chain_whose_name_does_not_match_and_sends_an_authenticated_request() {
    let (result, request) = call(Leaf::WrongName, Reply::Status(200, br#""ChampSelect""#.to_vec()), LcuRequest::GetPhase).await;
    assert_eq!(result.unwrap(), json!("ChampSelect"));
    let request = request.unwrap();
    assert!(request.starts_with("GET /lol-gameflow/v1/gameflow-phase HTTP/1.1\r\n"), "{request}");
    let lower = request.to_ascii_lowercase();
    assert!(lower.contains("authorization: basic cmlvddpwrvjzx1nfq1jfvc1wyxnzxze="), "{request}");
    assert!(lower.contains("host: 127.0.0.1:"));
    assert!(lower.contains("accept: application/json"));
}

#[tokio::test]
async fn rejects_untrusted_expired_and_self_signed_certificates_before_sending_anything() {
    for kind in [Leaf::Untrusted, Leaf::Expired, Leaf::SelfSigned] {
        let body = json!({"itemSets": []});
        let (result, request) = call(kind, Reply::Status(200, b"{}".to_vec()), LcuRequest::PutItemSets { summoner: id(42), body }).await;
        let error = result.unwrap_err();
        assert_eq!(error, TransportError { error: CoreError::Tls, ambiguous: false });
        assert!(request.is_none_or(|r| r.is_empty()), "no request may reach an unverified server");
        assert_clean(&error);
    }
}

#[tokio::test]
async fn writes_the_exact_json_body_and_returns_null_for_empty_responses() {
    let body = json!({"name": "Rift Build Lab", "selectedPerkIds": [8214, 8226]});
    let (result, request) = call(Leaf::WrongName, Reply::Status(204, vec![]), LcuRequest::PutPage { id: id(12), body: body.clone() }).await;
    assert_eq!(result.unwrap(), Value::Null);
    let request = request.unwrap();
    assert!(request.starts_with("PUT /lol-perks/v1/pages/12 HTTP/1.1\r\n"));
    assert!(request.to_ascii_lowercase().contains("content-type: application/json"));
    assert_eq!(serde_json::from_str::<Value>(request.split("\r\n\r\n").nth(1).unwrap()).unwrap(), body);
}

#[tokio::test]
async fn classifies_failures_as_definite_or_ambiguous_like_the_companion() {
    let put = || LcuRequest::PutItemSets { summoner: id(42), body: json!({}) };
    let post = || LcuRequest::PostPage { body: json!({}) };
    let big = vec![b' '; 4 * 1024 * 1024 + 1];
    let cases: Vec<(Reply, LcuRequest, CoreError, bool)> = vec![
        (Reply::Status(500, b"{}".to_vec()), put(), CoreError::Rejected { status: 500 }, true),
        (Reply::Status(400, b"{}".to_vec()), put(), CoreError::Rejected { status: 400 }, false),
        (Reply::Status(400, b"{}".to_vec()), post(), CoreError::RuneCapacity, false),
        (Reply::Status(500, b"{}".to_vec()), post(), CoreError::Rejected { status: 500 }, true),
        (Reply::Status(404, b"{}".to_vec()), LcuRequest::GetChampSelectSession, CoreError::Rejected { status: 404 }, false),
        (Reply::Status(500, b"{}".to_vec()), LcuRequest::GetPages, CoreError::Rejected { status: 500 }, false),
        (Reply::Status(200, big.clone()), LcuRequest::GetPages, CoreError::Internal, false),
        (Reply::Status(200, big), put(), CoreError::Internal, true),
        (Reply::Status(200, b"{\"a\":1,\"a\":2}".to_vec()), LcuRequest::GetSummoner, CoreError::Internal, false),
        (Reply::Status(200, b"not json".to_vec()), put(), CoreError::Internal, true),
        (Reply::Drop, put(), CoreError::ClientUnavailable, true),
        (Reply::Drop, LcuRequest::GetPhase, CoreError::ClientUnavailable, false),
    ];
    for (n, (reply, request, error, ambiguous)) in cases.into_iter().enumerate() {
        let (result, _) = call(Leaf::WrongName, reply, request).await;
        let actual = result.unwrap_err();
        assert_eq!(actual, TransportError { error, ambiguous }, "case {n}");
        assert_clean(&actual);
    }
}

#[tokio::test]
async fn unreachable_clients_are_never_ambiguous_and_slow_writes_are() {
    let pki = pki(Leaf::WrongName);
    let closed = TcpListener::bind("127.0.0.1:0").await.unwrap().local_addr().unwrap().port();
    let request = LcuRequest::PutItemSets { summoner: id(42), body: json!({}) };
    let error = client(&pki, closed, Duration::from_millis(500)).call(request).await.unwrap_err();
    assert_eq!(error, TransportError { error: CoreError::ClientUnavailable, ambiguous: false });

    let (port, _rx) = serve(&pki, Reply::Hang).await;
    let started = std::time::Instant::now();
    let error = client(&pki, port, Duration::from_millis(400)).call(LcuRequest::PostPage { body: json!({}) }).await.unwrap_err();
    assert_eq!(error, TransportError { error: CoreError::ClientUnavailable, ambiguous: true });
    assert!(started.elapsed() < Duration::from_secs(3));
}

#[test]
fn requests_map_to_a_fixed_allowlist_of_methods_and_paths() {
    let body = || json!({});
    let cases = [
        (LcuRequest::GetSummoner, "GET", "/lol-summoner/v1/current-summoner"),
        (LcuRequest::GetPhase, "GET", "/lol-gameflow/v1/gameflow-phase"),
        (LcuRequest::GetGameVersion, "GET", "/lol-patch/v1/game-version"),
        (LcuRequest::GetChampSelectSession, "GET", "/lol-champ-select/v1/session"),
        (LcuRequest::GetPages, "GET", "/lol-perks/v1/pages"),
        (LcuRequest::GetItemSets { summoner: id(7) }, "GET", "/lol-item-sets/v1/item-sets/7/sets"),
        (LcuRequest::PutItemSets { summoner: id(7), body: body() }, "PUT", "/lol-item-sets/v1/item-sets/7/sets"),
        (LcuRequest::PostPage { body: body() }, "POST", "/lol-perks/v1/pages"),
        (LcuRequest::PutPage { id: id(18446744073709551615), body: body() }, "PUT", "/lol-perks/v1/pages/18446744073709551615"),
    ];
    for (request, method, path) in cases {
        assert_eq!((request.method(), request.path().as_str()), (method, path));
        assert_eq!(request.is_write(), method != "GET");
    }
}

#[test]
fn the_bundled_riot_root_loads_and_debug_output_hides_credentials() {
    let credentials = parse_lockfile(&format!("LeagueClient:1:2999:{PASSWORD}:https")).unwrap();
    let client = LcuClient::new(credentials).unwrap();
    let shown = format!("{client:?}");
    assert!(shown.contains("2999") && !shown.contains(PASSWORD), "{shown}");
}

/// Request bodies are pure ASCII JSON with \u escapes (as the Python companion sent them), so no
/// endpoint's text decoding can alter build or page names.
#[tokio::test]
async fn request_bodies_are_ascii_only_json() {
    let body = json!({"title": "Rift Build Lab \u{b7} Kai'Sa \u{e9}\u{1f600}", "n": 1});
    let (result, request) =
        call(Leaf::WrongName, Reply::Status(204, vec![]), LcuRequest::PutItemSets { summoner: id(42), body: body.clone() }).await;
    assert_eq!(result.unwrap(), Value::Null);
    let raw = request.unwrap();
    let sent = raw.split("\r\n\r\n").nth(1).unwrap();
    assert!(sent.is_ascii(), "{sent}");
    assert!(sent.contains(r"\u00b7") && sent.contains(r"\ud83d\ude00"), "{sent}");
    assert_eq!(serde_json::from_str::<Value>(sent).unwrap(), body);
}
