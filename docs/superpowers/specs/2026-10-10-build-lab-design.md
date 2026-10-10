# Build Lab: champion playstyles, experiments, and damage optimization

Date: 10 October 2026  
Data snapshot: League of Legends patch 26.20 / Data Dragon 16.20.1

## Purpose and approved direction

The user wants to discover builds they would struggle to reason through manually: select a champion, an ability or combo, and a situation; find items and runes that improve the chosen outcome; understand why those choices work. Examples are Cassiopeia Q followed by poisoned E casts, and Sett W's balance between health, bonus AD, and available Grit.

The user approved a browser app with scenario controls, legal build search, transparent damage breakdowns, and comparisons. They then expanded the request to include analysis of every champion's likely playstyle, and AI-generated off-meta, fun, or unusual playstyle hypotheses grounded in the kit.

Success means a user can both explore an interesting hypothesis and inspect the evidence for it. High theoretical damage is not synonymous with a good build, nor proof of an undiscovered strategy.

## Delivery scope

The first working release includes three connected surfaces:

1. **Champion library:** all 173 champions, their collected abilities and stats, a kit-based playstyle interpretation, and at least one experimental item core with a proposed test and failure conditions.
2. **Scenario calculator and optimizer:** validated Cassiopeia Q/E and Sett W models. Other champions remain browseable, with calculation coverage explicit rather than fabricated.
3. **Build experiments:** compare candidates, lock or exclude items, inspect rune and item effects, save scenarios and hypothesis notes, and export a shareable experiment record.

The full item and rune catalogs are browseable. Automatic search uses a reviewed Summoner's Rift item roster and effects the evaluator actually supports. The source's map and shop flags are not sufficient proof of obtainability. Unsupported item effects are visible; a build containing one cannot receive a complete-effect damage claim.

Full numerical support for the remaining champions is a continuing coverage expansion, not something achieved by generically evaluating every raw tooltip tree. Alternate forms, pets, basic attacks, conditional damage, and on-hit eligibility require champion-specific adapters.

## Product flow

### Champion library and playstyle interpretation

A searchable champion picker opens the kit, base/growth stats, and an interpretation of the opportunities created by the kit. A profile states:

- Likely game plan: preferred fight range, duration, damage pattern, and setup.
- Evidence: specific passive or ability mechanics that support that reading.
- Strengths and constraints: resource consumption, access to targets, hit reliability, cooldown exposure, and dependence on enemy behavior.
- A plausible alternative: a three-item core and legal keystone suggestion, clearly labeled as a hypothesis or fun experiment.
- A measurable test and two failure conditions.

"Intended playstyle" is an inference from current kit data. It must not be presented as an authoritative statement of Riot's design intent. An unusual idea is not called novel-to-the-world, meta, viable, or OP without evidence appropriate to that claim. The shipped research catalog supplies initial AI-authored hypotheses for every champion.

### Scenario builder

The user selects ability or combo, level, ability ranks, target health/current health, armor, magic resistance, and time horizon. All extra state needed by a supported model appears as a user control rather than being silently assumed.

Cassiopeia presets:

- Q's full poison damage, or damage within the selected time horizon.
- Q followed by one poisoned E.
- Q/E sequence over a selected duration, respecting poison uptime, cast timing, cooldowns, and mana.
- Separate contribution totals for Q, E, triggered items, and triggered runes.

Sett presets:

- W center hit (true damage) versus edge hit (physical damage).
- Available Grit as an absolute amount or a fraction of the current cap; maximum-Grit results explicitly require receiving sufficient damage and casting before decay.
- Health/bonus-AD tradeoff with a fixed number of item slots or gold budget.
- Setup costs and survivability requirements alongside the theoretical W value.

Rune controls include a legal primary tree, primary slots, secondary tree and two distinct secondary rows, and three shard rows. Rune stacks, combat readiness, takedown-dependent effects, and time-scaling effects require explicit scenario state. The app does not allow independently selecting every powerful rune at once.

### Search and results

Inputs include item-slot count, gold budget, locked and excluded items, readiness/stacks, and whether temporary effects are enabled. Item legality includes duplicates, mutually exclusive families, transformations, champion restrictions, and any current boot restrictions actually supported by current-patch evidence.

Return the strongest candidates examined, with:

- Damage after defenses and an event/contribution breakdown.
- Final stats, total gold, trigger prerequisites, and effect coverage.
- Search method, explored count, candidate pool, and termination reason.
- Comparisons against the current build and a chosen reference build.
- Tradeoffs in health, mana, haste, range access, and reliance on ideal conditions.

Results say **best found** for a limited search. **Optimal within the stated supported candidate pool** is allowed only when every feasible combination was checked or a sound complete search proved the result. Even a proven result remains conditional on the model and scenario.

## AI-assisted discovery

Use three steps:

1. **Generate:** read kit traits, reviewed item effects, rune triggers, and the user's objective; propose alternative play patterns and item cores.
2. **Challenge:** identify assumptions, mismatched scaling, inaccessible triggers, resource problems, and opportunity costs. Explain why a superficially attractive candidate might fail.
3. **Test:** pass compatible candidates to the deterministic calculator; compare with a reference under identical conditions and suggest in-game checks for behavior outside the model.

The first release includes the generated 173-champion research catalog without requiring an API key. On-demand model generation is a separate integration activated only when a model provider is configured. Until then, the app can select and adapt saved experiments using deterministic controls, but must not pretend it made a new live AI request.

Any future model output uses a validated schema: champion ID, objective, item IDs, rune page, assumptions, rationale, test scenario, failure conditions, and evidence references. The model cannot supply the authoritative final damage number. The calculator owns numerical results. Unknown IDs or impossible triggers produce a rejected or incomplete candidate.

Exploration should vary objectives: one hit, short burst, sustained damage, damage per gold, durability while dealing damage, and ability uptime. Only objectives supported by the current evaluator receive numbers. Other objectives can be research hypotheses with explicit coverage limits.

## Architecture

### Data and evidence

Keep versioned raw exports unchanged. Add a small, normalized application bundle containing champion summaries, item/rune browsing records, playstyle profiles, and reviewed calculation definitions. Large engine exports remain research/reference files rather than being sent to the browser on startup.

Every calculation definition stores patch, source record path, interpreted formula, supported conditions, and verification cases. Every item/rune effect has an explicit coverage state: implemented, stat-only, irrelevant to this scenario, unsupported, or contradictory. Missing source values never default to zero without a stated schema rule.

There are known contradictions and incomplete helpers in the collected data. For example, Sett W's `MaxDamage` helper uses a different coefficient from its `DamageConversion` calculation. Resolve the playable formula with corroborating current evidence before shipping the model; retain the contradiction and explain which source was used. The raw export's existence does not validate its semantics.

### Calculator

A pure TypeScript engine receives a fully specified scenario and returns stats, event records, contribution totals, and warnings. It owns stat growth, base versus bonus stats, damage types, resistance and penetration order, conditional effects, and timers. Champion adapters produce damage events; supported item and rune adapters react only to eligible events.

True damage and damage-over-time interactions are not assumed to behave like ordinary magic or physical damage. Each amplifier and trigger must encode its actual eligibility. A Q tick cannot trigger a single-cast effect seven times unless the effect permits it.

The calculator and a slow reference enumerator remain independent of the interface. Unsupported runtime state or unresolved formulas prevent complete numerical certification.

### Optimizer

Run search in a browser worker so the interface remains responsive. A deterministic heuristic search with a configurable evaluation limit supplies useful initial candidates; improvements come from legal item/rune swaps and comparison of alternative archetypes. Show search progress, allow cancellation, and reproduce a run from its saved parameters.

Use exhaustive enumeration for small validated pools and testing. Pruning based on monotonicity is permitted only when the relevant effect model proves it sound. Conditional passives and stat-conversion interactions can invalidate naive pruning.

### Interface and persistence

A React/TypeScript browser app has champion selection and experiment selection on the left, scenario controls in the working area, and ranked builds plus explanations beside them. A stat/damage comparison view shows how an item swap changes the outcome. All controls are keyboard accessible and work at narrower widths.

Use local browser storage for saved scenarios, named experiments, and pinned builds. JSON export/import supports sharing and backup. No account or paid service is required for the first release. Local preview is the first delivery; hosting can be added once the functional result is reviewed.

## Testing and acceptance

The first release is ready for review when:

- All 173 source-roster champions have an evidence-linked playstyle profile and an explicitly unvalidated experimental core.
- All profile references resolve to collected item/rune IDs; no illegal keystone is suggested, and core items contain no duplicates or known conflicting families.
- Cassiopeia Q poison timing and poisoned/unpoisoned E damage have hand-checked numerical fixtures, including resource-limited sequences.
- Sett W has hand-checked fixtures for Grit cap, bonus AD, center/edge damage, and grit-limited cases. The source contradiction is resolved before those results are certified.
- Stat conversions and supported item/rune procs have boundary tests and do not trigger on ineligible events.
- The optimizer matches an independent exhaustive reference search on small candidate pools, respects legality and budget, and never mislabels heuristic results as proven optimal.
- Changing enemy defenses, Grit, poison availability, or time horizon produces explainable differences. UI results include incomplete-effect flags where necessary.
- Cancellation, saving/loading, comparison, JSON import/export, and basic responsive/keyboard flows work.

Numerical tests must check behavior and independently calculated cases rather than reproducing the implementation line by line. In-game spot checks are desirable for engine behaviors the exported data cannot establish; unavailable checks are recorded as coverage limits.

## Implementation boundary and next review

This file is a design artifact, not a claim that the app has been implemented. The playstyle catalog is research that can be reviewed now. After the user reviews this written spec, create a concrete implementation plan and obtain the execution choice required by the brainstorming/planning workflow before scaffolding or writing product code.
