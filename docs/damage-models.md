# Reviewed damage objectives

Source snapshot: Riot patch 26.20 / Data Dragon 16.20.1, verified as the latest Data Dragon version on 2026-10-16. The coefficients are reviewed from the bundled CommunityDragon engine spell calculations, not inferred from champion roles or AI build descriptions. `src/ability-sources.json` retains exact source paths, costs and reviewed calculation expressions. Tests fail when those expressions drift from the bundled champion data.

The engine now supports 42 champions. Beyond the four original models, the reviewed cast adapters expose 104 objectives:

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
| Brand | Q, W, E, R one bounce | No Blaze burn/explosion. W assumes a target that is not Ablaze; R counts one bounce, not the full bounce sequence |
| Vel'Koz | Q, W initial hit, E | No Organic Deconstruction, researched-target conversion or W eruption |
| Xerath | Q, W outer area, E, R first shot | Q charge changes range only. No W center bonus, subsequent R shots or champion-hit ramp |
| Neeko | Q initial hit, E | Conditional Q blooms and passive attacks are excluded |
| Vex | Q, W, E, R initial missile | Unmarked target; no Gloom detonation, R arrival/recast or resets. E AP scaling varies by rank |
| Seraphine | E, R | One wave; no Echo or Notes. Q missing-health damage is not yet supported |
| Karma | Ordinary Q, W initial hit | No Mantra, W tether completion or Renewal healing |
| Nami | Q, W direct offensive first hit, R | No W bounce modifiers, healing, allied triggers or E procs |
| Janna | Q uncharged, Q fully charged | Charged Q assumes three seconds of prior setup. W is not modeled because it also needs Tailwind movement-speed damage |
| LeBlanc | Q initial hit, W, E initial hit | Unmarked target; no Q mark trigger, E tether completion or Mimic |
| Lucian | Q, W | Q uses bonus AD and physical damage; W uses AP and magic damage. No Lightslinger or Vigilance |
| Corki | Q, ordinary R missile | Q is magic with bonus AD/AP; R is physical with bonus AD. No Big One, attack passive or extra missiles |
| Caitlyn | Q first target, E | Q uses rank-dependent total AD; no Q falloff, Headshot or trap exception |
| Ashe | W, R | W counts one arrow and uses bonus AD; R is magic with AP scaling |
| Miss Fortune | Q first target spell packet | Total AD/AP physical packet; no Love Tap, on-hits, bounce or second-target crit |
| Draven | E, R first outward hit | Rank-dependent R bonus AD; no prior-target falloff, return hit or Adoration execute |
| Graves | Q initial hit, W, R direct impact | No Q detonation. W is magic; R counts the direct projectile without adding the cone |
| Quinn | Q, E | Q has rank-dependent bonus AD plus AP, dealt as physical damage; no Harrier attacks |
| Jarvan IV | E, R | E is AP magic; R is bonus AD physical. No Q armor reduction or Martial Cadence |
| Nocturne | Q, R dash | Enter any existing trail AD in Extra AD. Automatic trail generation, Umbra attacks and darkness are excluded |
| Talon | Q ranged leap, W outward, R outward | No melee-Q crit, returning blades, Blade's End bleed or attacks |
| Pantheon | R center landing | Magic landing only; thrown spear, edge reduction and subsequent physical spells are excluded |
| Orianna | Q first target, W, E ball passage, R | Ball already positioned for W/R; no setup casts, Q falloff or passive attacks |
| Diana | Q, W three orbs, E | All W orbs assumed to hit at impact. No Moonlight setup, resets, shields or passive attacks |
| Lissandra | Q, W, E, enemy-target R | No extra hit from Q shattering/E teleport, self-R healing or Iceborn thralls |
| Syndra | Q, unupgraded W, E, R three spheres | No 120-Splinter AP multiplier. W assumes fewer than 60 Splinters. R excludes ground spheres and execute |
| Anivia | Q passage + explosion, E normal, E already Chilled | Both Q packets assumed to land. Empowered E explicitly requires existing Chill and excludes Q/R setup damage and mana |

Existing Cassiopeia Q/E, Sett W, Blitzcrank E and Tahm Kench Q/W/enemy R remain unchanged. New cast modes use `cast-*` IDs. Older saves with generic manual modes remain readable; they are not silently interpreted as new spells. Selecting a supported objective explicitly changes the working model. New champion defaults select their first available adapter, including Seraphine E; an unsupported Q is never selected just because the champion has another modeled spell.

All new models score one cast against one champion. Most assume the selected hit lands at time zero and exclude travel/windup; explicit channel/tether exceptions are listed above. They do not simulate cooldown repeats, attack sequences, hit probability, shields, healing, movement or crowd control. True packets ignore defenses and damage amplification. The existing limited item/rune engine remains shared, and every result reports omitted effects. Observation windows do not automatically turn a single cast into DPS or a combo.

Head-to-head, purchase progression, target-defense sweeps and the curated item search all use these same adapters. Purchase stages keep level/ranks fixed and do not forecast stacks or game time. Full build proposals that require manual testing retain that status until the user explicitly selects a supported partial objective.
