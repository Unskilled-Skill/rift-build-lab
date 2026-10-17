# Desktop app and shared build experience — implementation plan

Date: 2026-10-17. Spec: `docs/superpowers/specs/2026-10-17-desktop-build-lab-design.md` (approved). Context: `docs/desktop-app-handoff.md`.

Starting point: HEAD `fcf5516` on `codex/build-lab` (equal to `origin/main`). No Tauri, Cargo or desktop files exist. The five dirty provider-research / interaction-audit paths listed in the handoff belong to other work; no task stages them.

This plan pins module names, DTOs, error classes, IPC commands and test files so tasks can be executed independently without inventing incompatible contracts. Where it says "pin at scaffold time", record the exact version in `package-lock.json` / `Cargo.lock`; do not use floating versions in release builds.

## 0. Ground rules for every task

- Each task lands as one commit with its tests. Run `npm test`, `npm run build`, `python -m unittest discover -s tests -p '*test.py'`, `git diff --check`, and from phase C on `cargo test --workspace` and `cargo clippy --workspace -- -D warnings`.
- Tests use tracked compact data (`public/data/**`, `companion/catalog.json`, `companion/riotgames.pem`) or small reviewed fixtures under `tests/fixtures/` / `crates/*/tests/fixtures/`. Never read ignored `data/lol/**`.
- The website must build and behave identically except for the intended shared-UI improvements. Desktop code is absent from the website bundle (checked by T5).
- Do not raise Vite's `chunkSizeWarningLimit`. New lazy boundaries are fine where they serve this work.
- Never report a live League write as verified without the real-client checklist (T23).
- Push completed, verified work with `git push origin HEAD:main` (standing authorization). Pages deploys on push; a failing Pages run must be fixed before continuing.

## 1. Repository layout added by this plan

```text
src/build-plan.ts                 normalized BuildPlan contract + converters
src/BuildPlanView.tsx             build detail (goal → stages → runes → rationale)
src/PurchaseStages.tsx            numbered stages, buy vs choose-one
src/BuildActions.tsx              Load into test bench / Export / (desktop) Apply now, Set default
src/platform/types.ts             Platform interface and DTO mirrors
src/platform/index.ts             getPlatform(): web or lazily imported desktop adapter
src/platform/web.ts               no native capabilities
src/platform/desktop.ts           Tauri IPC wrapper (desktop build only)
src/desktop/ConnectionStrip.tsx   desktop-only status strip
src/desktop/ImportSettings.tsx    desktop-only settings view
src/desktop/FirstRun.tsx          desktop-only setup explanation
scripts/desktop-data/generate.ts  manifest + precomputed meta fallback bundles
scripts/check-web-bundle.mjs      asserts no desktop/Tauri code in dist/
scripts/desktop/measure.ps1       release-build resource measurement
Cargo.toml                        workspace: crates/rbl-core, src-tauri
crates/rbl-core/                  pure Rust library, no Tauri dependency
src-tauri/                        Tauri 2 application crate, config, icons, capabilities
.github/workflows/desktop-ci.yml       Windows cargo test/clippy, independent of Pages
.github/workflows/desktop-release.yml  tagged installer + checksums release
docs/desktop-performance.md       measured results (written by T22)
docs/desktop-live-verification.md real-client checklist and status (T23)
```

`rbl-core` holds everything testable without a window: validation, LCU transport trait, apply/rollback, state machine, preferences, data revisions. `src-tauri` only wires those to IPC, tray, window and plugins. This keeps `cargo test -p rbl-core` fast and lets most logic be tested with fakes.

## 2. Pinned contracts

### 2.1 BuildPlan (TypeScript, `src/build-plan.ts`)

```ts
export type Provenance = 'source-observed'|'authored'|'inferred'|'calculator';
export type StageId = 'start'|'early-recall'|'first-core'|'boots'|'later-core'|'situational'|'final';
export interface PurchaseStage {
  id:StageId; title:string;
  buy:number[];          // bought together / in this order
  chooseOne:number[];    // alternatives; never exported as simultaneous purchases
  note:string; provenance:Provenance;
  available:boolean;     // false → render "not responsibly derivable", export skips it
  cumulativeGold?:number;// completed-item gold so far (earned upgrades at prerequisite cost); excludes starting consumables
}
export interface BuildPlan {
  id:string;                     // stable: `${collection}:${champion}:${sourceId}`
  collection:'authored'|'ceiling'|'experiment'|'meta-reference'|'meta'|'workspace'; // meta-reference = meta-baselines.json
  champion:string; role:'top'|'jungle'|'mid'|'adc'|'support'|'unspecified';
  name:string; category:string; goal:string; summary:string;
  patch:string; dataVersion:string; checkedAt?:string; sourceURL?:string;
  finalItemIds:number[];         // ordered, 1–6
  runePage:number[]; shards:number[];
  stages:PurchaseStage[];        // always ends with id 'final'
  authoredPriorities:string[];   // existing buyOrder prose, shown verbatim
  rationale:string[]; tradeoffs:string[]; // hypothesis or meta item reasons; authored tradeoffs
  provenance:{items:Provenance; runes:Provenance; order:Provenance};
  limits:string[];               // calculator/coverage disclosures
}
export function planFromChatBuild(data:Catalog, build:ChatBuild, collection:'authored'|'ceiling'|'experiment'):BuildPlan;
export function planFromMeta(data:Catalog, build:FullMetaBuild):BuildPlan; // stages from purchaseCheckpoints()
export function planFromWorkspace(data:Catalog, champion:string, ids:number[], runes:number[], shards:number[], name:string, options?:{order?:'authored'|'calculator'}):BuildPlan; // test bench; 'calculator' only if PurchasePlanner applied
export function normalizeRole(role:string):BuildPlan['role']; // middle→mid, bot/bottom→adc, utility→support, else unspecified
export class BuildPlanError extends Error { constructor(public code:'unknown-champion'|'illegal-items'|'illegal-runes'|'stage-overlap', message:string) }
```

Rules: authored/ceiling builds get `start`, `early-recall`, `boots`, `later-core` stages with `available:false` unless structured data exists; `first-core` = first non-boot final item, `final` = finalItemIds. `buyOrder` prose is never parsed into IDs. A stage never contains the same item in `buy` and `chooseOne`. `start` buy total ≤ 500g when available.

`league-export.ts` gains `createLeagueItemSetFromPlan(data, plan)` and `createBundleFromPlan(data, plan)`; existing `createLeagueItemSet`/`createCompanionBundle` stay as thin wrappers so existing tests keep passing. Unavailable stages are skipped; `chooseOne` becomes a separate `"<title> — choose one option"` block (existing behaviour); earned upgrades export prerequisites via the existing `earned` map.

### 2.2 Platform adapter (`src/platform/types.ts`)

```ts
export interface Capabilities { nativeApply:boolean; autoImport:boolean; tray:boolean; dataUpdates:boolean }
export type ConnectionState =
 | {kind:'disabled'} | {kind:'league-closed'} | {kind:'connecting'}
 | {kind:'connected'; phase:string} | {kind:'champ-select'; champion?:string; role?:string}
 | {kind:'applying'} | {kind:'applied'; build:string; verified:boolean}
 | {kind:'paused'} | {kind:'needs-attention'; code:ErrorCode; message:string; recovery:string};
export type ErrorCode = 'client-unavailable'|'tls'|'not-signed-in'|'unsafe-phase'|'patch-mismatch'
 |'rejected'|'rune-capacity'|'ambiguous-ownership'|'partial-apply'|'readback-mismatch'|'backup-failed'
 |'invalid-bundle'|'no-build-for-role'|'data-incompatible'|'internal';
export interface ApplyResult { outcome:'verified'|'applied-unverified'|'rolled-back'|'partial'|'rejected'; message:string; backupPath?:string }
export interface Platform {
  kind:'web'|'desktop'; capabilities:Capabilities;
  dataUrl(path:string):string;                         // web: appPath(); desktop: rbldata://localhost/...
  status():Promise<ConnectionState>; onStatus(cb:(s:ConnectionState)=>void):()=>void;
  testConnection():Promise<{reachable:boolean; clientVersion?:string; message:string}>;
  apply(bundle:CompanionBundle, opts:{items:boolean; runes:boolean}):Promise<ApplyResult>;
  setDefault(key:{champion:string; role:BuildPlan['role']}, bundle:CompanionBundle, planId:string):Promise<void>;
  preferences():Promise<Preferences>; updatePreferences(p:Partial<Preferences>):Promise<Preferences>;
  pause():Promise<void>; resume():Promise<void>; reapply():Promise<ApplyResult>;
  openBackupFolder():Promise<void>; checkDataUpdates():Promise<DataUpdateResult>;
  openExternal(link:ExternalLink):Promise<void>;
}
export type ExternalLink = 'releases'|'riot-lcu-policy'|'website'|{kind:'source'; url:string}; // source URLs are checked against an allowlist of provider hosts in Rust
```

`src/platform/index.ts`: `export const isDesktop = import.meta.env.VITE_TARGET === 'desktop'` (build-time constant) and `getPlatform()` returns `webPlatform` or `await import('./desktop')`. Web methods that need native access are never called because `capabilities` gates UI; if called they reject with `ErrorCode 'internal'`.

`hosting.ts`: `appPath` unchanged; all data `fetch(appPath('/data/…'))` call sites move to `platform.dataUrl('/data/…')` (synchronous wrapper `dataUrl` exported from `src/platform/index.ts` so components need no async).

### 2.3 Rust error model (`crates/rbl-core/src/error.rs`)

```rust
#[derive(Debug, thiserror::Error, Clone, serde::Serialize)]
#[serde(tag = "code", rename_all = "kebab-case")]
pub enum CoreError {
  ClientUnavailable, Tls, NotSignedIn, UnsafePhase { phase: String }, PatchMismatch { client: String, data: String },
  Rejected { status: u16 }, RuneCapacity, AmbiguousOwnership, BackupFailed,
  InvalidBundle { reason: &'static str }, NoBuildForRole, DataIncompatible { reason: &'static str }, Internal,
}
pub enum Mutation { Confirmed, Ambiguous } // carried by transport errors on non-GET calls
```

Messages for the UI are produced by `CoreError::user_message()` / `recovery()` only; no upstream body, URL, credential or OS error text is ever included (parity with `companion/core.py`). `ErrorCode` in TS mirrors the serde tags 1:1; a test in each language asserts the shared list in `tests/fixtures/error-codes.json`.

### 2.4 IPC commands (`src-tauri/src/commands.rs`)

All commands are `async`, take typed DTOs (serde `deny_unknown_fields`), and return `Result<T, CoreError>`. Exposed only to the main window via `src-tauri/capabilities/main.json`; no `fs`, `http` or `shell` plugin permissions are granted to the webview.

| Command | Input | Output |
|---|---|---|
| `get_status` | — | `ConnectionStateDto` |
| `test_connection` | — | `TestConnectionDto` |
| `apply_build` | `ApplyRequest { bundle: Bundle, items: bool, runes: bool }` | `ApplyResultDto` |
| `set_default_build` | `DefaultRequest { champion: String, role: Role, plan_id: String, bundle: Bundle }` | `()` |
| `clear_default_build` | `DefaultKey` | `()` |
| `get_preferences` / `update_preferences` | — / `PreferencesPatch` | `PreferencesDto` |
| `pause_auto_import` / `resume_auto_import` | — | `()` |
| `reapply_last` | — | `ApplyResultDto` |
| `open_backup_folder` | — | `()` |
| `check_data_updates` | — | `DataUpdateDto` |
| `get_data_revision` | — | `RevisionDto` |
| `open_external` | `ExternalLinkDto` | `()` |
| `check_app_update` | — | `AppUpdateDto { current, latest?, release_url? }` |
| `ui_state_saved` | `UiState` (≤ 16 KiB) | `()` |

Events emitted to the window: `status-changed` (`ConnectionStateDto`), `data-revision-changed` (`RevisionDto`), `persist-ui-state` (request before window destruction), `open-build` (validated deep-link payload).

`Bundle` is the existing `CompanionBundle` v1 JSON format from `src/league-export.ts`; Rust revalidates it with `bundle::validate` against the active data revision's catalog regardless of who produced it.

### 2.5 Preferences (`%APPDATA%\RiftBuildLab\preferences.json`, schema 1)

```json
{"schema":1,"autoImport":{"enabled":false,"items":true,"runes":true,"metaFallback":false},
 "background":{"trayOnClose":false,"startWithWindows":false},
 "defaults":{"Cassiopeia|mid":{"planId":"authored:Cassiopeia:…","patch":"26.20","bundleSha256":"…","bundle":{…}}},
 "lastApplied":null,"lastFailure":null,"ui":{}}
```

Written atomically (temp file + `sync_all` + rename) only on change. Unknown schema → keep file, start with defaults in memory, show needs-attention; never overwrite an unknown-version file.

### 2.6 Desktop data manifest (`dist/data/desktop/manifest.json`, published with Pages)

```json
{"schema":1,"formulaCompat":1,"revision":"<sha256 of sorted file hashes>","patch":"26.20","dataVersion":"16.20.1",
 "generatedAt":"…","sourceCheckedAt":{"providers":"…","roles":"…"},
 "files":[{"path":"catalog.json","bytes":1920476,"sha256":"…"},{"path":"desktop/meta-bundles/Cassiopeia.json","bytes":…,"sha256":"…"}]}
```

`path` must match `^[A-Za-z0-9._/-]+$`, contain no `..`, and start with one of the allowlisted prefixes (`catalog.json`, `champions/`, `champion-builds/`, `ability-ceilings/`, `champion-meta-plans.json`, `meta-baselines.json`, `provider-research/`, `provider-roles/`, `interaction-audit/`, `desktop/`). Historic `provider-research/versions/*` older than the index's current directory are excluded. `formulaCompat` is a constant in `src/model-support.ts` bumped whenever engine/ability formulas change; the desktop binary embeds the value it supports.

`desktop/meta-bundles/<Champion>.json` = `{role → CompanionBundle}` precomputed by `scripts/desktop-data/generate.ts` from `buildFullMeta` + `purchaseCheckpoints` + `createBundleFromPlan` for every qualified role (primary meta plan and provider-roles alternates). This is what lets the background monitor apply a meta fallback without the webview or a JS runtime. The bundles are regenerated by `npm run desktop-data` inside every `npm run build` (so they follow the daily provider refresh) and are git-ignored; `chatgpt-builds.json` is also allowlisted because the library loads it.

### 2.7 Auto-import state machine (`crates/rbl-core/src/auto_import.rs`)

Pure function, no IO:

```rust
pub fn step(state: &State, event: Event, prefs: &AutoPrefs) -> (State, Vec<Effect>);
pub enum State { Disabled, WaitingForLeague { attempt: u32 }, Connected { account: AccountId },
  ChampSelect { account: AccountId, session: SessionKey, pick: Option<Pick>, stable_since: Option<Instant> },
  ReadyToApply { identity: ApplyIdentity }, Applying { identity: ApplyIdentity },
  Applied { identity: ApplyIdentity, session: SessionKey, outcome: Outcome }, Paused { prior: Box<State> },
  NeedsAttention { error: CoreError, session: Option<SessionKey> } }
pub enum Event { Enable, Disable, Pause, Resume, Tick(Instant), ClientFound(AccountId), ClientLost,
  Phase(String), ChampSelectSnapshot { account: AccountId, session: SessionKey, pick: Option<Pick> },
  PreflightOk(ApplyIdentity), PreflightChanged, ApplyFinished(ApplyIdentity, Result<ApplyOutcome, CoreError>),
  ExplicitApply(ApplyIdentity), Reapply, RevisionChanged(Revision) }
pub enum Effect { StartDiscovery { backoff: Duration }, Poll { every: Duration }, Subscribe, Preflight(ApplyIdentity),
  Apply(ApplyIdentity), EmitStatus, PersistLastResult }
pub struct ApplyIdentity { account: AccountId, session: SessionKey, champion_id: u32, role: Role, plan_id: String, revision: Revision }
pub struct SessionKey { game_id: u64, entry_seq: u64 } // entry_seq increments on each observed entry into ChampSelect
```

Required behaviours (each a named unit test in `crates/rbl-core/tests/auto_import.rs`): disabled emits no discovery; stable nonzero pick for ≥ 1.5 s before ReadyToApply; at most one Apply per identity; duplicate snapshots are no-ops; champion swap or role change creates a new identity; returning to an already-applied champion in the same session does not reapply unless `Reapply`; account change drops pending identity; `PreflightChanged` aborts; unknown phase / InProgress / Reconnect / patch mismatch block; `NeedsAttention` after an `Ambiguous` outcome never auto-retries; `RevisionChanged` during ChampSelect does not create a new identity for the current session; no preference + `metaFallback:false` → `NeedsAttention(NoBuildForRole)` shown as "Choose build"; experiments/ceilings are never chosen automatically; `role == unspecified` never uses meta fallback.

Polling intervals: 1 s in ChampSelect, 5 s connected, 15→60 s exponential while waiting. When a WAMP subscription is active (T13), polling in ChampSelect drops to a 15 s safety re-read.

Role mapping (`roles.rs`): LCU `assignedPosition` `top|jungle|middle|bottom|utility` → `top|jungle|mid|adc|support`; empty/other → `unspecified` (blind pick, ARAM, custom).

## 3. Tasks

Dependency summary: A (T1–T5) is independent of the Rust work and ships to the website first. B (T6) needs T1. C (T7–T12) depends only on the contracts above (T12's tests use T6 output as fixtures). D (T13–T16) needs T7–T12. E (T17–T20) needs A + D. F (T21–T24) needs everything.

### Phase A — shared build UI and platform boundary (website ships after this phase)

**T1 · BuildPlan contract and converters.** Add `src/build-plan.ts` per §2.1; implement converters using `purchaseCheckpoints` for meta and existing `ChatBuild` fields for authored/ceiling/experiment collections. Add `createLeagueItemSetFromPlan` / `createBundleFromPlan` in `league-export.ts`, keeping existing exports as wrappers.
Tests `tests/build-plan.test.ts`: (a) failing first: every `public/data/champion-builds/*.json` proposal, every ability-ceiling build and every meta plan × qualified role converts without error; (b) all have legal runes/shards (`validRunePage`) and 1–6 legal items; (c) no `buy`/`chooseOne` overlap; (d) `start` ≤ 500g when available; (e) authored builds never produce `available:true` start/recall stages; (f) exported blocks contain only SR-listed, shop-listed IDs and earned upgrades map to prerequisites; (g) authored `buyOrder` text is preserved verbatim; (h) stable `id` for the same input. Existing `league-export.test.ts` and `purchase-checkpoints.test.ts` stay green unchanged.

**T2 · PurchaseStages and BuildPlanView.** `PurchaseStages.tsx` renders numbered stages with item icons/names, cumulative gold where defined, "Choose one" groups, and an explicit "Not available for this build" line for unavailable stages. Provenance badge per stage (Observed / Authored / Inferred / Damage-calculated) using existing tokens. `BuildPlanView.tsx`: header (champion, role, name, category, patch, check date, explanation) → stages → `RunePreview` (full page + shards with expandable effects) → authored priorities, item/rune rationale, tradeoffs, limits. `PurchaseGuide.tsx` becomes a wrapper over `PurchaseStages` to avoid duplicate UIs. No new UI packages.
Tests: vitest render tests (`tests/build-plan-view.test.tsx`, using `react-dom/server` `renderToString` — no new test deps) for one authored, one ceiling, one meta plan: headings present, choose-one rendered as alternatives, unavailable text present, damage order never labelled practical.

**T3 · Build library and meta panel use BuildPlanView.** `BuildLibrary.tsx`: concise list rows (final items, keystone, cost, source status) with collection + role filters; selecting a row opens `BuildPlanView`; mobile single-column disclosure. `FullMetaPanel.tsx` uses `planFromMeta` + `BuildPlanView`. Selected build stays highlighted (`aria-current`). Extract only what's needed from `App.tsx`.
Tests: existing `champion-builds`, `chat-builds`, `meta-*` suites green; new filter unit test in `tests/build-plan.test.ts` for `filterPlans(plans, {collection, role})`.

**T4 · BuildActions and export from plans.** `BuildActions.tsx` replaces direct `LeagueImportActions` usage: Load into test bench, Download item set, Download items + runes file, Open companion (kept during migration), and — only when `capabilities.nativeApply` — Apply now and Set as automatic default. Show champion/role and item/rune target toggles beside the actions. Test-bench export uses `planFromWorkspace`; damage-planner order is labelled calculator-derived and never becomes a default automatically.
Tests: extend `tests/league-export.test.ts` — plan export block order = stages order; choose-one blocks separate; regression snapshot of one existing export to prove the website output is unchanged for test-bench exports.

**T5 · Platform adapter and web-bundle guard.** Add `src/platform/*` (§2.2). Replace data `fetch(appPath('/data/…'))` call sites with `dataUrl(...)`. `vite.config.mjs`: `define` `import.meta.env.VITE_TARGET` (default `web`); desktop mode via `vite build --mode desktop` with `base:'./'` and no dev middlewares in production. Add `scripts/check-web-bundle.mjs` that fails if `dist/**/*.js` contains `__TAURI`, `@tauri-apps`, `rbldata:` or `invoke(`; wire into `npm run build` after `vite build`.
Tests: `tests/platform.test.ts` — web platform has all capabilities false and `dataUrl` equals `appPath`; `tests/hosting.test.ts` stays green. Record JS chunk sizes before/after in the commit message; no increase > 5 KB gzip to the main chunk.

Ship checkpoint: run full checks, manual desktop + 390 px mobile browser pass of library → detail → export, push, confirm Pages deploy.

### Phase B — data publication for desktop

**T6 · Desktop data generator.** `scripts/desktop-data/generate.ts` bundled with Vite SSR (`vite build --ssr scripts/desktop-data/generate.ts --outDir output/desktop-data-gen`, no new deps) and run by `node`. Emits `public/data/desktop/meta-bundles/*.json` and, after `vite build`, `dist/data/desktop/manifest.json` (§2.6) hashing only the allowlisted dist data files. Add `"desktop-data"` npm script and call it from `build`. Add `FORMULA_COMPAT = 1` to `src/model-support.ts`.
Tests `tests/desktop-data.test.ts`: every bundle validates through the existing frontend bundle path and through the Python `companion.core.validate_bundle` (extend `tests/companion_contract_test.py`); manifest paths match the allowlist regex; revision is deterministic for identical inputs; excluded paths (raw exports, old provider versions) absent; manifest total size reported.

### Phase C — Rust core (`crates/rbl-core`)

Scaffold: root `Cargo.toml` workspace (`resolver = "2"`, `[profile.release] lto = true, codegen-units = 1, opt-level = "s", strip = true, panic = "abort"`). `rbl-core` deps (pin at scaffold time): `serde`, `serde_json`, `thiserror`, `tokio` (rt, time, sync, macros), `reqwest` (`default-features = false`, `rustls-tls-manual-roots`, `json`), `rustls`, `rustls-pemfile`, `sha2`, `uuid` (v5), `tempfile`, `time`; Windows-only `windows-sys` (ToolHelp/process image path). Dev: `tokio` test-util. No PowerShell spawning.

**T7 · Strict JSON, catalog and bundle validation (`json.rs`, `catalog.rs`, `bundle.rs`).** `json::parse_strict` rejects duplicate keys, NaN/Infinity, and > 64 KiB input. `bundle::validate(&Value, &Catalog) -> Result<ValidBundle, CoreError>` ports `validate_bundle` exactly, including label replacement and `managed_uid` (UUIDv5 of `https://riftbuildlab.local/item-set/{id}` — must equal the Python value). `load_input` equivalents for `.riftbuild.json` (incl. `" (n)"` browser-renamed names) and the new deep-link payload.
Tests: port every validation case from `tests/companion_test.py` into `crates/rbl-core/tests/bundle.rs`; parity test runs all `public/data/desktop/meta-bundles/*` plus `tests/fixtures/bundles/*.json` and compares `managed_uid` and accept/reject with a fixture of Python results (`tests/fixtures/bundle-parity.json`, generated by a small Python script committed alongside).

**T8 · Lockfile and discovery (`lcu/lockfile.rs`, `lcu/discovery.rs`).** `Credentials { port, password: Secret }` with redacting `Debug`. Discovery order: running `LeagueClientUx.exe`/`LeagueClient.exe` image directories (ToolHelp32 + `QueryFullProcessImageNameW`), configured directory, `C:\Riot Games\League of Legends`; lockfile ≤ 2 KiB.
Tests: lockfile parsing cases from Python; `format!("{:?}")` never contains the password; discovery with an injected directory list.

**T9 · Transport (`lcu/transport.rs`).** `trait Lcu { async fn call(&self, req: LcuRequest) -> Result<Value, TransportError> }`. `LcuRequest` is an enum (GetSummoner, GetPhase, GetGameVersion, GetChampSelectSession, GetPages, GetItemSets{summoner}, PutItemSets{summoner, body}, PostPage{body}, PutPage{id, body}) — paths are built internally and only target `https://127.0.0.1:{port}`. TLS: rustls with only `riotgames.pem` as root, custom `ServerCertVerifier` wrapping `WebPkiServerVerifier` that accepts exactly `CertificateError::NotValidForName` and nothing else. 8 s timeout, 4 MiB body cap, `TransportError { mutation: Mutation, kind }` mapping as in Python (5xx / IO / oversized / undecodable on non-GET → Ambiguous; 4xx on POST page → RuneCapacity).
Tests: local rustls test server with a test CA (fixture generated once and committed under `crates/rbl-core/tests/fixtures/tls/`): valid chain with wrong name accepted; untrusted chain rejected; expired rejected; oversized body → Ambiguous for PUT, plain error for GET; error strings contain no URL/password.

**T10 · Backups and atomic files (`fsx.rs`, `backup.rs`).** `atomic_write_json(path, &T)` (temp in same dir, `sync_all`, `rename`, cleanup on failure). Backup format identical to Python (`format:1`, `createdAt`, `summonerId`, `itemSets`, `runePages`, `bundle`) under `%LOCALAPPDATA%\RiftBuildLab\backups`. Credentials never serialized.
Tests: failure mid-write leaves no partial file; backup contains no password; filename unique.

**T11 · Apply with rollback and read-back (`apply.rs`).** Port `apply_bundle` step for step (readiness → summoner → reads → ownership check → backup → readiness recheck → items PUT → readiness → rune PUT/POST → rollback rules). Add read-back: GET item sets and pages, check managed set blocks and page perks equal the request → `ApplyOutcome::Verified`; read failure → `AppliedUnverified`; mismatch → `CoreError` code `readback-mismatch` with no automatic retry. Add `SAFE_PHASES` = Python list; add optional `expected: ApplyIdentity` check (re-read champ-select local pick + summoner immediately before writes; changed → `PreflightChanged`).
Tests `crates/rbl-core/tests/apply.rs` with a `FakeLcu` mirroring Python's: every `CompanionTests` apply case (unrelated sets preserved, owned page updated, capacity never deletes, second-step failure rolls back items, rejected first write no rollback, rollback failure partial, ambiguous POST partial without deletion), plus read-back verified / unverified / mismatch, pick changed before write aborts with zero writes, single write queue (two concurrent applies serialize — tested via `tokio::sync::Mutex` ownership in `Writer`).

**T12 · Preferences and data revisions (`prefs.rs`, `data.rs`).** Preferences per §2.5 with `PreferencesPatch` merge and validation (defaults revalidated as bundles on load; invalid → dropped into `needsReview` list, file kept). Data: bundled snapshot in app resources; cache at `%LOCALAPPDATA%\RiftBuildLab\data\{revision}\` with `current.json` pointer swapped atomically; keep current + one last-known-good; update = fetch fixed manifest URL (`https://unskilled-skill.github.io/rift-build-lab/data/desktop/manifest.json`, compiled constant), compare revision, download changed files to `staging-{revision}`, verify sizes/sha256/schema/`formulaCompat`, validate catalog + meta bundles, then switch. Throttle: launch + ≥ 6 h + explicit. `formulaCompat` mismatch → keep current, report "application update required".
Tests: corrupt manifest, hash mismatch, path traversal (`../`, absolute, backslash, disallowed prefix), interrupted download (staging left, current untouched, next run cleans staging), offline (uses cache), formulaCompat mismatch, unchanged revision does zero file downloads (fake HTTP), never mixes revisions (pointer only flips after full validation). HTTP is behind a `trait Fetch` so tests need no network.

### Phase D — monitor and desktop shell (`src-tauri`)

Scaffold with Tauri 2 (pin at scaffold time): plugins `single-instance`, `deep-link`, `autostart`, `opener`; core features `tray-icon`. `tauri.conf.json`: `frontendDist: "../dist-desktop"`, `beforeBuildCommand: "npm run build:desktop"`, CSP `default-src 'self'; img-src 'self' rbldata: https://raw.communitydragon.org https://ddragon.leagueoflegends.com data:; connect-src 'self' ipc: rbldata:; script-src 'self'`, bundle target `nsis` with `webviewInstallMode: { type: "downloadBootstrapper" }`, resources = bundled data snapshot. npm scripts: `build:desktop` (`vite build --mode desktop --outDir dist-desktop`), `desktop:dev`, `desktop:build` (`tauri build`). `@tauri-apps/cli` and `@tauri-apps/api` as devDependency/dependency respectively; `@tauri-apps/api` is only imported from `src/platform/desktop.ts`.

**T13 · Auto-import state machine (`auto_import.rs`) and champ-select reader.** Implement §2.7 in `rbl-core`. Add `champ_select.rs` that reduces `/lol-champ-select/v1/session` to `{ local_cell, champion_id (locked or hovered-intent excluded: only `championId` of local player, nonzero), assigned_position, game_id }`. Optional WAMP subscription (`ws.rs`, `tokio-tungstenite` with the same TLS verifier) to `OnJsonApiEvent_lol-gameflow_v1_gameflow-phase` and `…_lol-champ-select_v1_session`; any WS failure falls back to polling.
Tests: all §2.7 behaviours; champ-select reducer fixtures (`tests/fixtures/champ-select/*.json`: blind, draft hover, locked, swap, ARAM, custom with gameId 0) — fixtures are hand-written from the documented shape and flagged as unverified until T23.

> As built, T13 delivered the pure state machine (`auto_import.rs`, with `choose_build`) and the champ-select reducer (`lcu/champ_select.rs`: only a *completed* local pick action counts; without pick actions, e.g. ARAM, the assigned champion counts). The optional WAMP event subscription moved to T14, where the runtime lives; bounded polling already satisfies the spec. Applied state is a field of the champ-select context rather than a separate state, and `selection-changed` joined the shared error codes.

**T14 · Monitor runtime (`src-tauri/src/monitor.rs`).** One tokio task owns `State`, drives `step`, executes effects with the real `Lcu`, `Writer` and timers, emits `status-changed` only on change, persists `lastApplied`/`lastFailure` only on change. Cancellation via `CancellationToken` on quit. Manual `apply_build` goes through the same `Writer` queue. Selecting the build for an identity: preference for `champion|role` → else meta bundle for role if `metaFallback` → else NoBuildForRole.
Tests: integration test with `FakeLcu` scripted timeline (lobby → champ select → hover → lock → apply → swap → apply → game start) asserting exact write count; duplicate-launch covered in T16.

> As built, T14 put the monitor runtime in `rbl-core` (`monitor.rs`, with `ClientSource`/`Library` traits, `library::StoreLibrary`, `lcu::LocalClientSource`, `paths::AppPaths`) so it is tested on tokio's paused clock with a fake client; `src-tauri` only spawns it and emits `status-changed`. Event subscription (WAMP) is still deferred: polling meets the spec, and T22 measures whether the 1 s champ-select poll matters. `npm run build:desktop` now splits the build: `dist-desktop` (frontend, embedded) and `dist-desktop-data` (only manifest-listed files, shipped as installer resources under `data/`). Building or linting `src-tauri` requires `npm run build:desktop` first, because Tauri embeds `dist-desktop` and checks resources at compile time.

**T15 · Commands, capabilities and data protocol.** Implement §2.4 commands with `deny_unknown_fields` DTOs and size limits (bundle ≤ 64 KiB, UI state ≤ 16 KiB). Register `rbldata` async URI scheme serving only files listed in the active manifest (or bundled snapshot) with correct content types; any other path → 404. `open_external` maps enum links to fixed URLs; `source` URLs allowed only for `op.gg`, `lolalytics.com`, `developer.riotgames.com`, `github.com/Unskilled-Skill/rift-build-lab`. `capabilities/main.json` grants only `core:event:default`, `core:window:default`, the custom commands and `deep-link:default`.
Tests: command DTO rejection tests (unknown field, oversize, wrong types) via direct function calls; protocol handler path tests; a test that parses `capabilities/main.json` and fails if `fs:`, `http:`, `shell:` or `opener:allow-open-url` appear.

> As built, T15 keeps command logic in `rbl-core::ipc` (request types with `deny_unknown_fields`, `IpcError {code, message, recovery}`, `serve_data`, `external_url`, release check) and `rbl-core::net::HttpsFetch` (Mozilla roots, only the data base URL and the releases API, no redirects, 32 MiB cap). `src-tauri` declares the 15 commands in an app manifest and the capability grants exactly `core:event:default` plus their `allow-*` permissions; the opener plugin is used from Rust only. On Windows the protocol is `http://rbldata.localhost/data/...` with `Access-Control-Allow-Origin` limited to the window origin. Verified in the running debug app through WebView2's DevTools port: data loads, traversal is 404, unknown fields and the opener plugin are refused, and a live update installed the published revision (about 210 s in a debug build because each file opens a new connection; connection reuse is a T22 item). `ui_state_saved` and `persist-ui-state` move to T16 with window lifecycle.

**T16 · Window, tray, single instance, deep link, autostart.** Close with `trayOnClose` → emit `persist-ui-state`, await `ui_state_saved` (1 s timeout), `window.destroy()`; tray menu: Open, Pause/Resume auto-import, Quit. Without `trayOnClose` close quits. Second launch focuses/recreates the window and forwards a deep link. Scheme `riftbuildlab-desktop://open?champion=<alias>&plan=<planId>` (opens the build view only; never applies, never enables auto import; `.riftbuild.json` payloads open the existing import preview). Legacy `riftbuildlab://` untouched. Autostart only toggled by `startWithWindows`.
Tests: unit tests for deep-link parsing (rejects unknown hosts/params, oversize, non-alias champion); manual checklist items in T21.

> As built, T16: the main window is created on demand (`create: false`), so reopening and a tray-only `--background` start (only when tray mode is on) work; close in tray mode emits `persist-ui-state`, waits at most 1 s for `ui_state_saved` (stored as `ui` in preferences, 16 KiB object), then destroys the webview; `RunEvent::ExitRequested` without a code is prevented only in tray mode, and tray Quit exits. The tray has Open, Pause, Resume and Quit plus a status tooltip. Single instance shows the window; links use `tauri-plugin-deep-link` (scheme `riftbuildlab-desktop`, registered by the installer) and `rbl_core::deeplink::parse` (champion alias + optional plan id only). An open window receives `open-build`; a newly created one collects the link with the new `take_pending_open` command. Autostart follows `startWithWindows`. Verified live in a debug build: tray close leaves 0 WebView2 processes at about 41 MiB native working set, a second launch with a link reopens the window and exits, and close without tray mode quits.

### Phase E — desktop UI

**T17 · Desktop platform adapter.** `src/platform/desktop.ts` wraps commands/events with runtime type guards on every response (reject unknown `kind`). Desktop `dataUrl` → `rbldata://localhost/…` (Windows form `http://rbldata.localhost/…` per Tauri 2). Tests: guards reject malformed DTOs (`tests/platform-desktop.test.ts` with a mocked `invoke`).

**T18 · Connection strip and actions.** `ConnectionStrip.tsx` renders every `ConnectionState` with text + Lucide icon (no animation beyond a static spinner-free "Connecting…" label); `applied` with `verified:false` reads "Applied — not confirmed by read-back". `BuildActions` Apply now shows target toggles and result outcome text per `ApplyResult.outcome`; partial and rolled-back clearly distinct from success. Set as automatic default stores the current plan's bundle for champion/role (role picker required if plan role is `unspecified`).
Tests: render test for every state and outcome string; no "applied" wording for requested/queued states.

**T19 · First run and Import settings.** `FirstRun.tsx` (shown once; auto-import off; explains item/rune changes; independent toggles; meta fallback described and only enabled together with auto-import; Test connection). `ImportSettings.tsx`: enable/pause, item/rune switches, defaults list with clear/needs-review, meta fallback, last applied / last failure, Reapply, Open backup folder, Check data updates with revision/patch/check dates, tray-on-close, start-with-Windows, app version + Check for app update (link to GitHub Release only).
Tests: render tests; preferences round-trip through mocked adapter.

**T20 · Desktop shell integration and website download entry.** Desktop-only sections mounted via `isDesktop` + dynamic import so they are tree-shaken from the web build (T5 guard proves it). Website: in `BuildActions`'s export details, add "Windows desktop app (optional)" linking to the GitHub Releases page with platform requirements; companion instructions remain until the user retires them. Keyboard: full tab order and visible focus for strip, settings, actions.
Tests: `scripts/check-web-bundle.mjs` passes; existing suites green.

### Phase F — release and verification

**T21 · Workflows and packaging.** `desktop-ci.yml` (windows-latest; on push/PR touching `crates/**`, `src-tauri/**`, `src/**`, `Cargo.*`): `npm ci`, `npm test`, `cargo test --workspace`, `cargo clippy -D warnings`, `npm run desktop:build` (unsigned), upload installer as artifact, fail if installer > 30 MiB. `desktop-release.yml` (tag `desktop-v*` / dispatch): same plus SHA-256 file and a draft GitHub Release; never touches Pages. `pages.yml` unchanged except the build now emits desktop data (already within `npm run build`). Manual installer checks: fresh install, upgrade over previous version preserves preferences/backups, uninstall leaves `%APPDATA%`/`%LOCALAPPDATA%` data (documented, with explicit export path).

**T22 · Measured performance.** `scripts/desktop/measure.ps1` launches the release build, finds the app PID and its `msedgewebview2.exe` descendants, samples CPU and working set every second for 60 s in each mode (interactive idle; background with webview destroyed and League closed; background with League in lobby), and checks disk writes via file timestamps under the app data directories. Record machine, Windows build, WebView2 version, cold vs warm launch, installer size in `docs/desktop-performance.md`. Targets from the spec are compared, not asserted; misses are investigated and either fixed or reported honestly.

**T23 · Real League Client verification.** `docs/desktop-live-verification.md` checklist: test connection; manual Apply (items only, runes only, both) with read-back; managed set/page names; personal pages untouched; full rune capacity behaviour; auto-import in draft, blind, ARAM; champion swap; role mismatch; game start blocks; account switch; Reapply; offline client. Status stays **Blocked — not run** until performed signed-in by the user or with them present. Fixture corrections from observed payloads go back into T13 fixtures.

**T24 · Website regression and docs.** Re-run full checks; live Pages check on desktop width and 390 px for library, detail, export, imports, no horizontal overflow; confirm `check-web-bundle` on the deployed artifact. Update `README.md`, `PRODUCT.md` (two products, scope boundary, Riot disclosure), and the handoff status. Push.

## 4. Migration from manual exports

- `.riftbuild.json` files and the `riftbuildlab://` companion link keep working on the website throughout; the desktop app opens `.riftbuild.json` through the existing import preview and Apply now.
- The desktop app does not install, uninstall or re-register the Python companion or its scheme.
- Companion backups are not migrated automatically; Import settings links to the companion's backup folder if it exists.
- Removing the companion download is a separate later decision for the user, after T23 passes.

## 5. Risks to watch

- LCU payload shapes for champ select are documented by the community, not Riot; T13 fixtures are provisional until T23.
- Riot certificate name behaviour is assumed from the Python companion (`check_hostname=False`); T9's verifier must accept only the name mismatch. As built, T9 uses hyper + tokio-rustls (ring provider, no aws-lc) rather than reqwest, and generates test CAs with rcgen at test time instead of committing key material. rustls-webpki is stricter than OpenSSL (v3 certificates, EKU rules); if Riot's chain fails it in T23, adjust the verifier deliberately rather than falling back to insecure TLS.
- `rbldata` URL form on Windows WebView2 differs from other platforms; T17 must use Tauri's `convertFileSrc`-style helper rather than hardcoding if the API offers it.
- Main JS chunk (~722 KB) — T3/T5 should lazy-load the test bench and comparison lab if the build library becomes the first screen, not raise the warning.
