# Open-window desktop memory optimization

The Windows desktop app now requests WebView2's low memory target after 15 seconds without input or immediately on focus loss. It restores normal mode on focus, pointer/keyboard/wheel input, accessible clicks, form input and IME composition. An ongoing damage search or desktop settings operation keeps normal mode. This code is mounted only by the desktop shell; the independent website retains its own build with no native IPC.

## What changed

The baseline process breakdown showed approximately 30 MiB native, 119 MiB WebView2 browser, 99 MiB renderer, 99 MiB GPU and the remaining utility/crash processes. The main opportunity is the browser runtime's retained resident pages and caches, not the Rust monitor. A trial Chromium low-end-device flag saved only about 16 MiB of working set and was not retained.

The implementation uses `ICoreWebView2_19.SetMemoryUsageTargetLevel` on the WebView's owning UI thread, through an async Tauri command. No GPU disabling, renderer restart, periodic reload, forced garbage collection, process killing or sandbox changes are used. Page state and scripts remain alive. Older runtimes which cannot support this interface keep their existing behavior.

This is a best-effort cache/page residency policy. Lower resident RAM does not imply the same reduction in private committed memory, and active use can bring the working set back up. Returning to a paged-out view may have a page-in cost; native interactive latency has not been benchmarked. See [Microsoft's memory target API](https://learn.microsoft.com/en-us/dotnet/api/microsoft.web.webview2.core.corewebview2.memoryusagetargetlevel) and [WebView2 performance guidance](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/performance).

## Measured result

Release source `db03a23`, Windows 10.0.26200, Intel i5-12600K / 16 logical processors, WebView2 155.0.4283.60; same machine and window size (1280x860), automatic imports off, League closed. Each run used 60samples in a new isolated data directory. No input was sent; Codex was foreground, and the native trace confirms successful normal→low requests on focus loss. These numbers describe an **open, unfocused window**, not continuous active interaction.

| Working-set metric | Before | Updated |
|---|---:|---:|
| Open-window mean over entire run | 425.9 MiB | 190.9 MiB |
| Open-window mean after 30seconds | 426.2 MiB | 85.4 MiB |
| Maximum observed during startup/run | 437.4 MiB | 405.4 MiB |
| Native tray, no webview | — | 18.0 MiB |

This is approximately 55% less resident working set over the full window sample and 80% less after settling. Private committed memory changed much less: 254.5→239.7MiB over the whole sample. The policy releases/paginates resident browser memory; it is not a proportional reduction in committed allocation. Working-set sums can count shared runtime pages more than once, so both counters are retained in [machine-readable results](desktop-memory-results.json).

The window sample took 71.6seconds; tray took 69.0seconds including inventory overhead. Corrected CPU measurements were 0.083% window and 0.0014% tray (normalized across 16processors, first sample excluded). The original baseline CPU reading is invalid and is not compared. The tray run created no webviews and showed no changed app-data file timestamps/sizes. Window startup created/changed 210 cache/profile files.

The 250MiB working-set target is met in the sampled idle/unfocused scenario. **Startup/active-use peaks remain above it**, and continuous interaction plus native input recovery latency has not been measured. Cache/page-in work can occur when returning to normal mode. A second earlier release probe also measured 193.2MiB overall and 98.2MiB after 30seconds, supporting the repeatability of the idle reduction without claiming a universal bound.

Local installer: 3,134,221bytes /2.99MiB, unsigned preview. SHA-256: `8a3fec0226d8e4e33f81e8c2e1ae8831b77535d4a40b0d8b304b357cb6bb6306`. Native/source code is committed; local package data uses the existing workspace revision `40f40f8e04e3c89d40ba605710a0c1662f5d808a9bc4ad4df3d3d54744a898e9`. Clean CI uses tracked data and publishes its own checksum.

Validation: 881frontend tests / 55 files, 102 Rust tests, fmt/Clippy, corrected PowerShell metric regression, production website build with no native code, final release/NSIS packaging and resource/hash validation passed. Focused code review found no actionable issues. The website main JS remains `index-BXD7MCu0.js` (same 741.14kB), so this change does not alter the standalone website's runtime bundle.

## Verification and reproduction

The memory-controller regressions cover idle transitions, continuous interaction without repeated IPC, blur/focus, background pointer events, listener/timer cleanup, unsupported runtimes, ongoing damage searches and accessible input. The CPU regression verifies fractional deltas, counter resets, normalization and zero-interval rejection. The earlier zero-CPU measurements were invalid because an integer overload rounded their deltas; memory figures were unaffected.

Build and measure from PowerShell 7.4+:

```powershell
npm run desktop:build
./scripts/desktop/test-metrics.ps1
./scripts/desktop/measure.ps1 -Mode Window -Seconds 60 -Output output/desktop-memory/final
./scripts/desktop/measure.ps1 -Mode Tray -Seconds 60 -Output output/desktop-memory/final
```

The measurement script isolates app data, rejects an existing startup registration, captures owned-process working sets/private bytes and records sanitized successful native memory-target requests. It never writes browser arguments into global settings. Runtime profiles are not shared with ordinary user data. `Seconds` is the sample count; process inventory adds overhead. Native first-run/interactive behavior, League imports and UI-ready timings remain outside this automated check.

Direct `webview2-com` and `windows-core` dependencies reuse Tauri's already-locked versions; keep these versions aligned when upgrading Tauri. There is no additional native runtime or service.
