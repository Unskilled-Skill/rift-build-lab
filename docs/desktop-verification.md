# Desktop continuation verification

Date: 2026-10-17. Native/session fixes: `de44ec8`. This report distinguishes implementation, automated evidence and remaining manual gates.

## Implemented

- Rust/Tauri optional Windows app; shared React build library, purchase stages, visual runes, comparisons and web exports remain separate from native capabilities.
- Local League discovery, pinned-root TLS transport, validated managed item/rune writes, pre-write backups, rollback and read-back results.
- Opt-in champion-select monitoring with role-qualified defaults and optional meta fallback. Account, game, champion and role checks guard writes. Polling is bounded; no WAMP subscription is claimed.
- First-run/import settings, tray lifecycle, startup opt-in, desktop links, navigation restore and synchronous draft persistence before tray close.
- Protected data revision per open window, serialized update activation, last-known-good cache and formula compatibility checks. Reopen the window to use an activated revision.

Review corrections cover current champion after trades, reconnect/provider refresh deduplication, manual apply protection, no phantom in-flight apply on rejected manual requests, account/session binding, failed startup reconciliation, stale save acknowledgements and failed saves keeping the window open.

## Checks performed

| Check | Result |
|---|---|
| `npm test` | 872 passed in 54 files |
| Python unittest discovery | 34 passed |
| `cargo test --workspace --locked` | 102 passed; no failures |
| `cargo fmt --all --check` | Passed |
| `cargo clippy --workspace --locked -- -D warnings` | Passed |
| TypeScript / production web build | Passed; web bundle guard excludes native integration |
| `npm run desktop:build` | Passed; release executable and NSIS x64 installer produced |
| `scripts/desktop/check-artifacts.ps1` | Passed; resource hashes/sizes/allowlist and version match |
| Shared browser UI | Build selection, purchase stages, visual runes at desktop and 390 px; no horizontal overflow or console errors observed |

The existing approximately 741 kB main web JS chunk still emits Vite's size warning. It was not silenced or represented as optimized. Rust tests use fakes/test TLS servers, not an authenticated League client.

## Packaging

Version 0.1.0 installer: **3,130,280 bytes (2.99 MiB)**. SHA-256:

`6bd843f4c9a64c89039878a4a1222899010bf311928aa04914d8423ecf50a4a6`

Bundled data revision `40f40f8e04e3c89d40ba605710a0c1662f5d808a9bc4ad4df3d3d54744a898e9`, patch 26.20, 1,063 manifest files / approximately 14.9 MiB uncompressed. The installer uses system WebView2 and downloads its bootstrapper if needed; its small size does not include that runtime. No bundled Chromium/Node/Python runtime. This is an **unsigned preview**, not a public stable release.

Windows CI runs locked native checks, frontend tests/build, packaging and artifact validation. The release workflow checks a matching existing `desktop-vVERSION` tag and built commit, then creates a draft prerelease with installer, checksum and metadata. It does not publish the draft or change Pages. Local packaging is verified; consult Actions for each pushed CI run's independent status.

## Remaining gates

See [live verification](desktop-live-verification.md): signed-in League application and installer install/upgrade/uninstall are **not run**. See [performance](desktop-performance.md) for measured idle figures and unmeasured scenarios. Cached UI-ready timing and League-in-lobby performance are not established. Keep the existing website and Python companion available while these gates remain.
