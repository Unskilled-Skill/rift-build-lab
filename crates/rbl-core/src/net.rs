//! HTTPS for data updates and the release check. Only two fixed publication locations can be
//! requested, with standard certificate verification (Mozilla roots), no redirects and bounded
//! response sizes. League traffic never uses this client.

use std::sync::Arc;
use std::time::Duration;

use http_body_util::{BodyExt, Empty, Limited};
use hyper::body::Bytes;
use hyper_util::rt::TokioIo;
use rustls::RootCertStore;
use rustls::pki_types::ServerName;
use tokio::net::TcpStream;
use tokio_rustls::TlsConnector;

use crate::CoreError;
use crate::data::{DATA_BASE, Fetch};

pub const RELEASES_API: &str = "https://api.github.com/repos/Unskilled-Skill/rift-build-lab/releases/latest";
pub const RELEASES_PAGE: &str = "https://github.com/Unskilled-Skill/rift-build-lab/releases";
const MAX_BODY: usize = 32 * 1024 * 1024;
const TIMEOUT: Duration = Duration::from_secs(30);

/// `(host, path)` for an allowed URL; everything else is refused before any connection.
pub fn allowed(url: &str) -> Option<(&'static str, String)> {
    if url == RELEASES_API {
        return Some(("api.github.com", "/repos/Unskilled-Skill/rift-build-lab/releases/latest".into()));
    }
    let rest = url.strip_prefix(DATA_BASE)?;
    let safe = !rest.is_empty()
        && rest.bytes().all(|b| b.is_ascii_alphanumeric() || matches!(b, b'.' | b'_' | b'/' | b'-'))
        && !rest.split('/').any(|p| p.is_empty() || p == "." || p == "..");
    safe.then(|| ("unskilled-skill.github.io", format!("/rift-build-lab/data/{rest}")))
}

pub struct HttpsFetch {
    tls: TlsConnector,
    user_agent: String,
}

impl HttpsFetch {
    pub fn new(app_version: &str) -> Self {
        let mut roots = RootCertStore::empty();
        roots.extend(webpki_roots::TLS_SERVER_ROOTS.iter().cloned());
        let config = rustls::ClientConfig::builder_with_provider(Arc::new(rustls::crypto::ring::default_provider()))
            .with_safe_default_protocol_versions()
            .expect("ring supports the default TLS versions")
            .with_root_certificates(roots)
            .with_no_client_auth();
        HttpsFetch { tls: TlsConnector::from(Arc::new(config)), user_agent: format!("RiftBuildLab/{app_version}") }
    }

    async fn get_inner(&self, host: &'static str, path: &str) -> Result<Vec<u8>, CoreError> {
        let offline = || CoreError::ClientUnavailable;
        let address = tokio::net::lookup_host((host, 443)).await.map_err(|_| offline())?.next().ok_or_else(offline)?;
        let tcp = TcpStream::connect(address).await.map_err(|_| offline())?;
        let name = ServerName::try_from(host).map_err(|_| CoreError::Internal)?;
        let tls = self.tls.connect(name, tcp).await.map_err(|_| CoreError::Tls)?;
        let (mut sender, connection) = hyper::client::conn::http1::handshake(TokioIo::new(tls)).await.map_err(|_| offline())?;
        tokio::spawn(async move {
            let _ = connection.await;
        });
        let request = hyper::Request::get(path)
            .header(hyper::header::HOST, host)
            .header(hyper::header::USER_AGENT, &self.user_agent)
            .header(hyper::header::ACCEPT, "application/json")
            .body(Empty::<Bytes>::new())
            .map_err(|_| CoreError::Internal)?;
        let response = sender.send_request(request).await.map_err(|_| offline())?;
        if response.status() != hyper::StatusCode::OK {
            return Err(CoreError::Rejected { status: response.status().as_u16() });
        }
        let body = Limited::new(response.into_body(), MAX_BODY).collect().await.map_err(|_| CoreError::Internal)?;
        Ok(body.to_bytes().to_vec())
    }
}

impl Fetch for HttpsFetch {
    async fn get(&self, url: &str) -> Result<Vec<u8>, CoreError> {
        let (host, path) = allowed(url).ok_or(CoreError::Internal)?;
        tokio::time::timeout(TIMEOUT, self.get_inner(host, &path)).await.map_err(|_| CoreError::ClientUnavailable)?
    }
}
