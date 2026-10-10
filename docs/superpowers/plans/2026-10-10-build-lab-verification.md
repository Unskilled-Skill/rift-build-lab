# Build Lab verification

2026-10-10. App implemented on `codex/build-lab` from the approved design.

- Data preparation: 173 champions, 870 items, 69 rune/shard entries. Champion details load on demand; no complete raw engine payload is shipped on startup.
- Automated checks: 19 Vitest fixtures pass; TypeScript checking and Vite production build pass. Dependency audit: zero reported vulnerabilities.
- Numerical fixtures: nonlinear growth, positive/negative resistance, penetration floors, Cassiopeia Q/E and poison eligibility, mana bounds, actual poison refresh, independently affordable casts, Shojin Q/E haste, Riftmaker ramp integration, Sett Grit cap, Warmog/Bloodmail/Riftmaker/Deathcap ordering, missing effect notes.
- Constraint fixtures: exhaustive tiny-pool reference, locks/exclusions/budget, bounded search status, duplicate and penetration-family checks, versioned import bounds and rune-row validation.
- Browser checks: 12,274 candidate builds searched at the default budget; result selection; save; pinned comparison recalculated under changed MR; Sett center/edge; champion kit browser; item search; Electrocute values; JSON export and re-import; mobile viewport 390×844 with no page-width overflow. Browser captured no errors or warnings.
- Fresh read-only reviewer identified timeline, hidden poison, stale worker and comparison defects. These were fixed; reviewer confirmed numerical corrections and 19 green tests. Final worker cancellation clears its ref synchronously and checks callback identity.
- Mechanical UI detector reported no findings. Desktop/mobile layouts were inspected.

Scope is a first release: two numerical champion adapters; limited item effects; only shards and manually pre-stacked Conqueror stats among runes; precomputed AI hypotheses. Full live-game simulation, live AI generation and exhaustive current-shop legality are not claimed. No in-game Practice Tool verification was available. Source flags, encoded formulas and unresolved values remain visible.

Rulings: native implementation followed the user's direct instruction to make the app. Rank/level controls allow isolated hypothetical scenarios. Engine AD growth overrides inconsistent Data Dragon values. Uniform Q poison approximation is retained and disclosed. Search fixed rune pages rather than claiming a complete rune optimizer.
