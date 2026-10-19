# Shared combat calculation coverage

Patch 26.20; formula compatibility 3. Generated from the actual objective registry.

173 champions have 475 selected damage objectives passing through the common pipeline. This is **partial damage coverage**, not full simulation of every champion kit or of all 476 authored ceiling metrics. Healing, shielding, maximum-stat and many multi-action ceilings still need manual game tests.

## Included layers

- Prepared rune stats: Conqueror, finite Gathering Storm, Bloodline, Alacrity, Legend Haste, Manaflow, biscuits, Overgrowth, earned Grasp HP, Absolute Focus, Jack, Transcendence, Waterwalking, Lethal Tempo AS and Hail AS. Counter values are supplied, never earned by equipping a rune.
- Prepared defenses and conversions: Conditioning, Unflinching, Aftershock, Jak’Sho and Terminus; active Hubris, Sterak base AD, Seraph bonus-mana AP, Muramana mana AD, and existing item/champion conversions. Hecarim requires observed movement speed after soft caps. Combined temporary-buff ordering remains approximate.
- Live damage conditions: Cut Down, Coup, Last Stand, prepared PTA, classified Axiom, prepared Shojin, Riftmaker/Liandry ramps, in-range Abyssal, Shadowflame and entered-target-bonus-HP Giant Slayer. Prepared Cleaver shred precedes penetration.
- Separate ready proc packets: Comet, Aery, Scorch, Dark Harvest, First Strike, Hail damage, Deathfire, Liandry burn, Luden, Nashor, Spellblade, Rapid Firecannon, Titanic primary on-hit, Heartsteel and Terminus. Muramana identifies distinct modeled casts, excluding duplicate ticks of one cast. Eligibility depends on delivery classification; unrelated spells never gain automatic attacks.
- Purge uses its pinned OnHitDamageReduction=0.5 for supported on-hits; special Heartsteel/Energized eligibility stays excluded pending verification. Hybrid spell/on-hit delivery is explicitly tagged for Ezreal Q, Gangplank Q and Irelia Q. Other unresolved hybrid, pet and attack mechanics remain partial.

The result reports native damage, proc damage, capped effective HP removed and per-effect notes. Default scoring is uncapped potential; stop-at-death drops subsequent packets. Native DOTs use normalized quarter-second slices, burns use documented integrated tick approximations, and threshold checks use current simulated target HP. Same-time procs resolve after their own native packet, before the next native packet. Proc outputs never trigger further procs; First Strike excludes item/rune output and is not amplified twice. Spellblade is armed once; no later cast is invented to rearm it.

## Limits and provenance

Unlisted item/rune effects, full crit/attack schedules, dynamic stack generation/expiry, healing/shields, execute thresholds, projectile travel and detailed client proc ordering are not universally simulated. Lethal Tempo max-stack damage, Rageblade Phantom Hit, Titanic active/splash and Collector execute are examples of remaining gaps. Lethal Tempo has conflicting ranged helper/explicit values in the snapshot; this pass does not silently invent a damage coefficient. Existing champion source notes still apply. A legal build with a finite result does not prove exact client parity or maximum possible damage.

The compact item calculation fixture is [combat-source-evidence.json](../scripts/combat-source-evidence.json), extracted from the [pinned 16.20 game item records](https://raw.communitydragon.org/16.20/game/items.cdtb.bin.json). Rune raw values/calculations and champion engine records are retained in the published patch snapshot. Regression tests check shared coefficients, preparation validation, conversion order, delivery eligibility, no recursive procs, finite-target stopping and every registered champion/objective. In-game parity remains pending.

Website and desktop frontend build separately. Formula compatibility was bumped to 3; older installed desktop binaries cannot gain these engine changes from a data-only refresh and require a new desktop release.

## Purchase timing

Authored/meta plans prioritize owned Rod of Ages, Heartsteel and Hubris earlier, with inferred-order labels. An early Tear is a recall option for its upgrades. The damage planner offers stacking-time constraints and a separate opt-in early Collector preference after a core spike. Collector’s 25 gold per kill does not grant forecast income; four eligible kills only add 100 gold. Time, target access, takedowns and the cost of delaying another item determine actual value. No future stacks or snowball gold are fabricated in damage scoring.

## Additional native-action interactions (2026-10-20)

Grasp includes one explicitly charged 3.5% owner-max-HP hit (40% effective at range). PTA counts eligible deliveries, accepts 0–2 prior hits, respects its gap/cooldown, and activates amplification only after its burst resolves. Electrocute accepts 0–2 prior actions, counts distinct native actions within three seconds and enforces its cooldown; a DOT tick or multi-hit packet cannot invent a third action. Cheap Shot requires explicit impairment shared by both comparison targets. Sudden Impact requires an explicitly armed four-second opening window. None generates free preparation or recursive proc triggers.

Wit’s End adds the pinned 45 magic damage; Rageblade adds 30 magic per delivery and 8% AS per prepared stack (0–4). Phantom Hit remains excluded. BotRK uses 9% melee / 6% ranged current-HP damage, sampled at its modeled impact after the native packet and prior procs, rather than using maximum HP for every delivery. Reduced-effectiveness delivery factors are retained. The minimum-damage floor and exact client same-frame ordering remain unverified.

Explicit attack delivery classification was added for Trundle, Nasus, Garen, Yorick, Xin Zhao and Volibear Q, Camille Q1 and Renekton W. Renekton W’s strikes can apply multiple on-hits/PTA hits, while Hail and Electrocute see one native action. Combined attack/ability packets do not establish exact Shojin amplification of the bonus portion. Camille Q2 conversion, other unresolved hybrid attacks and arbitrary combo timing still require separate adapters/client verification.

These additions are regression-tested individually and together through every registered champion objective. Formula compatibility 3 requires a new desktop binary beyond release 0.1.3; a data-only refresh cannot add calculation code. Source notes and the compact evidence fixture remain the coefficient authority for patch 26.20.

## Registered objectives

| Champion | Partial damage objectives |
| --- | --- |
| Aatrox | Q · Darkin Blade (first swing, ordinary); Q · Darkin Blade (first swing sweet spot); W · Infernal Chains (initial hit) |
| Ahri | Q · Orb (both passes land); W · Fox-Fire (three hits); E · Charm; R · Spirit Rush (one dash hit) |
| Akali | Q · Five Point Strike; E · Shuriken Flip (first hit); R · Perfect Execution (first vault) |
| Akshan | Q · Avengerang (one pass); Q · Avengerang (both passes) |
| Alistar | Q · Pulverize; W · Headbutt |
| Ambessa | W · Repudiation (ordinary strike); W · Repudiation (prepared enhanced strike); E · Lacerate (initial strike); R · Public Execution |
| Amumu | Q · Bandage Toss; E · Tantrum; R · Curse of the Sad Mummy |
| Anivia | Q · Flash Frost (passage + explosion); E · Frostbite (not Chilled); E · Frostbite (already Chilled) |
| Annie | Q · Disintegrate; W · Incinerate; E · Molten Shield (one triggered retaliation); R · Summon: Tibbers (initial impact) |
| Aphelios | R · Moonlight Vigil (initial explosion) |
| Ashe | W · Volley; R · Enchanted Crystal Arrow |
| Aurelion Sol | E · Singularity (observed field damage); R · Falling Star (ordinary impact); R · The Skies Descend (prepared central impact) |
| Aurora | Q · Twofold Hex (initial hit); E · The Weirding; R · Between Worlds |
| Azir | Q · Conquering Sands; E · Shifting Sands; R · Emperor's Divide |
| Bard | Q · Cosmic Binding |
| Bel'Veth | Q · Void Surge; W · Above and Below; R · Endless Banquet (prepared Coral explosion) |
| Blitzcrank | Power Fist (noncritical) |
| Brand | Q · Sear; W · Pillar of Flame (not Ablaze); E · Conflagration; R · Pyroclasm (one bounce) |
| Braum | Q · Winter's Bite; R · Glacial Fissure |
| Briar | E · Chilling Scream (fully charged release); E · Chilling Scream (full charge + wall) |
| Caitlyn | Q · Piltover Peacemaker (first target); E · 90 Caliber Net |
| Camille | Q · Precision Protocol (first attack); Q · Precision Protocol (prepared second attack); W · Tactical Sweep (inner area); W · Tactical Sweep (outer edge); E · Wall Dive (champion collision) |
| Cassiopeia | Q poison; Twin Fang; Q + poisoned E; Repeated Q/E |
| Cho'Gath | Q · Rupture; W · Feral Scream; R · Feast |
| Corki | Q · Phosphorus Bomb; R · Missile Barrage (ordinary missile) |
| Darius | R · Noxian Guillotine |
| Diana | Q · Crescent Strike; W · Pale Cascade (three orbs hit); E · Lunar Rush |
| Dr. Mundo | Q · Infected Bonesaw |
| Draven | E · Stand Aside; R · Whirling Death (first outward hit) |
| Ekko | Q · Timewinder (both passes); E · Phase Dive (noncritical attack); R · Chronobreak |
| Elise | Q · Neurotoxin (human form); W · Volatile Spiderling (human form) |
| Evelynn | Q · Hate Spike (first missile); E · Whiplash (ordinary); E · Whiplash (empowered); R · Last Caress |
| Ezreal | Q · Mystic Shot; W · Essence Flux; E · Arcane Shift; R · Trueshot Barrage |
| Fiddlesticks | Q · Terrify (not recently feared); E · Reap |
| Fiora | Q · Lunge; W · Riposte |
| Fizz | Q · Urchin Strike; E · Playful / Trickster; R · Chum the Waters (small shark); R · Chum the Waters (big shark) |
| Galio | Q · Winds of War (projectile impact); W · Shield of Durand (minimum charge); E · Justice Punch |
| Gangplank | Q · Parrrley (noncritical); R · Cannon Barrage (one wave) |
| Garen | Q · Decisive Strike (noncritical attack) |
| Gnar | Q · Boomerang Throw (Mini Gnar); W · Hyper (prepared third attack); E · Hop (Mini Gnar bounce) |
| Gragas | Q · Barrel Roll (uncharged); Q · Barrel Roll (fully matured); W · Drunken Rage attack (noncritical); E · Body Slam; R · Explosive Cask |
| Graves | Q · End of the Line (initial hit); W · Smoke Screen; R · Collateral Damage (direct impact) |
| Gwen | Q · Snip Snip! (zero stacks, outer area); Q · Snip Snip! (four stacks, outer area) |
| Hecarim | W · Spirit of Dread (observed field); R · Onslaught of Shadows |
| Heimerdinger | W · Hextech Micro-Rockets (one rocket); W · Hextech Micro-Rockets (all five); E · CH-2 Electron Storm Grenade |
| Hwei | QQ · Devastating Fire; EQ · Grim Visage; R · Spiraling Despair |
| Illaoi | W · Harsh Lesson (attack only); R · Leap of Faith (initial impact) |
| Irelia | Q · Bladesurge; W · Defiant Dance (minimum charge); W · Defiant Dance (maximum damage); E · Flawless Duet; R · Vanguard's Edge (initial missile) |
| Ivern | Q · Rootcaller; E · Triggerseed |
| Janna | Q · Howling Gale (uncharged); Q · Howling Gale (fully charged) |
| Jarvan IV | E · Demacian Standard; R · Cataclysm |
| Jax | Q · Leap Strike; W · Empower (noncritical attack); R · Grandmaster-at-Arms (active swing) |
| Jayce | Q · To the Skies! (hammer form); W · Lightning Field (hammer form); E · Thundering Blow (hammer form) |
| Jhin | Q · Dancing Grenade (first hit); W · Deadly Flourish; E · Captive Audience (one explosion); R · Curtain Call (one ordinary bullet) |
| Jinx | W · Zap!; E · Flame Chompers! (one triggered trap); R · Super Mega Death Rocket! (minimum travel); R · Super Mega Death Rocket! (maximum travel) |
| K'Sante | Q · Ntofo Strikes (base form); W · Path Maker (base form release) |
| Kai'Sa | Q · Icathian Rain (one missile); Q · Icathian Rain (six isolated missiles); Q · Icathian Rain (evolved, twelve isolated missiles); W · Void Seeker |
| Kalista | Q · Pierce; E · Rend (prepared spears) |
| Karma | Q · Inner Flame (without Mantra); W · Focused Resolve (initial hit) |
| Karthus | Q · Lay Waste (not isolated); Q · Lay Waste (isolated); R · Requiem |
| Kassadin | Q · Null Sphere; E · Force Pulse; R · Riftwalk (zero prior stacks); R · Riftwalk (four prior stacks) |
| Katarina | Q · Bouncing Blade; E · Shunpo |
| Kayle | Q · Radiant Blast; R · Divine Judgment (sword impact) |
| Kayn | Q · Reaping Slash (base form, both hits); W · Blade's Reach (base form); R · Umbral Trespass (base form exit); R · Umbral Trespass (Rhaast exit) |
| Kennen | Q · Thundering Shuriken; W · Electrical Surge (already marked); E · Lightning Rush |
| Kha'Zix | Q · Taste Their Fear (not isolated); Q · Taste Their Fear (isolated); W · Void Spike; E · Leap |
| Kindred | Q · Dance of Arrows; W · Wolf's Frenzy (one bite) |
| Kled | Q · Bear Trap on a Rope (initial hit); Q · Bear Trap on a Rope (tether retained); E · Jousting; R · Chaaaaaaaarge!!! (minimum distance); R · Chaaaaaaaarge!!! (maximum distance) |
| Kog'Maw | Q · Caustic Spittle; W · Bio-Arcane Barrage (one noncritical attack); E · Void Ooze; R · Living Artillery (first-cost shot) |
| LeBlanc | Q · Sigil of Malice (initial hit); W · Distortion; E · Ethereal Chains (initial hit) |
| Lee Sin | Q · Sonic Wave (initial hit); E · Tempest / Cripple; R · Dragon's Rage |
| Leona | Q · Shield of Daybreak (noncritical attack); W · Eclipse; E · Zenith Blade; R · Solar Flare |
| Lillia | Q · Blooming Blows (outer edge); W · Watch Out! Eep! (outer area); W · Watch Out! Eep! (center); E · Swirlseed |
| Lissandra | Q · Ice Shard; W · Ring of Frost; E · Glacial Path; R · Frozen Tomb (enemy target) |
| Locke | Q · Soul Nails (one missile); E · Teleport (arrival hit); R · Binding artifact (initial impact) |
| Lucian | Q · Piercing Light; W · Ardent Blaze |
| Lulu | Q · Glitterlance (one bolt); Q · Glitterlance (both bolts); E · Help, Pix! (offensive) |
| Lux | Q · Light Binding; E · Lucent Singularity; R · Final Spark |
| Malphite | Q · Seismic Shard; R · Unstoppable Force |
| Malzahar | Q · Call of the Void; E · Malefic Visions (observed damage) |
| Maokai | Q · Bramble Smash; W · Twisted Advance; E · Sapling Toss (outside brush); R · Nature's Grasp |
| Master Yi | Q · Alpha Strike (one noncritical hit); Q · Alpha Strike (isolated, noncritical); E · Wuju Style (one noncritical attack) |
| Mel | Q · Radiant Volley (first explosion); Q · Radiant Volley (all explosions); E · Solar Snare (initial orb); R · Golden Eclipse (prepared Overwhelm) |
| Milio | Q · Ultra Mega Fire Kick |
| Miss Fortune | Q · Double Up (first target) |
| Mordekaiser | E · Death's Grasp |
| Morgana | Q · Dark Binding; R · Soul Shackles (tether retained) |
| Naafiri | Q · Darkin Daggers (first cast and bleed); E · Eviscerate; R · Hounds' Pursuit (Naafiri hit only) |
| Nami | Q · Aqua Prison; W · Ebb and Flow (first offensive hit); R · Tidal Wave |
| Nasus | Q · Siphoning Strike (earned stacks); E · Spirit Fire |
| Nautilus | Q · Dredge Line; E · Riptide (one wave); R · Depth Charge (primary target) |
| Neeko | Q · Blooming Burst (initial hit); E · Tangle-Barbs |
| Nidalee | Q · Javelin Toss (minimum distance); Q · Javelin Toss (maximum distance); W · Bushwhack (triggered trap) |
| Nilah | Q · Formless Blade; E · Slipstream |
| Nocturne | Q · Duskbringer; R · Paranoia |
| Nunu & Willump | Q · Consume (champion target); E · Snowball Barrage (one snowball); R · Absolute Zero (full channel) |
| Olaf | E · Reckless Swing |
| Orianna | Q · Command: Attack (first target); W · Command: Dissonance; E · Command: Protect (ball hits enemy); R · Command: Shockwave |
| Ornn | Q · Volcanic Rupture; W · Bellows Breath (cone only); E · Searing Charge; R · Call of the Forge God (first pass) |
| Pantheon | R · Grand Starfall (center landing) |
| Poppy | Q · Hammer Shock (target stays for eruption); W · Steadfast Presence (dash intercepted); E · Heroic Charge (no wall collision); R · Keeper's Verdict (uncharged tap) |
| Pyke | Q · Bone Skewer; E · Phantom Undertow |
| Qiyana | Q · Edge of Ixtal (ordinary slash); E · Audacity; R · Supreme Display of Talent |
| Quinn | Q · Blinding Assault; E · Vault |
| Rakan | Q · Gleaming Quill; W · Grand Entrance; R · The Quickness |
| Rammus | Q · Powerball; W · Defensive Ball Curl (one triggered retaliation); R · Soaring Slam (ordinary initial landing) |
| Rek'Sai | Q · Prey Seeker (already burrowed); E · Furious Bite (below maximum Fury); E · Furious Bite (maximum Fury ready) |
| Rell | Q · Shattering Strike; W · Crash Down (spell impact) |
| Renata Glasc | Q · Handshake; E · Loyalty Program |
| Renekton | Q · Cull the Meek (ordinary); Q · Cull the Meek (50 Fury ready); W · Ruthless Predator (ordinary two hits); W · Ruthless Predator (50 Fury ready); E · Slice (first dash) |
| Rengar | W · Battle Roar (ordinary hit); E · Bola Strike (ordinary hit) |
| Riven | Q · Broken Wings (first slash); W · Ki Burst |
| Rumble | Q · Flamespitter (ordinary cone); Q · Flamespitter (prepared Danger Zone); R · The Equalizer (observed trail) |
| Ryze | Q · Overload (unfluxed); W · Rune Prison; E · Spell Flux |
| Samira | Q · Flair (ranged, noncritical); W · Blade Whirl; E · Wild Rush |
| Sejuani | Q · Arctic Assault; W · Winter's Wrath (both swings); E · Permafrost; R · Glacial Prison (short-range initial hit) |
| Senna | Q · Piercing Darkness; W · Last Embrace; R · Dawning Shadow |
| Seraphine | E · Beat Drop; R · Encore |
| Sett | Haymaker |
| Shaco | E · Two-Shiv Poison; R · Hallucinate (clone-death explosion) |
| Shen | E · Shadow Dash |
| Shyvana | W · Human-form shield detonation; E · Human-form fireball; E · Dragon-form fireball (one pulse); R · Dragon's Descent (ready transformation hit) |
| Singed | E · Fling |
| Sion | Q · Decimating Smash (uncharged); Q · Decimating Smash (fully charged); W · Soul Furnace (shield survives to detonation); E · Roar of the Slayer; R · Unstoppable Onslaught (minimum-distance hit) |
| Sivir | Q · Boomerang Blade (one full-damage pass); Q · Boomerang Blade (both full-damage passes) |
| Skarner | Q · Upheaval (boulder throw); W · Seismic Bastion; E · Ixtal's Impact (successful wall pin); R · Impale |
| Smolder | W · Achooo! (initial impact); R · MMOOOMMMM! (outer area); R · MMOOOMMMM! (center) |
| Sona | Q · Hymn of Valor; R · Crescendo |
| Soraka | Q · Starcall; E · Equinox (target stays) |
| Swain | Q · Death's Hand (one bolt); Q · Death's Hand (all five bolts); W · Vision of Empire; E · Nevermove (return detonation) |
| Sylas | Q · Chain Lash (initial hit); Q · Chain Lash (with intersection explosion); W · Kingslayer; E · Abduct (chain hit) |
| Syndra | Q · Dark Sphere; W · Force of Will (before upgrade); E · Scatter the Weak; R · Unleashed Power (three spheres) |
| Tahm Kench | Tongue Lash + passive; Abyssal Dive; Enemy Devour |
| Taliyah | Q · Threaded Volley (first rock); Q · Threaded Volley (all five rocks); E · Unraveled Earth (initial hit) |
| Talon | Q · Noxian Diplomacy (ranged leap); W · Rake (outward hit); R · Shadow Assault (outward hit) |
| Taric | E · Dazzle |
| Teemo | Q · Blinding Dart; E · Toxic Shot (one attack and poison); R · Noxious Trap (triggered mushroom) |
| Thresh | Q · Death Sentence; E · Flay (active spell); R · The Box (first wall) |
| Tristana | W · Rocket Jump; R · Buster Shot |
| Trundle | Q · Chomp (pre-steal attack) |
| Tryndamere | E · Spinning Slash |
| Twisted Fate | Q · Wild Cards; E · Stacked Deck (ready fourth attack) |
| Twitch | E · Contaminate (prepared Venom) |
| Udyr | Q · Wilding Claw (one ordinary empowered attack); R · Wingborne Storm (ordinary observed field) |
| Urgot | Q · Corrosive Charge; W · Purge (one shot); E · Disdain; R · Fear Beyond Death (initial drill) |
| Varus | Q · Piercing Arrow (minimum charge); Q · Piercing Arrow (maximum charge); E · Hail of Arrows; R · Chain of Corruption |
| Vayne | Q · Tumble (noncritical attack); E · Condemn (no wall); E · Condemn (wall collision) |
| Veigar | Q · Baleful Strike; W · Dark Matter |
| Vel'Koz | Q · Plasma Fission; W · Void Rift (initial hit); E · Tectonic Disruption |
| Vex | Q · Mistral Bolt; W · Personal Space; E · Looming Darkness; R · Shadow Surge (initial hit) |
| Vi | Q · Vault Breaker (minimum charge); Q · Vault Breaker (fully charged); E · Relentless Force (noncritical attack); R · Cease and Desist |
| Viego | W · Spectral Maw |
| Viktor | Q · Siphon Power (initial spell); E · Hextech Ray (initial ray); R · Arcane Storm (target stays) |
| Vladimir | Q · Transfusion; Q · Transfusion (prepared Crimson Rush) |
| Volibear | Q · Thundering Smash (noncritical attack); W · Frenzied Maul (unmarked); W · Frenzied Maul (already marked); E · Sky Splitter; R · Stormbringer (center landing) |
| Warwick | Q · Jaws of the Beast |
| Wukong | E · Nimbus Strike; R · Cyclone (one cast, observed damage) |
| Xayah | Q · Double Daggers (both, first target); R · Featherstorm |
| Xerath | Q · Arcanopulse; W · Eye of Destruction (outer area); E · Shocking Orb; R · Rite of the Arcane (first shot) |
| Xin Zhao | Q · Three Talon Strike (first attack); W · Wind Becomes Lightning (initial slash); E · Audacious Charge; R · Crescent Guard |
| Yasuo | Q · Steel Tempest (noncritical); E · Sweeping Blade (zero prior stacks); E · Sweeping Blade (four prior stacks); R · Last Breath |
| Yone | Q · Mortal Steel (noncritical); W · Spirit Cleave; R · Fate Sealed |
| Yorick | Q · Last Rites (noncritical attack); E · Mourning Mist |
| Yunara | Q · Cultivation of Spirit (prepared attack); W · Arc of Judgment (ordinary initial hit) |
| Yuumi | Q · Prowling Projectile (ordinary missile); Q · Prowling Projectile (accelerated attached missile); R · Final Chapter (one wave) |
| Zaahen | W · Dreaded Return (initial strike); E · Aureate Rush (inner slice); E · Aureate Rush (outer edge); R · Grim Deliverance |
| Zac | Q · Stretching Strikes; W · Unstable Matter; E · Elastic Slingshot; R · Let's Bounce (first hit); R · Let's Bounce (four hits) |
| Zed | Q · Razor Shuriken (one first-target hit); E · Shadow Slash |
| Zeri | W · Ultrashock Laser (no terrain); R · Lightning Crash (initial nova) |
| Ziggs | Q · Bouncing Bomb; W · Satchel Charge; R · Mega Inferno Bomb |
| Zilean | Q · Time Bomb (one full fuse) |
| Zoe | W · Spell Thief (one prepared missile); E · Sleepy Trouble Bubble (initial hit) |
| Zyra | Q · Deadly Spines; E · Grasping Roots; R · Stranglethorns |
