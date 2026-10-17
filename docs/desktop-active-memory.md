# Active-use allocation and catalog improvements

Follow-up: [deferred content, analysis chunks and Normal-policy measurements](desktop-deferred-memory.md).

This pass targets calculation churn and the amount of card UI mounted while browsing. It does **not** establish a lower total active WebView2 working set or solve the reported 405 MB footprint. The earlier [idle-memory result](desktop-memory-optimization.md) must not be presented as an active-use result.

## Changes

- Damage stat lookups accumulate directly in source order, avoiding a flattened and filtered array per stat lookup.
- Build legality checks scan the small inventory directly, avoiding temporary sets, mapped arrays and one filtered array per item family. Duplicate, source-shop, earned-upgrade, champion, budget, slot, boots and family restrictions are preserved.
- Desktop Items and Runes catalogs mount at most 32 cards. Previous/Next and a labeled page selector reach every result. Search and filters still run over the entire collection and reset pagination. Changing pages unmounts the previous cards. Full-source Items previously mounted 870 cards; Runes mounted 69, including closed formula disclosures.

The website keeps its existing catalog presentation and benefits from the shared pure calculator optimization. It remains independently deployable without native IPC or a desktop dependency. The production bundle guard now also rejects the desktop pagination marker. League imports, signed updates, data revisions and idle memory behavior are untouched.

## Evidence and limits

Release-source baseline: `10a4059`. Node v24.19.0, Windows x64, same local catalog. The benchmark runs 100,000 candidate evaluations each for Cassiopeia, Sett, Blitzcrank and Jhin, retaining the same top 12 results. Three interleaved fresh-process baseline/updated pairs produced identical complete ranked results, including events, stats, costs, notes and search completeness flags.

| Metric | Before | Updated |
|---|---:|---:|
| Median elapsed time for 400,000 evaluations | 4.708 s | 1.755 s |
| Allocated bytes between reported GC events, separate traced run | 6,563 MiB | 2,721 MiB |
| GC events in traced run | 823 | 343 |
| Sampled peak V8 heap in timing runs | 32.49 MiB | 32.00–32.25 MiB |
| Process maximum RSS in timing runs | 87.41–87.89 MiB | 87.02–87.31 MiB |

That is approximately 59% less allocation churn and 63% less elapsed time for this workload. **Peak heap and resident memory barely changed.** Allocated-byte totals measure repeated short-lived allocations, not simultaneous RAM consumption. Trace output can interleave and excludes the final interval after the last collection, so these are approximate churn totals. Node is not the desktop WebView2 runtime; these numbers must not be advertised as a 59% reduction in desktop RAM.

The catalog change bounds live cards rather than repeatedly loading a whole collection into the render tree. Its effect on native working set during a complete interactive workflow has not been measured. WebView2 browser/GPU/utility processes remain the largest known component of the open-window footprint. Unsupported browser flags and permanent low-memory mode during interaction were not introduced. Microsoft [advises against shipping browser flags](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/webview-features-flags).

Machine-readable measurements: [desktop-active-memory-results.json](desktop-active-memory-results.json).

## Verification

887 frontend tests pass. A 3,000-case differential legality test uses the previous rules as an independent oracle; existing champion, conversion and search fixtures also pass. Catalog tests cover bounded mounting, complete page coverage, last-page boundaries and clamping after filtering. The website boundary regression was observed failing before the guard was extended, then passing. Production website and desktop builds pass; the Windows NSIS installer and its resource hashes were validated.

A browser preview using the actual desktop pagination component and existing theme confirmed Next navigation and whole-collection search from a later page returning to page one. This was a component preview, not native League-client or continuous native-input verification. Focused code review found no actionable issues. The existing website chunk-size warning remains visible.

Local unsigned test installer is under `output/active-memory-release/`, separate from the already-published signed 0.1.1 release. These changes are source/CI changes; they are not a new signed auto-update release.

Reproduce the calculator benchmark without browser flags or forced GC:

```powershell
npx vite build --ssr scripts/desktop/benchmark-calculator.ts --outDir output/calculator-current --emptyOutDir
node output/calculator-current/benchmark-calculator.js > output/calculator-current/run.json
node --trace-gc-nvp output/calculator-current/benchmark-calculator.js > output/calculator-current/gc.log
```

For a paired comparison, bundle the baseline source separately before editing and alternate fresh-process runs. Compare the `runs` arrays exactly; report timing separately from traced allocation totals.

## Next work

The next profiling pass needs a repeatable native interaction sequence, recording working set, private bytes, renderer heap and response time during champion changes, item/rune browsing and searches. Idle/blur cache reclamation must be excluded from active-use claims. Other candidates to evaluate are on-demand analysis-module loading, mounting source-formula tables only when opened, and a bounded champion picker. Their likely savings should be measured against WebView2's runtime cost before expanding scope or changing UI frameworks.
