# Reviewed damage objectives

Source snapshot: Riot patch 26.20 / Data Dragon 16.20.1, verified as the latest Data Dragon version on 2026-10-17. The coefficients are reviewed from the bundled CommunityDragon engine spell calculations, not inferred from champion roles or AI build descriptions. `src/ability-sources.json` retains exact source paths, costs and reviewed calculation expressions. Tests fail when those expressions drift from the bundled champion data.

The engine now supports 149 champions. Beyond the four original models, the reviewed cast adapters expose 409 objectives:

| Champion | Added objectives | Key assumptions |
| --- | --- | --- |
| Senna | Q, W, R central hit | Physical bonus AD scaling; R also uses AP. Earned soul AD must be entered in Extra AD. No extraction, on-hits, healing or shielding |
| Skarner | Q boulder throw, W, E wall pin, R | Q adds 11% enemy max HP and own bonus HP; E uses own total HP. No passive, prior Q attacks or automatic Q throw with R |
| Rumble | Q ordinary/prepared Danger Zone, R trail | Q has enemy max HP scaling and a finite three-second cone; Danger Zone scales both components by 1.5. R is a finite 4.5-second trail. Heat setup and E shred excluded |
| Zoe | W one prepared missile, E initial hit | W assumes a legal prior trigger. No other missiles, trigger spell, passive attack, sleep MR reduction or wake-up damage |
| Darius | R with zero to five existing bleed stacks | True damage; each prepared stack adds 20%. No setup attacks, bleed ticks, resets or automatic Noxian Might AD; enter active bonus AD explicitly |
| Akshan | Q one/both passes | No Dirty Fighting proc; both impact times approximated together |
| Aurelion Sol | E field, R ordinary/prepared upgraded center | E uniformly prorated over five seconds without execute/Stardust generation. Upgraded R center multiplies by 1.25; no shockwave |
| Azir | Q, E, R | Q/E assume a previously placed soldier; summon cost, soldier attacks and extra soldier hits excluded |
| Bel'Veth | Q one dash, W, R prepared Coral explosion | R adds 20% enemy missing HP as true damage. No Coral setup, Lavender attacks or transformation HP/conversions |
| Gnar | Mini Q, W ready third attack, E bounce | W separates noncritical physical attack and magic Hyper proc; E uses total HP. No Mega-form stats or transformation |
| Gwen | Q zero/four prepared stacks, outer area | One/five small snips plus final snip; all magic outside center. No center true conversion or A Thousand Cuts |
| Jayce | Hammer Q, W field, E | All six ranks. W prorated over four seconds; E adds rank-dependent enemy max HP to bonus AD magic damage. No cannon/transform attacks |
| Kayn | Base Q both hits, W, R; Rhaast R | Rhaast R replaces base flat packet with enemy max-HP scaling. No setup damage, Shadow Assassin bonus or healing |
| Locke | Q one nail, E arrival, R initial | No nail consumption, Silver Stake on-hit, seal/execute or earned execution stacks |
| Master Yi | Q one/isolated four hits, E one attack | Q noncritical, with later isolated hits at 25%. E separates physical attack and true bonus; no Double Strike or item on-hits |
| Mel | Q first/all explosions, E initial, R with prepared Overwhelm | R needs existing stacks, scores active damage only; no passive execute, auto-generated stacks or E area damage |
| Shyvana | W detonation, E human/one Dragon pulse, R | Human E includes 5% max HP; Dragon pulse multiplies packet by 1.25. Form/Fury prerequisites assumed ready, with no trail, transformation HP or item conversions |
| Smolder | W initial, R outer/center | R center multiplies physical AD/AP packet by 1.5. No Dragon Practice, W explosion or healing |
| Twitch | E with prepared Venom | One to six existing stacks; physical base/bonus AD packet and magic AP packet use separate defenses. No poison true damage, stack setup or R AD |
| Urgot | Q, W one shot, E, R initial drill | No Echoing Flames, on-hits, repeated W shots, shields or R execute |
| Viego | W | Charge affects stun duration; no Q passive/mark attacks, possession or item on-hits |
| Wukong | E, R one cast | R uniformly prorated over two seconds, using total AD and enemy maximum HP. No clone, second R or Q armor reduction |
| Yunara | Q prepared noncritical attack, W initial | Q includes physical delivery plus passive and active magic on-hits; requires eight prior Unleash. No critical passive, spread, R upgrade or W lingering damage |
| Yuumi | Q ordinary/accelerated, R one wave | All six Q ranks; no attached ally on-hit, other R waves, healing/shields or channel timing |
| Zeri | W without terrain, R initial nova | W is physical AP/total AD; R is magic AP/bonus AD. No wall critical strike, excess-AS AD conversion or Overcharge shots |
| Camille | Q first/prepared second attack, W inner/outer, E collision | Noncritical Q2 converts 40% + 4% per level after level one, capped at 100%, to true damage; no Q1 setup damage or Spellblade. Outer W includes enemy max HP |
| Fiora | Q without Vital, W | No Vital true damage or item on-hits; W is the stab impact after prior parry preparation |
| Gangplank | Noncritical Q, R one wave | Q includes total AD once. R counts one ordinary wave and charges initial R mana; no barrels, other waves or upgrades |
| Illaoi | W attack, R initial | W includes total-AD-dependent enemy maximum HP; no tentacle slams or spirit transfer |
| Irelia | Q, W minimum/maximum damage, E, R initial | Q assumes passive not fully stacked. Charged W scores a prepared release; no on-hits, cage crossing or marks/resets |
| Kai'Sa | Q one missile/six isolated/twelve evolved isolated, W | First missile full damage; additional missiles at 25%. Evolution already earned for twelve-missile objective; no Plasma detonations |
| Kalista | Q, E with prepared spears | Rend requires at least one existing spear, with a source cap of 254. No setup attacks, refunds, resets or Oathsworn proc |
| Kled | Mounted Q initial/retained tether, E, R minimum/maximum distance | Yank at 1.75s deals twice initial Q. R uses enemy maximum HP and magic damage. No Courage/remounting or Skaarl health-pool simulation |
| Naafiri | Q first cast/bleed, E both slashes, R own dash | Five-second bleed uniformly prorated; no Q recast/cashout, W bonus AD or Packmate damage |
| Qiyana | Ordinary Q, E, R terrain explosion | Royal Privilege unavailable; no passive proc, elemental Q bonus or W on-hit |
| Samira | Ranged noncritical Q, W both slashes, E | W second slash at 0.75s. No melee passive, Style generation or critical damage |
| Trundle | Q pre-steal attack | Uses total AD before this hit steals AD; no free stolen AD on the same hit, item on-hits or later attacks |
| Varus | Q minimum/maximum charge, E, R initial | First target without existing Blight; W inactive. No Blight/W detonations, passthrough reduction or spread |
| Xayah | Q both first-target daggers, R | R dagger wave at 1.5s; no feather recall or Clean Cuts attacks |
| Yorick | Q attack, E | E uses AP-dependent maximum-HP damage. No Mist Walkers, Maiden, E armor-shred follow-up or healing |
| Yasuo | Noncritical Q, E zero/four prepared stacks, R | Four dash stacks double E. R requires airborne target; no setup damage, critical/excess-crit AD conversions or follow-up bonus armor penetration |
| Yone | Noncritical Q, W, R | W and R split physical/magic packets. W uses the champion tooltip and MaxHealthDamage, not the unrelated AD helper. No E repeat or critical-stat conversions |
| Kayle | Q, R sword impact | No resistance-shred follow-up, E attacks or level-based waves. R scores the explosion after prior cast preparation |
| Kog'Maw | Q, W one attack, E, R first-cost shot | W separates physical delivery and AP-dependent max-HP magic. R ramps with missing HP above the threshold and doubles strictly below 40%; no Q shred follow-up or repeated R mana ramp |
| Kindred | Q, W one Wolf bite | W uses explicit earned marks and enemy current HP; no repeat bites, E proc, setup Lamb attacks or mark generation |
| Aurora | Q initial, E, R landing | No Q return/missing-health scaling or passive detonation |
| Bard | Q | One champion hit; no meeps, chime bonuses or attacks |
| Heimerdinger | W one/all five rockets, E | All-five W uses reduced additional rocket damage; no R upgrade or turret attacks |
| Hwei | QQ, EQ, R | QQ includes enemy maximum HP. R uniformly prorates its three-second burn, then detonates at 3s. No passive or WE lights |
| Nasus | Q attack with earned stacks, E field | Enter finite earned Q damage stacks; they are not AD. E includes initial magic hit plus a five-second field; no physical armor-shred follow-up |
| Nidalee | Human Q minimum/maximum distance, human W trap | Maximum spear multiplies by 3.25; trap poison is uniformly prorated over four seconds. No cougar follow-up |
| Sona | Q direct bolt, R | One target; no aura on-hit, Power Chord or allied damage |
| Swain | Q one/all five bolts, W, E return | Five bolts total twice first-bolt damage. W detonates at 1.5s. No souls, healing or ultimate |
| Sylas | Q initial/with explosion, W, E chain | Q explosion at 0.6s assumes target stays in intersection. No Petricite Burst, healing or stolen ultimate |
| Taliyah | Q first/all five rocks, E initial | Additional Q rocks deal 40%, total 2.6 times first hit; all impact times approximated together. No worked-ground boulder or E dash detonations |
| Teemo | Q, E one attack/poison, R triggered mushroom | E separates physical delivery and magic impact/poison, including bonus AD ratios. Poison uniformly prorated over four seconds; no refreshes or item on-hits |
| Thresh | Q, E active, R first wall | No charged Flay attack, earned soul stats or subsequent wall damage |
| Twisted Fate | Q, E ready fourth attack | Q includes bonus AD and AP. E includes noncritical physical delivery plus magic proc, with three prior attacks excluded. No Pick a Card |
| Viktor | Q initial, E initial, R storm | R includes initial burst and at most six discrete one-second ticks. No Q discharge, E aftershock or death-triggered storm extension |
| Singed | E | AP plus enemy maximum HP; no Poison Trail or automatic Insanity Potion stats |
| Shaco | E front hit, R clone-death explosion | E multiplies by 1.5 strictly below 30% starting HP; no Backstab. R excludes clone and mini-box attacks |
| Jax | Q, W attack, R active swing | W separates physical delivery and magic bonus. No R passive third hit, structure modifiers or defensive buffs |
| Jinx | W, E trap, R minimum/maximum travel | W uses total AD. R adds full missing-HP damage at either travel endpoint; no splash or passive takedown buff |
| Tristana | W landing, R | Both include current exported bonus AD/AP ratios; no E bomb triggers or resets |
| Vayne | Q attack, E without/with wall | Q includes physical AP scaling and delivery AD once. E wall totals 250% of initial packet; no Silver Bolts or automatic Final Hour AD |
| Ekko | Q both passes, E attack, R | Q impact times approximated together; E separates noncritical AD delivery from magic bonus. No Z-Drive or W passive |
| Elise | Human Q, human W | Q uses enemy current HP and AP-dependent percentage; no spider form or spiderlings |
| Evelynn | Q first missile, E ordinary/empowered, R | Uncharmed target, no Allure MR shred or Q mark triggers. R multiplies damage by 2.4 strictly below 30% starting HP |
| Ivern | Q, E explosion | E explodes at 2s within the observation window; no Daisy, shield or brush attacks |
| Kassadin | Q, E, R zero/four prior stacks | R scales from maximum mana. Four existing stacks give four damage bonuses and cost 640 mana upfront; setup damage/mana excluded |
| Kha'Zix | Q ordinary/isolated, W, E | Isolated Q multiplies its physical packet by 2.1. No passive attacks, evolution utility or resets |
| Lillia | Q outer edge, W outer/center, E | Q separates magic and true packets; W center triples damage. No passive burn, movement stacks or sleep/wake bonus |
| Lulu | Q one/both bolts, offensive E | Second Q bolt deals 50% damage to the same champion. Pix positioning assumed; no Pix attacks |
| Malzahar | Q, E observed damage | E uniformly prorated over four seconds; Riftmaker ramp integrated over the observed duration. No refreshes, spreading or voidlings |
| Milio | Q | One kick hit; no Fired Up allied triggers |
| Rakan | Q, W, R one contact | No healing, shielding, repeated contacts or following attacks |
| Renata Glasc | Q initial hit, E | No Q recast collision, passive mark, allied damage or shields |
| Soraka | Q, E initial/closing | E closing packet at 1.5s assumes target stays in area; no healing |
| Zilean | Q one bomb | Full three-second fuse within observation window; no Rewind or early double-bomb detonation |
| Zyra | Q, E, R initial damage | No plant attacks or enrage damage; R knockup adds no damage |
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

Elise human Q uses this same starting-HP control. Evelynn R uses it for a strict below-30% damage threshold, without claiming a guaranteed kill. Ivern E, Soraka E and Zilean Q filter their delayed packets by the observation window while paying initial mana. Malzahar E uniformly prorates observed damage over four seconds rather than simulating its exported 0.25s server ticks. Riftmaker amplification is integrated across each combat-time boundary; true damage remains unamplified. Kassadin's four-stack R objective asserts four prior stacks already exist, multiplies the base mana cost by 16, and never awards free setup casts.

Shaco E also uses a strict below-30% threshold, while Jinx R uses missing HP at the supplied starting percentage. Jinx's travel multiplier affects only its flat/bonus AD packet, not the missing-HP term. Hwei R combines a uniformly prorated burn with a delayed final explosion; Viktor R instead uses the exported one-second cadence and six-tick cap. Teemo and Nidalee traps start the scored window when an already armed trap triggers; placement/arming time is excluded, but initial mana is charged. Nasus E assumes the champion remains inside the field.

## Earned ability stacks

Nasus Q exposes **Earned Siphoning Strike stacks**, defaulting to zero for older scenarios. The input is a finite integer from 0 to 1,000,000 and adds directly to Q damage, without increasing AD or other spells. It represents already earned bonus Q damage; stack generation is excluded. The shared comparison conditions display and preserve it across both builds, purchase stages, target sweeps and portable saves. Critical strikes and Spellblade remain outside this noncritical Q estimate.

Kalista E exposes **Existing Rend spears**, defaulting to zero and capped at the engine snapshot's 254. At zero spears it cannot cast: damage and mana spent both remain zero, with an explicit prerequisite note. One spear supplies the base physical packet; every later spear adds a separate total AD/AP term. Kindred W exposes **Earned Mark of the Kindred stacks** and uses those marks in one Wolf bite's enemy-current-HP coefficient. Its input has the same finite app limit as Nasus; this is not a claim about an in-game mark cap. These controls reuse the portable earned-stack field with objective-specific labels and bounds; each comparison displays the correct stack context.

Kai'Sa Q's reviewed raw calculation tree adds the first missile at full damage before multiplying only the five/eleven additional hits by 0.25, producing 2.25/3.75 total multipliers. The rendered formula's parentheses are misleading, so the adapters also retain source MaxDamage/MaxDamageEvolved values and use the raw tree plus explicit missile rules. Yone W similarly uses source BaseDamage/MaxHealthDamage and the champion tooltip instead of the unrelated WDamage AD helper. Both choices have independent numeric fixtures.

Twitch E exposes **Existing Deadly Venom stacks**, capped at six. Mel R exposes **Existing Overwhelm stacks**, using the finite app limit of 1,000,000, not a claimed in-game cap. Both need an already affected target: zero stacks produces no damage and spends no mana. Twitch's ongoing poison true damage and Mel's passive execution mechanics are excluded; their selected active packets use only the supplied stack count. Saves, target sweeps and purchase comparisons preserve these conditions.

Jayce's hammer abilities and Yuumi Q expose all six learned ranks, including rank-six source costs and save validation. Bel'Veth, Mini Gnar, Shyvana and Viego do not use mana/energy for these casts; mana purchases cannot generate mana capacity or Muramana conversion. Rage/Fury/form transitions, True Form stat bonuses and possession are not advanced by the engine. Conditional objectives explicitly assume their Coral, form, Fury, Unleash or prior-hit prerequisites are already prepared, with setup damage excluded.
