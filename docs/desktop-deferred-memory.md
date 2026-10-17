# Deferred desktop content and analysis

This follow-up to [the allocation pass](desktop-active-memory.md) reduces live source DOM and startup analysis code. The measurements show lower private committed memory in the sampled views, but **no meaningful, repeatable reduction in total resident working set**. The reported 405 MB active-footprint problem remains open.

## Implementation

`SourceDetails` constructs its body only when opened in the desktop app, and unmounts that body when closed. It covers numeric rune parameters, mode overrides, champion source formulas, named rank values, base-stat tables, helper-record contents, selected-rune descriptions and build rationale lists. Nested toggles do not change their parent. Editable forms are excluded, so collapsing a disclosure does not discard inputs. The website retains eager source rendering and remains independently deployable.

Damage calculation, comparison UI and purchase planning are separate dynamic chunks, requested from the test bench. Scenario defaults and build legality live in lightweight modules rather than pulling the calculator into every validation consumer. `engine.ts` retains its previous exports for compatibility. The calculation itself is no longer run while browsing other tabs. The objective/model registry is still shared at startup; this change does not defer every champion formula function. Once imported, ES modules remain cached for the window lifetime.

The bench shows loading and failure states. A failed optional comparison chunk leaves the editable bench available. Calculator completion after leaving the bench is ignored. Production chunk-graph checks reject a future static dependency on the calculator or the two analysis panels. Both web and desktop builds run this check; the existing website/native boundary guard still passes.

## Structural result

A real 32-rune page previously constructed 1,158 elements, including 32 hidden numeric tables and 32 raw mode-override blocks. With all source disclosures closed it constructs 192 elements, with zero tables or raw blocks: approximately 83% fewer elements. Descriptions and names remain visible. A browser preview using the actual component confirmed opening a table, opening a nested override, and closing the parent returned to zero tables/raw blocks and the original DOM count.

Desktop initial JS moved from approximately 744.73 to 711.48 decimal kB. The deferred calculator is 15.15 kB, purchase planner 2.95 kB and comparison panel 17.54 kB. This reduces startup work; it is not a large overall JavaScript or WebView2 memory reduction. Source data and calculation coverage are unchanged.

## Normal-policy native measurements

Windows 10.0.26200, Intel i5-12600K / 16 logical processors, WebView2 155.0.4283.60, release builds at 1280×860. Baseline UI source: `c0e4fa0`. Each run used 45 samples in a new isolated profile, automatic imports off, first-run dialog dismissed through the isolated preferences fixture. Views and champion were selected through the existing persisted navigation contract. No input was synthesized. These are open-view, **Normal memory policy** measurements, not continuous native interaction or UI latency benchmarks.

| Requested view | Before working set | Updated working set | Before private commit | Updated private commit |
|---|---:|---:|---:|---:|
| Runes, first pair | 419.3 MiB | 420.7 MiB | 245.7 MiB | 225.6 MiB |
| Runes, repeat pair | 417.5 MiB | 413.4 MiB | 241.3 MiB | 217.7 MiB |
| K’Sante champion kit | 416.1 MiB | 417.8 MiB | 234.5 MiB | 218.6 MiB |

These counters measure different things. Private commit is reserved process allocation, not current resident RAM. Summed working sets may count shared runtime pages multiple times. Startup update checks remained enabled and cache/file activity varied across runs. GPU-cache variation contributes substantially to the private-commit differences; they must not all be attributed to the DOM/code changes. After 30 seconds, renderer private commit fell roughly 1.4–2.4 MiB in the rune/kit samples. Total working set remains around 420 MiB and does not demonstrate the requested large active-RAM reduction.

A separate 45-sample `about:blank` control, using the same native host and an explicitly verified Normal target, averaged **322.5 MiB working set** and **132.5 MiB private commit** without React or the app UI. This identifies a substantial runtime/shell cost on this machine. It is not a universal WebView2 minimum or a measurement of another UI framework. Application content still adds roughly 90–100 MiB of working set in these views, so further work should isolate that overhead rather than assume code splitting alone can remove it.

Every accepted sample has successful native Normal-target traces and no Low-target trace. The first attempted baseline used a cargo build without `tauri/custom-protocol`; it produced no UI activity trace and was discarded. The measurement script now rejects an unverified Normal-policy run instead of reporting it as valid.

Raw per-sample data remains under ignored `output/active-memory-pass2/`. Sanitized aggregates, process-kind counters and structural results are in [desktop-deferred-memory-results.json](desktop-deferred-memory-results.json).

## Reproduction and limits

```powershell
npm run desktop:build
./scripts/desktop/measure.ps1 -Mode Window -HoldNormal -Tab Runes -Seconds 45 -Output output/my-runes-run
./scripts/desktop/measure.ps1 -Mode Window -HoldNormal -Tab 'Champion kit' -Champion KSante -Seconds 45 -Output output/my-kit-run
```

`-HoldNormal` sets the per-process diagnostic environment value `RBL_MEMORY_DIAGNOSTICS=normal`. It excludes blur/idle cache reclamation while preserving normal application behavior outside this explicit local profile. `-Control`, used with `-HoldNormal`, opens `about:blank` in the same native shell and requests Normal directly, to estimate the runtime floor without React or application UI. It changes no origin allowlists, permissions or security settings. Ordinary launches still open `index.html`; none of these diagnostic settings persist globally. The script records the launched executable’s SHA-256 for future reproductions.

The benchmark isolates application data, refuses to overwrite an existing startup registration, disables imports, and stops only the process it launched. The default idle memory policy is unchanged. Long native interactions, first-use page-in latency, champion select and live League writes have not been reverified in this pass.

## Verification

898 frontend tests pass, including deferred body construction, eager website compatibility, all-rune source preservation, async calculator cancellation/failure and chunk-graph regressions. The complete 400,000-evaluation regression workload produces identical ranked results, including damage packets, stats, notes and completeness. Rust workspace tests, the native diagnostic test, fmt and Clippy pass. Browser smoke checks confirmed development startup, item damage updates, purchase-order calculations and baseline comparison; an import-order issue found in the first development check was corrected and the flow rerun successfully. Focused read-only review found no actionable issues.

Production website and Windows release/NSIS builds pass. The large initial-chunk warning remains visible. Local unsigned test packaging is kept under `output/active-memory-pass2/release/`; the already-published signed 0.1.1 release is not replaced by a new public release in this task. Pushing the source starts the normal CI and Pages workflows, but does not automatically update installed desktop binaries.
