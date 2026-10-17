# Ability ceiling review — 2026-10-18

Patch 26.20: 205 targets across 173 champions.

All authored targets checked for legal items/resources, source presence, target/form/rank and generated benchmark consistency. Full rune/import contracts are checked by the test suite. This is not numerical certification, a global optimization search, or an in-game test.

Twenty new targets extend the previous 185. Older authored setups now explicitly carry Gathering Storm time, owner/target HP, finite Heartsteel HP, Rod stacks and item combat preparation into the test form. Ten low-HP damage candidates replace inactive Absolute Focus with an explicitly prepared 12-stack Conqueror/Last Stand alternative; true-damage amplification remains a per-packet eligibility check. Tryndamere's healing experiment uses the healing rune candidate. Form-specific evidence is selected for cougar Takedown instead of the human spear tooltip.

All rows remain candidates. A source expression can still contain unresolved cross-spell helpers; actual proc eligibility, hit order, mitigation, crit inheritance, healing rules and performance in a match require game testing. Inspect the companion JSON for every target's state, source paths and remaining checks. Reproduce with `npm run ability-ceilings && node scripts/audit-ability-ceilings.mjs`.

The current patch reference is [Riot's 26.20 notes](https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-20-notes/); detailed formulas use the repository's extracted patch snapshot.

| Champion | Target | Form | Metric | Confidence | Manual check categories |
|---|---|---|---|---|---|
| Aatrox | The Darkin Blade third edge | Q | single-hit | plausible | 2 |
| Akshan | Comeuppance seven-bullet charge | R | full-window | plausible | 2 |
| Amumu | Curse of the Sad Mummy | R | single-hit | plausible | 1 |
| Aphelios | Infernum Moonlight Vigil cluster | R | full-window | speculative | 3 |
| Aurora | Spirit Abjuration | P | single-hit | plausible | 1 |
| Belveth | Void Coral detonation | R | single-hit | plausible | 1 |
| Braum | Winter's Bite | Q | single-hit | plausible | 1 |
| Camille | Delayed Precision Protocol | Q | single-hit | speculative | 3 |
| Corki | The Big One | R | single-hit | plausible | 1 |
| DrMundo | Maximum Dosage recovery | R | heal | speculative | 2 |
| Elise | Spider Venomous Bite | Q:1 | single-hit | speculative | 2 |
| Fiddlesticks | Complete Crowstorm | R | full-window | plausible | 2 |
| Galio | Winds of War tornado | Q | full-window | speculative | 3 |
| Gnar | Mega wall slam | R | single-hit | plausible | 1 |
| Gwen | Nine Needlework needles | R | full-window | plausible | 2 |
| Hwei | Severing Bolt | Q | single-hit | plausible | 2 |
| Ivern | Triggerseed detonation | E | single-hit | plausible | 1 |
| Jax | Five-dodge Counter Strike | E | single-hit | plausible | 1 |
| Jinx | Maximum-travel rocket | R | single-hit | plausible | 1 |
| Kalista | Twenty-spear Rend | E | single-hit | plausible | 1 |
| Kassadin | Four-stack Riftwalk | R | single-hit | plausible | 1 |
| Kayn | Rhaast Umbral Trespass | R | single-hit | speculative | 2 |
| Kindred | Eight-mark Mounting Dread | E | single-hit | speculative | 2 |
| Leblanc | Mimicked Ethereal Chains | R | full-window | plausible | 2 |
| Lillia | Watch Out center strike | W | single-hit | plausible | 1 |
| Lucian | Uninterrupted Culling | R | full-window | speculative | 3 |
| Malphite | Unstoppable Force | R | single-hit | plausible | 1 |
| MasterYi | Wuju Style true packet | E | single-hit | speculative | 3 |
| MissFortune | Eighteen-wave Bullet Time | R | full-window | plausible | 2 |
| Naafiri | Seven-packmate Hounds' Pursuit | W | full-window | plausible | 2 |
| Nautilus | Depth Charge primary eruption | R | single-hit | plausible | 1 |
| Nilah | Critical Formless Blade | Q | single-hit | plausible | 1 |
| Olaf | Ragnarok Reckless Swing | E | single-hit | plausible | 2 |
| Pantheon | Mortal Will low-health spear | Q | single-hit | plausible | 1 |
| Qiyana | Supreme Display terrain explosion | R | single-hit | plausible | 1 |
| Rammus | Defensive Ball Curl reflection | W | single-hit | plausible | 1 |
| Renata | Leverage apply and consumption | P | full-window | plausible | 2 |
| Riven | Wind Slash | R | single-hit | plausible | 2 |
| Samira | Inferno Trigger | R | full-window | plausible | 2 |
| Seraphine | Echoed low-health High Note | Q | full-window | plausible | 2 |
| Shen | Stand United maximum shield | R | shield | speculative | 3 |
| Sion | Maximum-distance Onslaught | R | single-hit | plausible | 1 |
| Smolder | Five-hundred-stack Super Scorcher | Q | full-window | plausible | 3 |
| Swain | Five-bolt Death's Hand | Q | single-hit | plausible | 1 |
| TahmKench | Enemy Devour spit | R | single-hit | plausible | 1 |
| Taric | Bastion Dazzle beam | E | single-hit | plausible | 1 |
| Tristana | Four-stack Explosive Charge | E | single-hit | plausible | 1 |
| TwistedFate | Blue Card cashout | W | single-hit | speculative | 1 |
| Urgot | One Echoing Flames leg | P | single-hit | plausible | 1 |
| Veigar | Five-hundred-stack Primordial Burst | R | single-hit | plausible | 1 |
| Vi | Fully charged Vault Breaker | Q | single-hit | plausible | 1 |
| Vladimir | Crimson Rush Transfusion | Q | single-hit | plausible | 1 |
| MonkeyKing | Two Cyclones with clone | R | full-window | speculative | 3 |
| XinZhao | Wind Becomes Lightning thrust | W | single-hit | plausible | 1 |
| Yorick | Mourning Mist health chunk | E | single-hit | plausible | 1 |
| Zaahen | Grim Deliverance at Determination cap | R | single-hit | speculative | 3 |
| Zeri | Wall Ultrashock Laser | W | single-hit | plausible | 1 |
| Zoe | Maximum-distance Paddle Star | Q | single-hit | plausible | 1 |
| Ahri | Orb of Deception | Q | full-window | plausible | 2 |
| Alistar | Headbutt | W | single-hit | plausible | 1 |
| Anivia | Frostbite | E | single-hit | plausible | 1 |
| Ashe | Enchanted Crystal Arrow | R | single-hit | plausible | 1 |
| Azir | Arise! | W | full-window | speculative | 3 |
| Blitzcrank | Rocket Grab | Q | single-hit | plausible | 1 |
| Briar | Chilling Scream | E | full-window | speculative | 3 |
| Cassiopeia | Twin Fang | E | single-hit | plausible | 1 |
| Darius | Noxian Guillotine | R | single-hit | speculative | 2 |
| Draven | Whirling Death | R | execute-threshold | speculative | 2 |
| Evelynn | Last Caress | R | single-hit | plausible | 1 |
| Fiora | Duelist's Dance | P | single-hit | speculative | 3 |
| Gangplank | Cannon Barrage | R | full-window | plausible | 2 |
| Gragas | Barrel Roll | Q | single-hit | plausible | 1 |
| Hecarim | Rampage | Q | single-hit | speculative | 1 |
| Illaoi | Harsh Lesson | W | single-hit | speculative | 1 |
| Janna | Monsoon | R | heal | plausible | 1 |
| Jayce | Shock Blast (Accelerated) | Q:1 | single-hit | speculative | 2 |
| KSante | Path Maker | W | single-hit | speculative | 2 |
| Karma | Inner Flame | Q | full-window | speculative | 4 |
| Katarina | Death Lotus | R | full-window | speculative | 3 |
| Kennen | Slicing Maelstrom | R | full-window | plausible | 2 |
| Kled | Chaaaaaaaarge!!! | R | single-hit | speculative | 1 |
| LeeSin | Dragon's Rage | R | single-hit | speculative | 1 |
| Lissandra | Frozen Tomb | R | heal | plausible | 1 |
| Lulu | Help, Pix! | E | shield | plausible | 1 |
| Malzahar | Nether Grasp | R | full-window | speculative | 3 |
| Mel | Golden Eclipse | R | single-hit | plausible | 1 |
| Mordekaiser | Obliterate | Q | single-hit | speculative | 2 |
| Nami | Ebb and Flow | W | heal | plausible | 1 |
| Neeko | Pop Blossom | R | single-hit | plausible | 1 |
| Nocturne | Paranoia | R | single-hit | speculative | 1 |
| Orianna | Command: Shockwave | R | single-hit | plausible | 1 |
| Poppy | Hammer Shock | Q | full-window | speculative | 2 |
| Quinn | Blinding Assault | Q | single-hit | speculative | 1 |
| RekSai | Void Rush | R | single-hit | speculative | 1 |
| Renekton | Ruthless Predator | W | full-window | plausible | 1 |
| Rumble | The Equalizer | R | full-window | plausible | 2 |
| Sejuani | Glacial Prison | R | full-window | plausible | 2 |
| Sett | Haymaker | W | single-hit | speculative | 3 |
| Shyvana | Emberstrike | Q | single-hit | speculative | 2 |
| Sivir | Boomerang Blade | Q | full-window | speculative | 2 |
| Sona | Hymn of Valor | Q | single-hit | plausible | 1 |
| Sylas | Kingslayer | W | heal | speculative | 2 |
| Taliyah | Threaded Volley | Q | full-window | plausible | 2 |
| Teemo | Noxious Trap | R | full-window | speculative | 3 |
| Trundle | Subjugate | R | full-window | plausible | 2 |
| Twitch | Contaminate | E | single-hit | speculative | 2 |
| Varus | Blighted Quiver | W | single-hit | speculative | 2 |
| Velkoz | Life Form Disintegration Ray | R | full-window | plausible | 2 |
| Viego | Heartbreaker | R | single-hit | speculative | 1 |
| Volibear | Stormbringer | R | single-hit | speculative | 1 |
| Xayah | Bladecaller | E | full-window | speculative | 2 |
| Yasuo | Sweeping Blade | E | single-hit | speculative | 2 |
| Yunara | Arc of Ruin | W | single-hit | speculative | 2 |
| Zac | Unstable Matter | W | single-hit | plausible | 1 |
| Ziggs | Mega Inferno Bomb | R | single-hit | plausible | 1 |
| Zyra | Stranglethorns | R | full-window | speculative | 3 |
| Akali | Shuriken Flip E2 | E | single-hit | plausible | 1 |
| Ambessa | Sundering Slam first target | Q | single-hit | plausible | 1 |
| Annie | Summon Tibbers impact | R | single-hit | plausible | 1 |
| AurelionSol | Singularity execute threshold | E | execute-threshold | plausible | 2 |
| Bard | One Meep bonus | P | single-hit | speculative | 2 |
| Brand | Ablaze Pillar of Flame | W | single-hit | plausible | 1 |
| Caitlyn | Ace in the Hole | R | single-hit | plausible | 1 |
| Chogath | Feast champion damage | R | single-hit | speculative | 2 |
| Diana | Five-champion Moonfall | R | single-hit | plausible | 1 |
| Ekko | Chronobreak explosion | R | single-hit | plausible | 1 |
| Ezreal | Trueshot Barrage champion hit | R | single-hit | plausible | 1 |
| Fizz | Maximum-distance shark | R | single-hit | plausible | 1 |
| Garen | Judgment three-second spin | E | full-window | speculative | 3 |
| Graves | Collateral Damage direct shell | R | single-hit | plausible | 1 |
| Heimerdinger | Hextech Rocket Swarm | R | full-window | plausible | 2 |
| Irelia | Fully charged Defiant Dance | W | single-hit | speculative | 2 |
| JarvanIV | Cataclysm impact | R | single-hit | plausible | 1 |
| Jhin | One Lotus Trap explosion | E | single-hit | speculative | 2 |
| Kaisa | Void Seeker direct hit | W | single-hit | plausible | 2 |
| Karthus | Requiem per champion | R | single-hit | plausible | 1 |
| Kayle | Starfire missing-health bonus | E | single-hit | plausible | 1 |
| Khazix | Isolated Taste Their Fear | Q | single-hit | speculative | 3 |
| KogMaw | One Bio-Arcane bonus on-hit | W | single-hit | plausible | 1 |
| Leona | Solar Flare impact | R | single-hit | plausible | 1 |
| Locke | Three Soul Nail consumption | Q | single-hit | speculative | 2 |
| Lux | Final Spark direct beam | R | single-hit | plausible | 1 |
| Maokai | One brush sapling explosion | E | full-window | plausible | 2 |
| Milio | Ultra Mega Fire Kick explosion | Q | single-hit | plausible | 1 |
| Morgana | Soul Shackles both pulses | R | full-window | plausible | 2 |
| Nasus | 500-stack Siphoning Strike | Q | single-hit | plausible | 1 |
| Nidalee | Maximum-distance Javelin Toss | Q | single-hit | plausible | 1 |
| Nunu | Fully charged Absolute Zero | R | single-hit | plausible | 1 |
| Ornn | Searing Charge collision | E | single-hit | speculative | 2 |
| Pyke | Death from Below threshold | R | execute-threshold | plausible | 2 |
| Rakan | Battle Dance one ally shield | E | shield | plausible | 1 |
| Rell | Full Tilt explosion | E | single-hit | plausible | 1 |
| Rengar | Empowered Savagery attack | Q | single-hit | speculative | 2 |
| Ryze | Flux empowered Overload | Q | single-hit | speculative | 2 |
| Senna | Dawning Shadow enemy beam | R | single-hit | plausible | 1 |
| Shaco | One isolated Jack in the Box | W | full-window | plausible | 2 |
| Singed | Five-second Poison Trail | Q | full-window | plausible | 2 |
| Skarner | Ixtal Impact wall slam | E | single-hit | plausible | 1 |
| Soraka | Low-health Wish per ally | R | heal | plausible | 1 |
| Syndra | Seven-sphere Unleashed Power | R | full-window | plausible | 3 |
| Talon | Melee Noxian Diplomacy | Q | single-hit | speculative | 2 |
| Thresh | Fully charged Flay passive | E | single-hit | plausible | 1 |
| Tryndamere | 100-Fury Bloodlust heal | Q | heal | speculative | 3 |
| Udyr | Awakened Wingborne Storm | R | full-window | speculative | 3 |
| Vayne | Tumble bonus attack damage | Q | single-hit | plausible | 1 |
| Vex | Shadow Surge arrival | R | single-hit | plausible | 2 |
| Viktor | Augmented Hextech Ray | E | full-window | plausible | 2 |
| Warwick | Jaws of the Beast bite | Q | single-hit | plausible | 1 |
| Xerath | Eye of Destruction center | W | single-hit | plausible | 1 |
| Yone | Critical Mortal Steel | Q | single-hit | speculative | 2 |
| Yuumi | Best Friend Zoomies shield | E | shield | plausible | 1 |
| Zed | Three first-target shurikens | Q | full-window | speculative | 3 |
| Zilean | Chronoshift revive health | R | heal | speculative | 2 |
| Trundle | Chomp pre-steal attack | Q | single-hit | plausible | 1 |
| Zac | Elastic Slingshot landing | E | single-hit | plausible | 1 |
| Udyr | ordinary Wilding Claw first empowered attack | Q | single-hit | plausible | 2 |
| Udyr | one awakened Q attack with isolated lightning | Q | single-hit | speculative | 3 |
| Sion | fully charged Decimating Smash | Q | single-hit | plausible | 1 |
| Gragas | Drunken Rage empowered attack bonus | W | single-hit | plausible | 1 |
| Volibear | marked Frenzied Maul second cast | W | single-hit | plausible | 0 |
| JarvanIV | Dragon Strike initial hit | Q | single-hit | plausible | 1 |
| DrMundo | Blunt Force Trauma empowered attack | E | single-hit | plausible | 0 |
| Malphite | Ground Slam armor and AP hit | E | single-hit | plausible | 0 |
| Poppy | Heroic Charge tackle plus wall collision | E | full-window | plausible | 2 |
| RekSai | maximum-Fury Furious Bite | E | single-hit | speculative | 3 |
| Blitzcrank | Power Fist empowered attack | E | single-hit | speculative | 2 |
| Camille | outer Tactical Sweep hit | W | single-hit | plausible | 1 |
| Diana | Moonsilver Blade third-attack magic bonus | P | single-hit | plausible | 1 |
| Ekko | Phase Dive magic bonus | E | single-hit | plausible | 1 |
| Fizz | Seastone Trident active bonus | W | single-hit | plausible | 1 |
| Garen | Decisive Strike attack | Q | single-hit | plausible | 1 |
| Gwen | fully stacked center Snip Snip | Q | full-window | plausible | 2 |
| Hecarim | maximum-travel Devastating Charge | E | single-hit | plausible | 1 |
| Illaoi | one Tentacle Smash slam | Q | single-hit | plausible | 2 |
| Kassadin | Nether Blade active magic bonus | W | single-hit | speculative | 2 |
| LeeSin | Resonating Strike second cast | Q:1 | single-hit | plausible | 1 |
| Lillia | outer Blooming Blows impact | Q | single-hit | plausible | 1 |
| Nidalee | hunted cougar Takedown | Q:1 | single-hit | speculative | 3 |
| Nunu | Consume champion damage | Q | single-hit | plausible | 1 |
| Renekton | 50-Fury Cull the Meek champion hit | Q | single-hit | plausible | 1 |
| Sett | one Knuckle Down empowered attack | Q | single-hit | plausible | 1 |
| Shaco | low-health Two-Shiv Poison | E | single-hit | plausible | 1 |
| Shen | one empowered Twilight Assault magic bonus | Q | single-hit | plausible | 1 |
| Shyvana | dragon-form Molten Burst impact | E | single-hit | speculative | 2 |
| Singed | Fling champion damage | E | single-hit | plausible | 1 |
