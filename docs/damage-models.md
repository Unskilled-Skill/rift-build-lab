# Reviewed damage objectives

Source snapshot: Riot patch 26.20 / Data Dragon 16.20.1, verified as the latest Data Dragon version on 2026-10-17. The coefficients are reviewed from the bundled CommunityDragon engine spell calculations, not inferred from champion roles or AI build descriptions. `src/ability-sources.json` retains exact source paths, costs and reviewed calculation expressions. Tests fail when those expressions drift from the bundled champion data.

The engine now supports 69 champions. Beyond the four original models, the reviewed cast adapters expose 186 objectives:

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
| Galio | Q projectile, W minimum charge, E | No Q tornado, W charge bonus, MR-dependent R or passive attack |
| Garen | Q noncritical attack | Includes its total AD delivery once; no crit, item on-hits or following attacks |
| Kennen | Q, W already marked, E | Base 200 energy. W requires a pre-existing mark; no mark setup, refunds, fifth-attack passive or stuns |
| Lee Sin | Q initial projectile, E, R primary kick | Base 200 energy. E is magic with total AD scaling; no Q2, Flurry/refunds or secondary kick collision |
| Akali | Q, E first hit, R first vault | Base 200 energy, excluding Shroud bonus capacity. No passive attacks, E2 or R2; R1 is magic |
| Zed | Q one first-target shuriken, E | Base 200 energy. No shadow Qs, pass-through reduction, Death Mark, passive attacks or refunds |
| Shen | E | Base 400 energy; physical damage with bonus HP. Upfront cost is checked before omitted on-hit energy recovery |
| Renekton | Q ordinary/50-Fury, W two/three hits, E first dash | Fury variants explicitly require the meter already prepared and consume 50 Fury. No Fury generation, shield destruction, empowered Dice shred or item on-hits |
| Riven | Q first slash, W | No later Q swings or passive attacks. Existing ultimate bonus AD must be entered explicitly |
| Aatrox | Q first swing ordinary/sweet spot, W initial | Sweet spot is 1.75 times ordinary. No later swings, W pull-back, healing or passive; existing ultimate AD must be entered explicitly |
| Rek'Sai | Q already burrowed, E ordinary/maximum-Fury | Prey Seeker is magic with bonus AD/AP. Current-source empowered bite is 1.2 times ordinary as true damage, requiring maximum Fury already prepared |
| Katarina | Q initial hit, E spell packet | No Q bounce to this target, dagger pickup, item on-hits, attacks, resets or ultimate |
| Nautilus | Q, E one wave, R primary target | No extra E waves, passive attacks or secondary R targets |
| Sejuani | Q, W both swings, E already four Frost stacks, R short-range impact | W is physical with total HP/AP scaling; no Icebreaker or stack setup. W contacts are approximated together |
| Maokai | Q, W, E outside brush, R | E uses bonus HP/AP; no brush damage-over-time, passive healing or repeated vines |
| Sion | Q uncharged/full, W shield detonation, E, R minimum distance | Q charge setup is prior to impact. W needs the shield to survive until 3s and adds 14% enemy max HP; enter earned passive HP explicitly |
| Poppy | Q impact/1s eruption, W dash interception, E no wall, R tap | Q scales with enemy max HP by rank and second hit needs the target to stay. No wall bonus, extra interceptions or charged-R damage |
| Alistar | Q, W | Single magic hits; no Trample, healing or combo follow-up |
| Leona | Q noncritical attack, W explosion at 3s, E, R | Q splits physical delivery/magic bonus; no allied Sunlight trigger or item on-hits |
| Braum | Q, R | Q scales with own total HP; no Concussive Blows, attacks or stun |
| Nunu & Willump | Q champion bite, E one snowball, R full channel | Q uses bonus HP/AP and magic damage. R must finish its 3s channel inside the window; E excludes remaining projectiles and root |
| Volibear | Q noncritical attack, W first/marked, E, R center | W2 multiplier varies with bonus AD and requires an existing mark. E includes enemy max HP; R is physical despite AP scaling. Automatic R bonus HP/conversions are excluded |
| Warwick | Q champion spell packet | Total AD/AP plus rank-dependent enemy max HP as magic; no passive/on-hit packets, healing or monster cap |
| Xin Zhao | Q first attack, W slash, E, R | No W thrust/crit, passive attacks or free challenge setup. R adds 15% enemy current HP from the supplied starting percentage |
| Vi | Q minimum/full charge, E noncritical attack, R | Maximum Q is 2.5 times minimum. No Denting Blows armor reduction/third-hit damage, on-hits or extra E charges |
| Fizz | Q, E, R small/big shark | Q splits physical delivery/magic bonus. Sharks explode at 2s after an assumed 0s attachment; big shark requires maximum-distance attachment |
| Fiddlesticks | Q ordinary, E | Q uses enemy current HP with rank-dependent minimum damage, assuming the target was not recently feared. No recent-fear doubling or passive setup |

Existing Cassiopeia Q/E, Sett W, Blitzcrank E and Tahm Kench Q/W/enemy R remain unchanged. New cast modes use `cast-*` IDs. Older saves with generic manual modes remain readable; they are not silently interpreted as new spells. Selecting a supported objective explicitly changes the working model. New champion defaults select their first available adapter, including Seraphine E; an unsupported Q is never selected just because the champion has another modeled spell.

All new models score one cast against one champion. Most assume the selected hit lands at time zero and exclude travel/windup; explicit channel/tether exceptions are listed above. They do not simulate cooldown repeats, attack sequences, hit probability, shields, healing, movement or crowd control. True packets ignore defenses and damage amplification. The existing limited item/rune engine remains shared, and every result reports omitted effects. Observation windows do not automatically turn a single cast into DPS or a combo.

Head-to-head, purchase progression, target-defense sweeps and the curated item search all use these same adapters. Purchase stages keep level/ranks fixed and do not forecast stacks or game time. Full build proposals that require manual testing retain that status until the user explicitly selects a supported partial objective.

## Mana, energy and abilities without a mana/energy cost

The generic cast adapters now distinguish mana, energy and no mana/energy budget. Energy caps are reviewed from the same Data Dragon snapshot: 200 for Kennen, Lee Sin, Akali and Zed; 400 for Shen. Available energy reuses the portable scenario's existing resource input, with an energy-specific label and cap. Mana items and Rod stacks cannot raise energy or create mana-to-AD conversion on these champions. Mana statistics remain zero for the newly supported non-mana champions.

Energy costs are paid upfront. Refunds, regeneration and temporary capacity changes (including Akali Shroud) are excluded. Zero-cost abilities such as Lee Sin R and Akali R can still hit at zero energy. The result carries a resource kind, maximum and spent amount; the existing manaSpent field remains actual mana spending. Damage events and comparisons display the correct resource.

For Garen, Riven, Aatrox and Katarina, these selected casts have no mana/energy cost. Renekton and Rek'Sai variants keep Fury prerequisites explicit in the selected objective; the engine does not generate or advance a Fury meter. Selecting an empowered variant asserts the required Fury is already present, and its notes explain consumption/setup exclusions. These are still single-cast comparisons.

## Current target health and delayed impacts

Xin Zhao R and Fiddlesticks Q expose **Target starting HP (%)**. Their current-health term uses target maximum HP multiplied by that percentage; it remains the same condition for both builds and across purchase stages. The comparison context displays the percentage, and saves retain it. These are raw damage estimates, not kill predictions; Fiddlesticks Q also applies its exported rank-dependent damage floor.

Poppy Q emits its second packet only at a window of at least 1s, assuming the champion remains in the eruption. Sion W, Leona W and fully channeled Nunu R need 3s; Fizz R needs 2s after an assumed attachment. These casts still pay initial mana in a shorter window. Fully charged Sion/Vi Q objectives instead score an impact after prior charge setup, as their labels/notes state. Selected non-formula values (target-health ratios, timing and minimum damage) are now retained alongside formula expressions and checked against the bundled engine spell data.
