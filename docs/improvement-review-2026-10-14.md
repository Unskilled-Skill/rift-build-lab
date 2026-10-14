# Rift Build Lab improvement review

Reviewed the deployed GitHub Pages application on October 14, 2026, alongside the current source. Scope: build discovery, Cassiopeia modeled testing, AD Blitzcrank manual testing, provider comparison, reload recovery, and the 390 × 844 mobile layout. No application behavior was changed.

## Main finding

The app has a substantial research library, but the user's core question—whether an unusual build actually improves a chosen ability or playstyle—still requires too much manual work. Prioritize comparable experiments and trustworthy mechanics before expanding the number of proposals.

## Priorities

| Priority | Improvement | Verified evidence | Recommended change |
|---|---|---|---|
| P1 | Expand numerical ability coverage | `src/App.tsx` and `src/engine.ts` support only Cassiopeia and Sett. Loading AD Power Fist ceiling on the live site produces a manual test sheet without an E damage calculation. | Add individually verified adapters, starting with Blitzcrank E and Tahm Kench. Define proc, crit, on-hit and Spellblade behavior explicitly; test against independently derived examples and game observations. Never infer proc rules solely from a tooltip's scaling. |
| P1 | Expose source conflicts on build cards | Cassiopeia interaction explanations call boots source-conflict dependent. The ceiling proposal says she cannot buy boots, while the main builds equip boots. This review establishes an internal conflict, not which rule is correct in the live game. | Attach mechanic confidence and conflicting sources to each affected proposal. Surface a warning next to the relevant item or ability; validate current live behavior before ranking a dependent build. |
| P1 | Improve optimizer coverage and explain omitted effects before comparing | The optimizer has 17 candidates, fixed runes, and omitted effects including Shojin amplification, item procs, and most rune effects. The authored Cassiopeia build contains Seraph's Embrace, which is absent from the candidate pool. | Separate item availability from effect support. Extend verified effects and candidate coverage together. Display objective-specific coverage beside the estimate and any comparison. Keep unsupported interactions as manual hypotheses. |
| P1 | Make provider freshness distinct from formula freshness | Provider references refresh daily, but `src/App.tsx` Data & coverage says “This app does not update automatically.” The static formulas and authored proposals retain their snapshot patch. | Show separate dates and patches for champion/item/rune formulas, provider references and authored hypotheses. Define a patch upgrade process with validation and invalidate affected proposals when mechanics change. Daily provider refresh alone must not imply refreshed calculations. |
| P2 | Compare an experiment with a baseline | `src/ProviderReferences.tsx` displays observed cores and runes, but has no load action. Existing pin comparison holds only item IDs and recomputes both item sets using the current scenario and rune page. | Add “Use as baseline” for provider cores, retaining role, provider and sample metadata. Compare identical conditions and budgets, showing damage, resource use, durability and cost where modeled. Keep observed cores distinct from inferred six-item completions. Allow rune differences only when modeled or explicitly labeled manual. |
| P2 | Preserve the active workspace automatically | Reloading after loading AD Blitzcrank returns to Cassiopeia Builds. Explicit notebook saves exist, and feedback drafts use session storage, but the active champion/setup/build is not restored automatically. | Persist a versioned working draft, including champion, section, equipped items, conditions, active proposal and feedback association. Restore only validated state and preserve rejected data for recovery. Add a clear reset action. |
| P2 | Replace the oversized item dropdown | The live bench item picker mixes components, consumables and duplicated item names/variant IDs. `src/TestSetup.tsx` filters only source shop/map flags and equipped IDs; champion and family conflicts are checked after selection. | Use a searchable picker with item categories, completed-item defaults and effect support labels. Explain unavailable/conflicting entries before selection. Audit game-mode and upgrade availability instead of treating map flags as sufficient proof of normal purchase eligibility. |
| P2 | Turn feedback into comparable evidence | `src/BuildLibrary.tsx` records one optional measured number, outcome, observations and scenario. There is no structured repeated-trial or paired-baseline analysis. | Record trial count, ability/sequence, proc readiness and target state. Show baseline versus experiment results and variability across repeated runs. Keep damage, healing, shields and execute thresholds distinct. Preserve the complete setup used for each observation. |
| P2 | Make manual ability objectives explicit | `ManualTestSetup` has a generic “Main ability rank” field without a slot/form selector; ranks and forms otherwise go in notes. | Select the target ability and form, use its actual max rank, and expose relevant conditions such as stacks, charge, target missing HP or attack count. Allow a combo objective rather than forcing all experiments into one generic rank. |
| P2 | Bring builds into the first mobile screen | At 390 × 844, the champion rail, tabs, champion heading and collection explanation occupy the initial screen; the first build appears below it. Several controls are 40px, with smaller dismiss and narrow navigation targets. No page-wide horizontal overflow was observed in this view. | Collapse the champion list into a compact chooser after selection, shorten collection guidance and enlarge small controls toward 44px. Retain accessible labels, focus feedback and intentional horizontal navigation affordances. |
| P2 | Reduce static-site polling | `src/BuildLibrary.tsx` fetches static build JSON every 10 seconds using a cache-busting timestamp and no-store. Provider references separately check every 15 minutes. | Keep rapid inbox polling for local authoring only. On Pages, check on user refresh, tab focus or a modest interval; use a revision manifest and normal caching for immutable files. |

## Suggested first implementation

1. Fix freshness wording and surface source-conflict warnings. These improve trust immediately.
2. Add baseline loading/comparison and automatic working-draft recovery. These make existing content easier to test.
3. Implement Blitzcrank E with verified damage packets and proc rules; then Tahm Kench. Expand the optimizer only as effects become supported.
4. Add structured repeated trials, search-based item selection and the compact mobile champion chooser.

## Technical review

Provisional scores are from a bounded manual review, not a WCAG conformance audit or performance benchmark.

| Dimension | Score | Evidence / limit |
|---|---|---|
| Accessibility | 3/4 | Labeled form controls, semantic buttons, skip link and focus styles exist. Small controls need attention. Full keyboard and contrast testing was not performed. |
| Performance | 2/4 | Worker-based optimization and lazy images exist; unnecessary static build polling is verified. No network-throttled benchmark was run. |
| Responsive design | 2/4 | Mobile stacking works and the reviewed view has no page-wide overflow, but initial screen space and target sizes can improve. This was viewport emulation, not a physical touch-device test. |
| Theming | 3/4 | Coherent charcoal/sage token system; isolated hard-coded state colors remain. |
| Implementation integrity | 2/4 | Clear limitations and data provenance exist, but source-conflict/freshness wording and availability checks need stronger consistency. |
| Total | 12/20 | Significant product improvements remain; no P0 blocker found in the reviewed workflows. |

The Impeccable deterministic scan of `src` returned zero findings. That scan did not detect the product and data-consistency issues listed above. The browser reported no console errors during the reviewed workflows. No detector overlay was injected: the browser evaluation API is read-only. No new local server was started.

## Strengths to retain

- Builds have hypotheses, failure conditions, source context and test plans.
- The UI distinguishes modeled estimates from manual gameplay tests.
- The optimizer runs outside the UI thread and reports the extent of its search.
- Scenario exports, saved-history recovery and feedback undo already support repeatable work.
- Daily provider publication preserves the last successful deployment when refresh fails.

## Design tooling note

Impeccable reported that `.impeccable/design.json` predates edits to `DESIGN.md`. Regenerating that sidecar should preserve the current design specification; it was not changed as part of this review.
