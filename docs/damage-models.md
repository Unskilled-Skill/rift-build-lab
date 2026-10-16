# Reviewed damage objectives

Source snapshot: Riot patch 26.20 / Data Dragon 16.20.1, verified as the latest Data Dragon version on 2026-10-16. The coefficients are reviewed from the bundled CommunityDragon engine spell calculations, not inferred from champion roles or AI build descriptions. `src/ability-sources.json` retains exact source paths, costs and reviewed calculation expressions. Tests fail when those expressions drift from the bundled champion data.

The engine now supports 15 champions. The eleven additional adapters expose 34 objectives:

| Champion | Added objectives | Key assumptions |
| --- | --- | --- |
| Lux | Q, E, R | Single champion hit; no Illumination detonation |
| Veigar | Q, W | Rank-dependent AP ratios; finite earned passive AP entered as Extra AP |
| Malphite | Q, R | AP damage only; armor-dependent W/E are not modeled |
| Ezreal | Q, W, E, R | Q uses total AD; W/E/R use bonus AD. W assumes a separate trigger but excludes its damage and mana. No on-hit or Spellblade procs |
| Gragas | Q uncharged, Q fully matured, W attack, E, R | Mature Q assumes two seconds of prior setup. W includes a noncritical physical delivery attack plus the magic bonus and 7% target max HP |
| Cho'Gath | Q, W, R | R deals champion true damage and scales with bonus HP. Add existing Feast-stack HP explicitly; stacks are not generated |
| Ahri | Q both passes, W three fires, E, R one dash | Q splits magic outward/true return damage. W uses 100% + 40% + 40% against one target. R counts one bolt on that target, not all bolts or recasts |
| Morgana | Q, R | R initial hit at 0s, follow-up at 3s only if the tether is retained and the window reaches 3s |
| Ziggs | Q, W, R center/edge | Rank-dependent Q AP ratio; R edge is 65% of center. No turret execution |
| Amumu | Q, E, R | Explicitly uncursed target; Curse conversion and allied damage are excluded |
| Karthus | Q normal, Q isolated, R | Isolated Q doubles the packet. R requires the three-second channel within the observation window; initial mana is spent even in shorter windows |

Existing Cassiopeia Q/E, Sett W, Blitzcrank E and Tahm Kench Q/W/enemy R remain unchanged. New cast modes use `cast-*` IDs. Older saves with generic manual modes remain readable; they are not silently interpreted as new spells. Selecting a supported objective explicitly changes the working model.

All new models score one cast against one champion. Most assume the selected hit lands at time zero and exclude travel/windup; explicit channel/tether exceptions are listed above. They do not simulate cooldown repeats, attack sequences, hit probability, shields, healing, movement or crowd control. True packets ignore defenses and damage amplification. The existing limited item/rune engine remains shared, and every result reports omitted effects. Observation windows do not automatically turn a single cast into DPS or a combo.

Head-to-head, purchase progression, target-defense sweeps and the curated item search all use these same adapters. Purchase stages keep level/ranks fixed and do not forecast stacks or game time. Full build proposals that require manual testing retain that status until the user explicitly selects a supported partial objective.
