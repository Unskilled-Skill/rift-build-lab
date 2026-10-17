//! HTTPS transport to the local League Client.
//!
//! Requests are a closed enum, so only the reviewed endpoints can be called and every request
//! targets `127.0.0.1` on the lockfile port. The server certificate must chain to Riot's bundled
//! root; only the host-name check is waived because the client's certificate is not issued for
//! `127.0.0.1` (the companion uses `check_hostname = False` with `CERT_REQUIRED`).

use std::fmt;
use std::future::Future;
use std::net::{IpAddr, Ipv4Addr};
use std::num::NonZeroU64;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use http_body_util::{BodyExt, Full, Limited};
use hyper::body::Bytes;
use hyper_util::rt::TokioIo;
use rustls::client::WebPkiServerVerifier;
use rustls::client::danger::{HandshakeSignatureValid, ServerCertVerified, ServerCertVerifier};
use rustls::crypto::{CryptoProvider, ring};
use rustls::pki_types::pem::PemObject;
use rustls::pki_types::{CertificateDer, ServerName, UnixTime};
use rustls::{CertificateError, DigitallySignedStruct, RootCertStore, SignatureScheme};
use serde_json::Value;
use tokio::net::TcpStream;
use tokio_rustls::TlsConnector;

use super::lockfile::Credentials;
use crate::CoreError;
use crate::json::parse_strict;

const RIOT_ROOT: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/../../companion/riotgames.pem"));
const MAX_RESPONSE: usize = 4 * 1024 * 1024;
const TIMEOUT: Duration = Duration::from_secs(8);

/// Every League Client operation the app may perform.
#[derive(Debug, Clone, PartialEq)]
pub enum LcuRequest {
    GetSummoner,
    GetPhase,
    GetGameVersion,
    GetChampSelectSession,
    GetPages,
    GetItemSets { summoner: NonZeroU64 },
    PutItemSets { summoner: NonZeroU64, body: Value },
    PostPage { body: Value },
    PutPage { id: NonZeroU64, body: Value },
}

impl LcuRequest {
    pub fn method(&self) -> &'static str {
        match self {
            LcuRequest::PutItemSets { .. } | LcuRequest::PutPage { .. } => "PUT",
            LcuRequest::PostPage { .. } => "POST",
            _ => "GET",
        }
    }

    pub fn path(&self) -> String {
        match self {
            LcuRequest::GetSummoner => "/lol-summoner/v1/current-summoner".into(),
            LcuRequest::GetPhase => "/lol-gameflow/v1/gameflow-phase".into(),
            LcuRequest::GetGameVersion => "/lol-patch/v1/game-version".into(),
            LcuRequest::GetChampSelectSession => "/lol-champ-select/v1/session".into(),
            LcuRequest::GetPages | LcuRequest::PostPage { .. } => "/lol-perks/v1/pages".into(),
            LcuRequest::GetItemSets { summoner } | LcuRequest::PutItemSets { summoner, .. } => {
                format!("/lol-item-sets/v1/item-sets/{summoner}/sets")
            }
            LcuRequest::PutPage { id, .. } => format!("/lol-perks/v1/pages/{id}"),
        }
    }

    /// Writes may change client state even when they fail.
    pub fn is_write(&self) -> bool {
        self.method() != "GET"
    }

    fn body(&self) -> Option<&Value> {
        match self {
            LcuRequest::PutItemSets { body, .. } | LcuRequest::PostPage { body } | LcuRequest::PutPage { body, .. } => Some(body),
            _ => None,
        }
    }
}

/// A failed client call. `ambiguous` means a write may have reached the client, so callers must
/// verify state instead of assuming nothing changed.
#[derive(Debug, Clone, PartialEq, thiserror::Error)]
#[error("{error}")]
pub struct TransportError {
    pub error: CoreError,
    pub ambiguous: bool,
}

/// The client boundary; tests and the monitor use fakes implementing it.
pub trait Lcu {
    fn call(&self, request: LcuRequest) -> impl Future<Output = Result<Value, TransportError>> + Send;
}

/// Chain, signature and validity checks against Riot's root; only a name mismatch is accepted.
#[derive(Debug)]
struct RiotRootVerifier(Arc<WebPkiServerVerifier>);

impl ServerCertVerifier for RiotRootVerifier {
    fn verify_server_cert(
        &self,
        end_entity: &CertificateDer<'_>,
        intermediates: &[CertificateDer<'_>],
        server_name: &ServerName<'_>,
        ocsp_response: &[u8],
        now: UnixTime,
    ) -> Result<ServerCertVerified, rustls::Error> {
        match self.0.verify_server_cert(end_entity, intermediates, server_name, ocsp_response, now) {
            Err(rustls::Error::InvalidCertificate(CertificateError::NotValidForName | CertificateError::NotValidForNameContext { .. })) => {
                Ok(ServerCertVerified::assertion())
            }
            other => other,
        }
    }
    fn verify_tls12_signature(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        self.0.verify_tls12_signature(message, cert, dss)
    }
    fn verify_tls13_signature(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        self.0.verify_tls13_signature(message, cert, dss)
    }
    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        self.0.supported_verify_schemes()
    }
}

pub struct LcuClient {
    credentials: Credentials,
    tls: TlsConnector,
    timeout: Duration,
}

impl fmt::Debug for LcuClient {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("LcuClient").field("port", &self.credentials.port()).finish_non_exhaustive()
    }
}

fn basic_auth(password: &str) -> String {
    const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let input = format!("riot:{password}");
    let mut out = String::from("Basic ");
    for chunk in input.as_bytes().chunks(3) {
        let n = chunk.iter().enumerate().fold(0u32, |n, (i, b)| n | (u32::from(*b) << (16 - 8 * i)));
        for i in 0..4 {
            out.push(if i <= chunk.len() { ALPHABET[(n >> (18 - 6 * i)) as usize & 63] as char } else { '=' });
        }
    }
    out
}

/// JSON with every non-ASCII character escaped as `\uXXXX` (surrogate pairs above U+FFFF).
/// Matches what the Python companion always sent (`json.dumps` default) and reads the same under any
/// text decoder; League stored UTF-8 titles correctly in the live test, so this is defensive.
/// Non-ASCII text only occurs inside JSON strings, so escaping it there is lossless.
fn ascii_json(value: &Value) -> Vec<u8> {
    let text = serde_json::to_string(value).expect("JSON values serialize");
    let mut out = String::with_capacity(text.len());
    for c in text.chars() {
        if c.is_ascii() {
            out.push(c);
        } else {
            let mut units = [0u16; 2];
            for unit in c.encode_utf16(&mut units) {
                out.push_str(&format!("\\u{unit:04x}"));
            }
        }
    }
    out.into_bytes()
}

impl LcuClient {
    /// Client trusting only the Riot root shipped with the app.
    pub fn new(credentials: Credentials) -> Result<Self, CoreError> {
        Self::with_root(credentials, RIOT_ROOT, TIMEOUT)
    }

    /// Client trusting `root_pem` instead of the bundled Riot root (used by tests).
    pub fn with_root(credentials: Credentials, root_pem: &[u8], timeout: Duration) -> Result<Self, CoreError> {
        let mut roots = RootCertStore::empty();
        for cert in CertificateDer::pem_slice_iter(root_pem) {
            roots.add(cert.map_err(|_| CoreError::Tls)?).map_err(|_| CoreError::Tls)?;
        }
        if roots.is_empty() {
            return Err(CoreError::Tls);
        }
        let provider: Arc<CryptoProvider> = Arc::new(ring::default_provider());
        let webpki = WebPkiServerVerifier::builder_with_provider(Arc::new(roots), provider.clone()).build().map_err(|_| CoreError::Tls)?;
        let config = rustls::ClientConfig::builder_with_provider(provider)
            .with_safe_default_protocol_versions()
            .map_err(|_| CoreError::Tls)?
            .dangerous()
            .with_custom_certificate_verifier(Arc::new(RiotRootVerifier(webpki)))
            .with_no_client_auth();
        Ok(LcuClient { credentials, tls: TlsConnector::from(Arc::new(config)), timeout })
    }

    async fn send(&self, request: &LcuRequest, sent: &AtomicBool) -> Result<Value, TransportError> {
        let write = request.is_write();
        let fail = |error: CoreError, ambiguous: bool| TransportError { error, ambiguous };
        let port = self.credentials.port();
        let tcp = TcpStream::connect((Ipv4Addr::LOCALHOST, port)).await.map_err(|_| fail(CoreError::ClientUnavailable, false))?;
        let tls = self.tls.connect(ServerName::IpAddress(IpAddr::V4(Ipv4Addr::LOCALHOST).into()), tcp).await.map_err(|e| {
            let certificate = e.get_ref().and_then(|inner| inner.downcast_ref::<rustls::Error>()).is_some_and(|r| {
                matches!(r, rustls::Error::InvalidCertificate(_) | rustls::Error::NoCertificatesPresented | rustls::Error::AlertReceived(_))
            });
            fail(if certificate { CoreError::Tls } else { CoreError::ClientUnavailable }, false)
        })?;
        let (mut sender, connection) =
            hyper::client::conn::http1::handshake(TokioIo::new(tls)).await.map_err(|_| fail(CoreError::ClientUnavailable, false))?;
        tokio::spawn(async move {
            let _ = connection.await;
        });
        let body = request.body().map(ascii_json).unwrap_or_default();
        let http = hyper::Request::builder()
            .method(request.method())
            .uri(request.path())
            .header(hyper::header::HOST, format!("127.0.0.1:{port}"))
            .header(hyper::header::AUTHORIZATION, basic_auth(self.credentials.password()))
            .header(hyper::header::ACCEPT, "application/json")
            .header(hyper::header::CONTENT_TYPE, "application/json")
            .body(Full::new(Bytes::from(body)))
            .map_err(|_| fail(CoreError::Internal, false))?;
        sent.store(true, Ordering::SeqCst);
        let response = sender.send_request(http).await.map_err(|_| fail(CoreError::ClientUnavailable, write))?;
        let status = response.status().as_u16();
        let raw =
            Limited::new(response.into_body(), MAX_RESPONSE).collect().await.map_err(|_| fail(CoreError::Internal, write))?.to_bytes();
        if !(200..300).contains(&status) {
            if matches!(request, LcuRequest::PostPage { .. }) && status < 500 {
                return Err(fail(CoreError::RuneCapacity, false));
            }
            return Err(fail(CoreError::Rejected { status }, write && status >= 500));
        }
        if raw.is_empty() {
            return Ok(Value::Null);
        }
        std::str::from_utf8(&raw).ok().and_then(|text| parse_strict(text).ok()).ok_or(fail(CoreError::Internal, write))
    }
}

impl Lcu for LcuClient {
    async fn call(&self, request: LcuRequest) -> Result<Value, TransportError> {
        let sent = AtomicBool::new(false);
        match tokio::time::timeout(self.timeout, self.send(&request, &sent)).await {
            Ok(result) => result,
            Err(_) => {
                Err(TransportError { error: CoreError::ClientUnavailable, ambiguous: request.is_write() && sent.load(Ordering::SeqCst) })
            }
        }
    }
}
