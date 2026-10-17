# Desktop performance measurements

Measured 2026-10-17 against the release executable from native/session commit `de44ec8`, version 0.1.0. This is a preview measurement, not a guarantee for other machines or a completed performance sign-off.

Machine: Intel Core i5-12600K, 16 logical processors; Windows build 10.0.26200; WebView2 155.0.4283.60. Installer 3,130,280 bytes / 2.99 MiB, excluding system WebView2. Automatic imports off; League closed. Native preferences and WebView2 data are isolated under `output/desktop-performance` for the final measurement runs.

| Mode | Average native working set | Average WebView2 working set | Combined private bytes | Average CPU |
|---|---:|---:|---:|---:|
| Native tray, no webview | 17.9 MiB | 0 MiB | 5.8 MiB | 0.00% observed |
| Window, fresh WebView2 profile | 31.1 MiB | 391.4 MiB | 238.4 MiB | 0.00% observed |

The final tray run reused its isolated native data directory; the final window run used a new explicit WebView2 profile in an existing isolated native directory. These are not cold-versus-warm UI timing comparisons. The final tray run collected 60 samples across 66.9 seconds, with no changed app-data file timestamps/sizes during the sample. The initial tray run averaged 21.4 MiB native working set. The window run collected 60 samples across 68.4 seconds, including process-inventory overhead. Six owned WebView2 processes were observed. Process creation was first sampled at 1.27 seconds; this **is not UI-ready timing**. Zero observed CPU means no measurable processor-time increase after the first sample at this resolution; startup CPU is excluded, and it is not a promise of literally zero work.

## Target assessment

- Installer below 30 MiB: met locally, with system WebView2 excluded.
- Native background working set below 80 MiB and idle CPU below 0.5%: met with League closed and imports disabled. No WebView2 descendants were observed in tray mode.
- Open-window combined working set below 250 MiB: **missed** at approximately 422.5 MiB. The initial run also measured approximately 423.2 MiB. The isolated-profile rerun confirms this is not explained away by another app's renderer. Summed working sets can count shared runtime pages more than once; combined private bytes were approximately 238.4 MiB, which is a different metric and does not turn the working-set target into a pass.
- Cached UI-ready below 3 seconds: not measured.
- League-in-lobby/background behavior, cold-versus-warm UI-ready timings and resource use during live imports: not measured.

The implemented low-footprint behavior is destruction of the webview when closing to the opt-in tray. The open-window target still needs profiling of rendering, image decode/cache and WebView2 processes. Do not disable rendering/security features or change the metric merely to claim a pass. Native UI interaction is unavailable in this session, so this run does not prove tray close/reopen after editing or a fully exercised interactive build workflow.

## Reproduction and limitations

From PowerShell 7.4+ at the repository root, close other Rift Build Lab instances and turn off its Windows-startup option in its own settings, build release, then run:

```powershell
npm run desktop:build
./scripts/desktop/check-artifacts.ps1
./scripts/desktop/measure.ps1 -Mode Tray -Seconds 60
./scripts/desktop/measure.ps1 -Mode Window -Seconds 60
```

`Seconds` selects the sample count with a one-second minimum interval; CIM inventory adds overhead, so the report records elapsed duration. Measurements use only the owned app process and its descendant tree, separate native/WebView2 working sets and combined private memory, and compare file timestamps/sizes before/after the run. WebView2's documented `WEBVIEW2_USER_DATA_FOLDER` override isolates browser storage as well as native `%APPDATA%`/`%LOCALAPPDATA%`; see [Microsoft's environment options](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/webview2-idl).

Raw measurements are local ignored `output/desktop-performance/{Tray,Window}/measurement.json`. The fresh window run created/changed 207 WebView2 cache/profile files; this is not a claim of zero idle writes. A separate 10-sample fresh-directory smoke check wrote 812 native staging files during the startup data-update check; background mode is not disk-silent while downloading a new revision. File timestamp comparisons do not measure write volume or attribute individual writes. The script refuses to run if an existing app startup registration could be changed by the isolated startup-off profile. It stops only the process it launched and never edits the user's ordinary app preferences. Reusing a mode's output folder produces a reused-profile run; choose a new `-Output` folder for a genuinely fresh profile. No elevated privileges, credential reads, remote debugging or browser-security bypasses are needed.
