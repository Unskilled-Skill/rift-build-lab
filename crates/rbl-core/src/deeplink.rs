//! `riftbuildlab-desktop://open?champion=<alias>&plan=<planId>` links from the website.
//!
//! A link can only open a build page. It never applies anything, never enables automatic imports
//! and never carries build data. The companion's `riftbuildlab://` scheme is left untouched.

use serde::Serialize;

pub const SCHEME: &str = "riftbuildlab-desktop";
const MAX_LINK: usize = 512;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenBuild {
    pub champion: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub plan_id: Option<String>,
}

fn alias(text: &str) -> bool {
    (1..=40).contains(&text.len()) && text.bytes().all(|b| b.is_ascii_alphanumeric())
}

fn plan_id(text: &str) -> bool {
    (1..=300).contains(&text.len())
        && text.contains(':')
        && text.bytes().all(|b| b.is_ascii_alphanumeric() || matches!(b, b':' | b'_' | b'-'))
}

pub fn parse(link: &str) -> Option<OpenBuild> {
    if link.len() > MAX_LINK || link.contains('#') {
        return None;
    }
    let (scheme, rest) = link.split_once("://")?;
    if !scheme.eq_ignore_ascii_case(SCHEME) {
        return None;
    }
    let (target, query) = rest.split_once('?')?;
    if target != "open" && target != "open/" {
        return None;
    }
    let (mut champion, mut plan) = (None, None);
    for pair in query.split('&') {
        let (key, value) = pair.split_once('=')?;
        let slot = match key {
            "champion" if alias(value) => &mut champion,
            "plan" if plan_id(value) => &mut plan,
            _ => return None,
        };
        if slot.replace(value.to_owned()).is_some() {
            return None;
        }
    }
    Some(OpenBuild { champion: champion?, plan_id: plan })
}

/// The first launch argument that is a valid link (Windows passes it as a plain argument).
pub fn find_in_args(args: &[String]) -> Option<OpenBuild> {
    args.iter().skip(1).find(|a| a.len() > SCHEME.len() && a[..SCHEME.len()].eq_ignore_ascii_case(SCHEME)).and_then(|a| parse(a))
}
