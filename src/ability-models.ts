import source from './ability-sources.json';
import type {Result,Scenario} from './types';
export type CastMode='cast-q'|'cast-w'|'cast-e'|'cast-r'|'cast-q-max'|'cast-q-isolated'|'cast-e-empowered'|'cast-q-empowered'|'cast-w-empowered'|'cast-r-empowered';
type Stats=Result['stats'];
type DamageType=Result['events'][number]['type'];
export interface Packet {name:string;type:DamageType;raw:number;time?:number;duration?:number}
interface StackInput {label:string;context:string;max:number}
export interface AbilityModel {label:string;slot:string;rankCap:number;cost:number[];costMultiplier?:number;sourcePath:string;notes:string;targetHealth?:boolean;defenseScaling?:boolean;healthCost?:(rank:number,stats:Stats,s:Scenario)=>number;stackInput?:StackInput;requiresStacks?:boolean;profile:'magic'|'physical'|'true'|'mixed';packets:(rank:number,stats:Stats,s:Scenario)=>Packet[]}
type Coefficient=number|number[];
const at=(values:Coefficient,rank:number)=>typeof values==='number'?values:values[rank-1];
const records=source.records as Record<string,Record<string,{name:string;cost:number[];path:string}>>;
const currentHP=(s:Scenario)=>s.targetHP*Math.min(100,Math.max(0,s.targetHealthPercent??100))/100;
const earnedStacks=(s:Scenario,max=1000000)=>Math.floor(Math.min(max,Math.max(0,s.abilityStacks??0)));
function spell(alias:string,slot:string,base:number[],ap:Coefficient,notes:string,options:{label?:string;profile?:AbilityModel['profile'];targetHealth?:boolean;defenseScaling?:boolean;healthCost?:(rank:number,stats:Stats,s:Scenario)=>number;stackInput?:StackInput;requiresStacks?:boolean;costMultiplier?:number;bonusAD?:Coefficient;totalAD?:Coefficient;bonusHP?:number;packets?:AbilityModel['packets']}={}):AbilityModel {
 const record=records[alias][slot];const type=options.profile==='physical'?'physical':options.profile==='true'?'true':'magic';
 return {label:options.label||`${slot} · ${record.name}`,slot,rankCap:base.length,cost:record.cost.map(v=>v*(options.costMultiplier??1)),costMultiplier:options.costMultiplier,sourcePath:record.path,notes,targetHealth:options.targetHealth,defenseScaling:options.defenseScaling,healthCost:options.healthCost,stackInput:options.stackInput,requiresStacks:options.requiresStacks,profile:options.profile||'magic',packets:options.packets||((rank,stats)=>[{name:record.name,type,raw:base[rank-1]+at(ap,rank)*stats.ap+at(options.bonusAD??0,rank)*stats.bonusAD+at(options.totalAD??0,rank)*stats.ad+(options.bonusHP||0)*stats.bonusHP}])};
}
const ornnUpgrades:StackInput={label:'Masterwork upgrades already completed',context:'earned Masterwork upgrades',max:5};
export const abilityModels:Record<string,Partial<Record<CastMode,AbilityModel>>>={
 Aphelios:{
  'cast-r':spell('Aphelios','R',[125,175,225],1,'Moonlight Vigil initial explosion only, physical damage despite AP scaling. Enter invested AD and lethality ranks; each grants 4 AD or 4.5 lethality. Weapon follow-up attacks, critical strikes, Infernum bonus and all weapon effects are excluded. Skill-point allocation is not validated.',{label:'R · Moonlight Vigil (initial explosion)',profile:'physical',bonusAD:.2,stackInput:{label:'Aphelios invested AD ranks',context:'invested AD ranks',max:6}}),
 },
 Briar:{
  'cast-e':spell('Briar','E',[80,115,150,185,220],1,'One Chilling Scream after a full one-second charge. Only the release packet is counted; healing, bleed, damage reduction, knockback and wall collision are excluded. This E has no upfront health cost.',{label:'E · Chilling Scream (fully charged release)',packets:(rank,stats)=>[{name:'Charged scream release',type:'magic',raw:[80,115,150,185,220][rank-1]+stats.bonusAD+stats.ap,time:1}]}),
  'cast-e-empowered':spell('Briar','E',[220,330,440,550,660],3.4,'Fully charged Chilling Scream release plus successful wall collision on this champion. Both impacts are approximated at one second. Bleed, healing, damage reduction and stun are excluded; this E has no upfront health cost.',{label:'E · Chilling Scream (full charge + wall)',packets:(rank,stats)=>[{name:'Charged scream release',type:'magic',raw:[80,115,150,185,220][rank-1]+stats.bonusAD+stats.ap,time:1},{name:'Wall collision',type:'magic',raw:[140,215,290,365,440][rank-1]+2.4*(stats.bonusAD+stats.ap),time:1}]}),
 },
 DrMundo:{
  'cast-q':spell('DrMundo','Q',[80,130,180,230,280],0,'One Infected Bonesaw on a champion, using enemy current HP with the champion minimum and no monster cap. Upfront health is reported before the on-hit health refund. Slow, refunds, E passive AD and R health changes are excluded; Q does not scale with own AP or AD.',{targetHealth:true,healthCost:rank=>[50,60,70,80,90][rank-1],packets:(rank,_stats,s)=>[{name:'Infected Bonesaw',type:'magic',raw:Math.max([80,130,180,230,280][rank-1],[.2,.225,.25,.275,.3][rank-1]*currentHP(s))}]}),
 },
 Jhin:{
  'cast-q':spell('Jhin','Q',[44,69,94,119,144],.6,'One first Dancing Grenade hit with no prior bounce kills. Whisper AD conversion includes level, purchased crit chance and item/shard/explicit bonus AS. Bounce amplification, fourth shot and item procs are excluded.',{label:'Q · Dancing Grenade (first hit)',profile:'physical',totalAD:[.44,.515,.59,.665,.74]}),
  'cast-w':spell('Jhin','W',[70,105,140,175,210],0,'One Deadly Flourish champion hit. Whisper AD conversion is included; root, marked-target setup and travel are excluded.',{profile:'physical',totalAD:.5}),
  'cast-e':spell('Jhin','E',[20,80,140,200,260],1,'One Captive Audience explosion after its trap is triggered; explosion time approximated at zero. Whisper AD conversion is included. Trap arming, slow, overlapping-trap penalties and death traps are excluded.',{label:'E · Captive Audience (one explosion)',profile:'magic',totalAD:1.2}),
  'cast-r':spell('Jhin','R',[64,128,192],0,'One of the first three Curtain Call bullets, with zero to 300% extra damage from enemy missing-health percentage. Full activation mana is charged. Fourth critical bullet, other bullets, channel timing and slow are excluded; Whisper AD conversion is included.',{label:'R · Curtain Call (one ordinary bullet)',profile:'physical',targetHealth:true,packets:(rank,stats,s)=>[{name:'Curtain Call ordinary bullet',type:'physical',raw:([64,128,192][rank-1]+.25*stats.ad)*(1+3*(1-currentHP(s)/s.targetHP))}]}),
 },
 Nilah:{
  'cast-q':spell('Nilah','Q',[0,10,20,30,40],0,'One Formless Blade active hit. Continuous crit-chance/crit-damage spell scaling and Q passive armor penetration are included. Does not roll an attack crit. Attack cone, attack-speed buff, lifesteal, shielding and item procs are excluded.',{profile:'physical',packets:(rank,stats)=>[{name:'Formless Blade',type:'physical',raw:([0,10,20,30,40][rank-1]+stats.ad)*(1+.7*stats.critChance*(stats.critDamage-1))}]}),
  'cast-e':spell('Nilah','E',[60,70,80,90,100],0,'One Slipstream dash hit. Q passive crit-derived armor penetration uses the explicit learned Q rank (zero means unlearned). Combined Q cast, second dash, attack and healing are excluded.',{profile:'physical',bonusAD:.2}),
 },
 Olaf:{
  'cast-e':spell('Olaf','E',[70,115,160,205,250],0,'One Reckless Swing true-damage hit. Reports the nonlethal health cost at 40% raw ability damage before kill refund. Ragnarok is inactive; its bonus AD, refund, cooldown-reset attacks and other spells are excluded.',{profile:'true',totalAD:.5,healthCost:(rank,stats)=>.4*([70,115,160,205,250][rank-1]+.5*stats.ad)}),
 },
 Pyke:{
  'cast-q':spell('Pyke','Q',[100,150,200,250,300],0,'One Bone Skewer champion hit. Gift of the Drowned Ones converts bonus HP to AD at 14:1; converted HP cannot also feed Bloodmail/Riftmaker HP conversions. Tap/charge travel, pull, slow, gray-health healing and item procs are excluded.',{profile:'physical',bonusAD:.75}),
  'cast-e':spell('Pyke','E',[100,150,200,250,300],0,'One Phantom Undertow phantom hit, assuming it successfully reaches this champion. Bonus HP-to-AD conversion is included. Travel is approximated at zero; stun duration, healing and following attacks are excluded.',{profile:'physical',bonusAD:1}),
 },
 Rell:{
  'cast-q':spell('Rell','Q',[60,100,140,180,220],.6,'One Shattering Strike spell packet against the supplied impact MR. Break the Mold new/repeated resistance steals are not simulated: enter measured impact MR when testing those interactions. Passive attack on-hit, shield break, stun and following spells are excluded.'),
  'cast-w':spell('Rell','W',[60,90,120,150,180],.6,'One mounted Crash Down impact against the supplied impact MR. Break the Mold resistance changes are not simulated; enter measured impact MR. Passive attack on-hit, dismounted defenses, shield, knockup and following attacks are excluded.',{label:'W · Crash Down (spell impact)'}),
 },
 Ryze:{
  'cast-q':spell('Ryze','Q',[75,95,115,135,155],.55,'One unfluxed Overload hit. Arcane Mastery adds 10% maximum mana per 100 AP; damage uses bonus maximum mana, not total or available mana. Spell Flux/R empowerment, rune discharge, shield and cooldown resets are excluded.',{label:'Q · Overload (unfluxed)',packets:(rank,stats)=>[{name:'Unfluxed Overload',type:'magic',raw:[75,95,115,135,155][rank-1]+.55*stats.ap+.02*stats.bonusMana}]}),
  'cast-w':spell('Ryze','W',[60,90,120,150,180],.6,'One Rune Prison hit, including Arcane Mastery maximum-mana growth and bonus-mana scaling. Flux/root, slow, cooldown resets and follow-up spells are excluded.',{packets:(rank,stats)=>[{name:'Rune Prison',type:'magic',raw:[60,90,120,150,180][rank-1]+.6*stats.ap+.03*stats.bonusMana}]}),
  'cast-e':spell('Ryze','E',[60,90,120,150,180],.5,'One initial Spell Flux hit, including Arcane Mastery and bonus-mana scaling. Spread targets, flux detonation, root and follow-up spells are excluded.',{packets:(rank,stats)=>[{name:'Spell Flux',type:'magic',raw:[60,90,120,150,180][rank-1]+.5*stats.ap+.02*stats.bonusMana}]}),
 },
 Sivir:{
  'cast-q':spell('Sivir','Q',[60,85,110,135,160],.6,'One Boomerang Blade pass on its first target. Continuous crit chance/damage spell scaling is included even in normal attack mode. Return pass, secondary-target falloff, passive movement and item procs are excluded.',{label:'Q · Boomerang Blade (one full-damage pass)',profile:'physical',packets:(rank,stats)=>[{name:'Boomerang Blade one pass',type:'physical',raw:([60,85,110,135,160][rank-1]+.7*stats.bonusAD+.6*stats.ap)*(1+.4*stats.critChance*(stats.critDamage-1))}]}),
  'cast-q-empowered':spell('Sivir','Q',[120,170,220,270,320],1.2,'Both Boomerang Blade passes hit this champion without prior-target falloff. Impact times are approximated together at zero. Continuous crit scaling is included; passive movement and item procs are excluded.',{label:'Q · Boomerang Blade (both full-damage passes)',profile:'physical',packets:(rank,stats)=>[{name:'Boomerang Blade both passes',type:'physical',raw:2*([60,85,110,135,160][rank-1]+.7*stats.bonusAD+.6*stats.ap)*(1+.4*stats.critChance*(stats.critDamage-1))}]}),
 },
 Taric:{
  'cast-e':spell('Taric','E',[90,130,170,210,250],.5,'One Dazzle beam after the one-second delay. Explicit learned W rank adds Bastion self armor before the bonus-armor scaling. No duplicated ally beam hit, Bravado attack, shield or stun simulation.',{defenseScaling:true,packets:(rank,stats)=>[{name:'Dazzle beam',type:'magic',raw:[90,130,170,210,250][rank-1]+.5*stats.ap+.5*stats.bonusArmor,time:1}]}),
 },
 Tryndamere:{
  'cast-e':spell('Tryndamere','E',[80,120,160,200,240],.8,'One Spinning Slash hit. Explicit learned Q rank grants missing-health AD, capped at 10% remaining health; no Q healing cast is performed. Fury crit chance, critical attacks, cooldown refunds and R survival are excluded.',{profile:'physical',bonusAD:1}),
 },
 Vladimir:{
  'cast-q':spell('Vladimir','Q',[80,100,120,140,160],.6,'One ordinary Transfusion. Crimson Pact converts external bonus HP to AP and external AP to HP without feeding its own bonuses back into each other. Crimson Rush, healing, Hemoplague amplification and item procs are excluded.'),
  'cast-q-empowered':spell('Vladimir','Q',[148,185,222,259,296],1.11,'Crimson Rush is already prepared: one empowered Transfusion at 185% ordinary damage. Crimson Pact nonrecursive stat conversion is included. Preparation casts, healing, Hemoplague and item procs are excluded.',{label:'Q · Transfusion (prepared Crimson Rush)'}),
 },
 Zac:{
  'cast-q':spell('Zac','Q',[60,90,120,150,180],.3,'One Stretching Strikes initial arm hit, with own bonus-HP scaling and 8% current-health upfront cost. Follow-up attack, second target, collision damage, blobs, healing and slow are excluded.',{bonusHP:.03,healthCost:(_rank,stats,s)=>.08*stats.hp*s.healthPercent/100}),
  'cast-w':spell('Zac','W',[40,50,60,70,80],0,'One Unstable Matter cast on a champion, including AP-scaled enemy maximum HP. Reports 4% own current-health upfront cost. Blobs, healing, cooldown refunds and minion caps are excluded.',{healthCost:(_rank,stats,s)=>.04*stats.hp*s.healthPercent/100,packets:(rank,stats,s)=>[{name:'Unstable Matter',type:'magic',raw:[40,50,60,70,80][rank-1]+([.04,.05,.06,.07,.08][rank-1]+.0003*stats.ap)*s.targetHP}]}),
  'cast-e':spell('Zac','E',[60,105,150,195,240],.8,'One Elastic Slingshot champion landing after a legally prepared charge, with impact approximated at zero. Reports 4% current-health upfront cost; charge movement, refunds, blobs, healing and knockup are excluded.',{healthCost:(_rank,stats,s)=>.04*stats.hp*s.healthPercent/100}),
  'cast-r':spell('Zac','R',[120,190,260],.4,'One first Let\'s Bounce hit on this champion. No upfront health cost. Later bounces, W casts, blobs, healing and knockback are excluded.',{label:'R · Let\'s Bounce (first hit)'}),
  'cast-r-empowered':spell('Zac','R',[300,475,650],1,'Four Let\'s Bounce hits on the same champion at times 0, 1, 2 and 3s; subsequent hits deal 50% damage. No upfront health cost. W casts, blobs, healing and knockback are excluded.',{label:'R · Let\'s Bounce (four hits)',packets:(rank,stats)=>[0,1,2,3].map(time=>({name:`Bounce ${time+1}`,type:'magic',raw:([120,190,260][rank-1]+.4*stats.ap)*(time? .5:1),time}))}),
 },
 KSante:{
  'cast-q':spell('KSante','Q',[70,100,130,160,190],0,'Base form Ntofo Strikes: one hit uses own bonus armor and bonus MR, excluding base defenses. All Out, Dauntless Instinct mark attack, shockwave setup and following attacks are excluded.',{label:'Q · Ntofo Strikes (base form)',profile:'physical',defenseScaling:true,packets:(rank,stats)=>[{name:'Ntofo Strikes',type:'physical',raw:[70,100,130,160,190][rank-1]+.4*(stats.bonusArmor+stats.bonusMR)}]}),
  'cast-w':spell('KSante','W',[45,75,105,135,165],0,'Base form Path Maker released after a legal charge: one hit includes enemy maximum HP scaling from own bonus defenses. Charge/ram travel is approximated at time zero. All Out true damage, mark attack, defensive reduction, stun and following attacks are excluded.',{label:'W · Path Maker (base form release)',profile:'physical',defenseScaling:true,packets:(rank,stats,s)=>[{name:'Path Maker release',type:'physical',raw:[45,75,105,135,165][rank-1]+(.08+.0002*(stats.bonusArmor+stats.bonusMR))*s.targetHP}]}),
 },
 Ornn:{
  'cast-q':spell('Ornn','Q',[20,45,70,95,120],0,'One Volcanic Rupture hit. Living Forge bonus HP/resistance amplification uses already earned Masterwork count. Upgraded item stat allocations are not generated automatically; enter their extra stats explicitly before champion amplification. Brittle, pillar and slow are excluded.',{profile:'physical',totalAD:1.1,stackInput:ornnUpgrades}),
  'cast-w':spell('Ornn','W',[80,130,180,230,280],0,'One Bellows Breath cone, uniformly prorated over 0.75s. Uses the larger of champion minimum damage and rank-dependent enemy maximum HP. Brittle application is not detonated. Living Forge uses earned upgrades; actual Masterwork item stat allocations, Brittle proc, attack and unstoppable are excluded.',{label:'W · Bellows Breath (cone only)',stackInput:ornnUpgrades,packets:(rank,_stats,s)=>[{name:'Bellows Breath observed damage',type:'magic',raw:Math.max([80,130,180,230,280][rank-1],[.12,.13,.14,.15,.16][rank-1]*s.targetHP),duration:.75}]}),
  'cast-e':spell('Ornn','E',[80,125,170,215,260],0,'One Searing Charge or terrain shockwave hit per champion; they do not double hit. Own bonus armor and bonus MR include Living Forge amplification from earned upgrades. Actual Masterwork item stat allocations must be entered explicitly before amplification. Base defenses, Brittle proc and knockup are excluded.',{profile:'physical',defenseScaling:true,stackInput:ornnUpgrades,packets:(rank,stats)=>[{name:'Searing Charge',type:'physical',raw:[80,125,170,215,260][rank-1]+.4*(stats.bonusArmor+stats.bonusMR)}]}),
  'cast-r':spell('Ornn','R',[125,175,225],.2,'One first-pass Call of the Forge God hit on a target without Brittle. Second pass, Brittle proc, travel and slow are excluded. Living Forge uses earned upgrades; actual Masterwork item stat allocations must be entered explicitly before champion amplification.',{label:'R · Call of the Forge God (first pass)',stackInput:ornnUpgrades}),
 },
 Rammus:{
  'cast-q':spell('Rammus','Q',[80,120,160,200,240],1,'One Powerball champion collision without W active. Spiked Shell resistance-to-AD is included in stats, but does not scale this AP packet. W defenses, movement buildup, slow and following attacks are excluded.'),
  'cast-w':spell('Rammus','W',[15,15,15,15,15],0,'Defensive Ball Curl is activated and one enemy champion attack triggers one retaliation. The selected W rank boosts own armor/MR before this packet and Spiked Shell AD. No repeated attacks, recast detonation, incoming damage simulation, Thornmail or item on-hit effects are included.',{label:'W · Defensive Ball Curl (one triggered retaliation)',defenseScaling:true,packets:(_rank,stats)=>[{name:'Defensive Ball Curl retaliation',type:'magic',raw:15+.1*(stats.armor+stats.mr)}]}),
  'cast-r':spell('Rammus','R',[150,250,350],.6,'One ordinary Soaring Slam landing without Powerball or W active. Powerball collision, enhanced knockup, aftershock pulses, slow and following attacks are excluded. Spiked Shell AD is included in stats but does not scale this AP packet.',{label:'R · Soaring Slam (ordinary initial landing)'}),
 },
 Udyr:{
  'cast-q':spell('Udyr','Q',[6,12,18,24,30,36],0,'Ordinary Claw Stance is cast and one of its first two noncritical attacks hits. Includes physical delivery, ordinary stance on-hit, own bonus HP and enemy max-HP bonus. Awaken, lightning, second attack, attack-speed timing, Monk Training and item on-hits are excluded.',{label:'Q · Wilding Claw (one ordinary empowered attack)',profile:'physical',packets:(rank,stats,s)=>[{name:'Claw delivery attack (noncritical)',type:'physical',raw:stats.ad},{name:'Claw ordinary on-hit',type:'physical',raw:[6,12,18,24,30,36][rank-1]+.2*stats.bonusAD+[.01,.012,.014,.016,.018,.02][rank-1]*stats.bonusHP},{name:'Claw first-two attack max HP',type:'physical',raw:([.03,.04,.05,.06,.07,.08][rank-1]+.00035*stats.bonusAD)*s.targetHP}]}),
  'cast-r':spell('Udyr','R',[80,144,208,272,336,400],1.4,'One ordinary Wingborne Storm, uniformly prorated over four seconds while this champion remains nearby. All six learned ranks are supported. Awaken max-HP damage, stance attack pulses, slow, attack timing and other stances are excluded.',{label:'R · Wingborne Storm (ordinary observed field)',packets:(rank,stats)=>[{name:'Wingborne Storm observed damage',type:'magic',raw:4*([20,36,52,68,84,100][rank-1]+.35*stats.ap),duration:4}]}),
 },
 Annie:{
  'cast-q':spell('Annie','Q',[80,125,170,215,260],.8,'One Disintegrate hit. Learned R magic penetration is included at the supplied passive rank. Kill refunds, stun, Tibbers and following spells are excluded.'),
  'cast-w':spell('Annie','W',[70,110,150,190,230],.8,'One Incinerate cone hit. Learned R magic penetration is included at the supplied passive rank. Stun, Tibbers and following spells are excluded.'),
  'cast-e':spell('Annie','E',[25,35,45,55,65],.4,'One Molten Shield retaliation against this champion, assuming they trigger it while the shield is active. Learned R penetration is included. Shield, movement, Tibbers shield, additional attackers and additional retaliation are excluded.',{label:'E · Molten Shield (one triggered retaliation)'}),
  'cast-r':spell('Annie','R',[150,275,400],.75,'One Tibbers summon impact. Learned R magic penetration uses the selected R rank. Tibbers attacks, burning aura, enrage, stun and following spells are excluded.',{label:'R · Summon: Tibbers (initial impact)'}),
 },
 Mordekaiser:{
  'cast-e':spell('Mordekaiser','E',[60,80,100,120,140],.45,'One Death\'s Grasp hit. E passive magic penetration uses the selected E rank. Pull travel is approximated at time zero; Darkness Rise, passive attack damage, Realm of Death stat stealing and following attacks are excluded.'),
 },
 Ambessa:{
  'cast-w':spell('Ambessa','W',[50,75,100,125,150],0,'One ordinary Repudiation strike without blocking damage. Learned R armor penetration is included at the supplied passive rank. Shield, energy refunds, Drakehound attacks, empowered strike condition and healing are excluded.',{label:'W · Repudiation (ordinary strike)',profile:'physical',bonusAD:.5}),
  'cast-w-empowered':spell('Ambessa','W',[75,112.5,150,187.5,225],0,'Repudiation has already blocked qualifying damage: one enhanced strike at 150%. Learned R armor penetration is included. Block setup, shield, energy refunds, Drakehound attacks and healing are excluded.',{label:'W · Repudiation (prepared enhanced strike)',profile:'physical',bonusAD:.75}),
  'cast-e':spell('Ambessa','E',[40,60,80,100,120],0,'One initial Lacerate strike. Learned R armor penetration is included at the supplied passive rank. Additional dash-triggered strike, passive attack, slow, energy refund and healing are excluded.',{label:'E · Lacerate (initial strike)',profile:'physical',bonusAD:.5}),
  'cast-r':spell('Ambessa','R',[150,250,350],0,'One successful Public Execution slam. Learned armor penetration uses the selected R rank. Blink travel is approximated at time zero; suppression, stun, healing, passive attack and energy restoration are excluded.',{profile:'physical',bonusAD:.8}),
 },
 Zaahen:{
  'cast-w':spell('Zaahen','W',[40,60,80,100,120],0,'One initial Dreaded Return strike. Learned R armor penetration is included. Determination automatic AD, return hit, pull, stack generation and following attacks are excluded; enter already earned Determination AD through Extra AD.',{label:'W · Dreaded Return (initial strike)',profile:'physical',bonusAD:.5}),
  'cast-e':spell('Zaahen','E',[40,60,80,100,120],0,'One inner Aureate Rush slice. Learned R armor penetration is included. Edge maximum-HP magic damage, Determination automatic AD, travel and following attacks are excluded; enter existing Determination AD through Extra AD.',{label:'E · Aureate Rush (inner slice)',profile:'physical',bonusAD:.5}),
  'cast-e-empowered':spell('Zaahen','E',[60,90,120,150,180],0,'One outer-edge Aureate Rush slice: 150% physical packet plus rank-dependent enemy maximum-HP magic damage. R armor penetration applies only to physical damage. Automatic Determination AD, travel and following attacks are excluded; enter existing Determination AD through Extra AD.',{label:'E · Aureate Rush (outer edge)',profile:'mixed',packets:(rank,stats,s)=>[{name:'Aureate Rush edge physical',type:'physical',raw:1.5*([40,60,80,100,120][rank-1]+.5*stats.bonusAD)},{name:'Aureate Rush edge max HP',type:'magic',raw:[.04,.045,.05,.055,.06][rank-1]*s.targetHP}]}),
  'cast-r':spell('Zaahen','R',[250,400,550],0,'One Grim Deliverance landing hit. Learned armor penetration uses selected R rank. Cast travel is approximated at time zero; healing, damage reduction, revive, automatic Determination AD and following attacks are excluded; enter existing Determination AD through Extra AD.',{profile:'physical',bonusAD:2}),
 },
 Hecarim:{
  'cast-w':spell('Hecarim','W',[80,120,160,200,240],.8,'One Spirit of Dread field, uniformly prorated over four seconds while the target stays in range. Healing, defensive stats, Warpath movement-to-AD conversion and other spells are excluded; Warpath AD does not scale this packet.',{label:'W · Spirit of Dread (observed field)',packets:(rank,stats)=>[{name:'Spirit of Dread observed damage',type:'magic',raw:[80,120,160,200,240][rank-1]+.8*stats.ap,duration:4}]}),
  'cast-r':spell('Hecarim','R',[150,250,350],1,'One Onslaught of Shadows spectral rider hit on this champion. Travel is approximated at time zero; fear, other targets, following attacks and Warpath movement-to-AD conversion are excluded. Warpath AD does not scale this packet.'),
 },
 Rengar:{
  'cast-w':spell('Rengar','W',[50,80,110,140,170],.8,'One ordinary Battle Roar hit, without Ferocity empowerment. Healing, cleanse, Ferocity generation, Bonetooth AD conversion and following attacks are excluded; Bonetooth AD does not scale this packet.',{label:'W · Battle Roar (ordinary hit)'}),
  'cast-e':spell('Rengar','E',[55,100,145,190,235],0,'One ordinary Bola Strike. Automatic Bonetooth bonus AD is excluded; enter already earned bonus AD through Extra AD. Ferocity empowerment, root, stack generation and following attacks are excluded.',{label:'E · Bola Strike (ordinary hit)',profile:'physical',bonusAD:.8}),
 },
 Senna:{
  'cast-q':spell('Senna','Q',[30,55,80,105,130],0,'One Piercing Darkness enemy hit, using bonus AD. Enter earned soul AD through Extra AD; automatic soul growth, soul extraction, passive bonus damage, item on-hits, healing and slow are excluded.',{profile:'physical',bonusAD:.6}),
  'cast-w':spell('Senna','W',[70,110,150,190,230],0,'One Last Embrace projectile hit. Enter earned soul AD through Extra AD; automatic soul growth, root, passive extraction and following attacks are excluded.',{profile:'physical',bonusAD:.9}),
  'cast-r':spell('Senna','R',[250,400,550],.7,'One Dawning Shadow central enemy hit. Enter earned soul AD through Extra AD; automatic soul growth, shielding, passive extraction and travel are excluded.',{profile:'physical',bonusAD:1.15}),
 },
 Skarner:{
  'cast-q':spell('Skarner','Q',[10,20,30,40,50],0,'One Upheaval boulder throw, including 11% enemy maximum HP. Prior empowered attacks, Threads of Vibration, attack delivery damage, slow and monster caps are excluded. Uses bonus AD and own bonus HP.',{label:'Q · Upheaval (boulder throw)',profile:'physical',packets:(rank,stats,s)=>[{name:'Upheaval boulder',type:'physical',raw:[10,20,30,40,50][rank-1]+.9*stats.bonusAD+.03*stats.bonusHP+.11*s.targetHP}]}),
  'cast-w':spell('Skarner','W',[50,70,90,110,130],.8,'One Seismic Bastion shockwave. Shield, slow, Threads of Vibration and following attacks are excluded.'),
  'cast-e':spell('Skarner','E',[30,60,90,120,150],0,'A champion is successfully pinned into terrain. One wall impact uses bonus AD and own total maximum HP. Charge travel is approximated at time zero; suppression, stun, cooldown refunds and Threads of Vibration are excluded.',{label:"E · Ixtal's Impact (successful wall pin)",profile:'physical',packets:(rank,stats)=>[{name:'Wall pin',type:'physical',raw:[30,60,90,120,150][rank-1]+1.2*stats.bonusAD+.06*stats.hp}]}),
  'cast-r':spell('Skarner','R',[150,250,350],1,'One Impale hit with no Q boulder held. Automatic Q throw, Threads of Vibration, suppression, movement and other targets are excluded.'),
 },
 Rumble:{
  'cast-q':spell('Rumble','Q',[50,75,100,125,150],1.05,'Ordinary Flamespitter with the target staying in the cone, uniformly prorated over three seconds. Includes enemy maximum HP damage. Heat generation, Overheat attacks, burn tick rounding and other spells are excluded; assumes a legal cast outside Danger Zone.',{label:'Q · Flamespitter (ordinary cone)',packets:(rank,stats,s)=>[{name:'Flamespitter observed damage',type:'magic',raw:[50,75,100,125,150][rank-1]+1.05*stats.ap+[.06,.065,.07,.075,.08][rank-1]*s.targetHP,duration:3}]}),
  'cast-q-empowered':spell('Rumble','Q',[75,112.5,150,187.5,225],1.575,'Danger Zone is already prepared and this cast is legal. Both flat and enemy maximum HP components multiply by 1.5, uniformly prorated over three seconds in the cone. Heat setup, Overheat attacks, tick rounding and other spells are excluded.',{label:'Q · Flamespitter (prepared Danger Zone)',packets:(rank,stats,s)=>[{name:'Danger Zone Flamespitter',type:'magic',raw:1.5*([50,75,100,125,150][rank-1]+1.05*stats.ap+[.06,.065,.07,.075,.08][rank-1]*s.targetHP),duration:3}]}),
  'cast-r':spell('Rumble','R',[540,900,1260],1.575,'One Equalizer trail with the target staying inside, uniformly prorated over 4.5 seconds. Danger Zone does not amplify R. Landing travel, slow, tick rounding and E resistance reduction are excluded.',{label:'R · The Equalizer (observed trail)',packets:(rank,stats)=>[{name:'Equalizer observed damage',type:'magic',raw:4.5*([120,200,280][rank-1]+.35*stats.ap),duration:4.5}]}),
 },
 Zoe:{
  'cast-w':spell('Zoe','W',[15,25,35,45,55],.1,'A summoner spell or collected spell shard has already triggered Spell Thief. Scores one missile only. The triggering spell, other missiles, More Sparkles attack, movement speed and pickup setup are excluded.',{label:'W · Spell Thief (one prepared missile)'}),
  'cast-e':spell('Zoe','E',[70,110,150,190,230],.45,'One initial Sleepy Trouble Bubble hit on an awake target before sleep resistance reduction. Drowsy, sleep, subsequent MR reduction, wake-up true damage and follow-up spells are excluded.',{label:'E · Sleepy Trouble Bubble (initial hit)'}),
 },
 Darius:{
  'cast-r':spell('Darius','R',[125,250,375],0,'One Noxian Guillotine with zero to five existing Hemorrhage stacks. Each stack adds 20% damage. Stack setup damage, Noxian Might automatic bonus AD, bleed ticks and reset casts are excluded; enter any already active Noxian Might AD through Extra AD.',{profile:'true',stackInput:{label:'Existing Hemorrhage stacks',context:'existing Hemorrhage stacks',max:5},packets:(rank,stats,s)=>[{name:'Noxian Guillotine',type:'true',raw:([125,250,375][rank-1]+.75*stats.bonusAD)*(1+.2*earnedStacks(s,5))}]}),
 },
 Akshan:{
  'cast-q':spell('Akshan','Q',[45,75,105,135,165],0,'One Avengerang pass on this champion. Dirty Fighting passive, return pass, range extension and movement are excluded.',{label:'Q · Avengerang (one pass)',profile:'physical',bonusAD:.7}),
  'cast-q-empowered':spell('Akshan','Q',[90,150,210,270,330],0,'Both Avengerang passes hit this champion. Impact times are approximated together at zero; Dirty Fighting passive, travel timing and movement are excluded.',{label:'Q · Avengerang (both passes)',profile:'physical',bonusAD:1.4}),
 },
 AurelionSol:{
  'cast-e':spell('AurelionSol','E',[50,75,100,125,150],.6,'One Singularity field with the target remaining inside, uniformly prorated over 5s. Stardust generation, execution threshold, drag and Q damage are excluded.',{label:'E · Singularity (observed field damage)',packets:(rank,stats)=>[{name:'Singularity field',type:'magic',raw:5*([10,15,20,25,30][rank-1]+.12*stats.ap),duration:5}]}),
  'cast-r':spell('AurelionSol','R',[150,250,350],.75,'One ordinary Falling Star impact. Landing travel, Stardust generation, stun and other targets are excluded.',{label:'R · Falling Star (ordinary impact)'}),
  'cast-r-empowered':spell('AurelionSol','R',[187.5,312.5,437.5],.9375,'The Skies Descend is already prepared from earned Stardust. Scores its central impact at 125% ordinary damage; preparation, shockwave damage, Stardust generation and knockup are excluded.',{label:'R · The Skies Descend (prepared central impact)'}),
 },
 Azir:{
  'cast-q':spell('Azir','Q',[75,95,115,135,155],[.35,.4,.45,.5,.55],'One Conquering Sands hit with a soldier already placed. Soldier summon cost, soldier attacks, additional soldier hits, slow and travel are excluded.'),
  'cast-e':spell('Azir','E',[70,110,150,190,230],.6,'One Shifting Sands champion collision with a soldier already placed. Soldier summon cost, shield, charge generation, travel and following attacks are excluded.'),
  'cast-r':spell('Azir','R',[200,400,600],.75,'One Emperor\'s Divide impact. Displacement, wall duration, soldier attacks and following spells are excluded.'),
 },
 Belveth:{
  'cast-q':spell('Belveth','Q',[12,14,16,18,20],0,'One Void Surge dash hit. On-hits, passive true-damage attack stacks, True Form stat changes, cooldowns and other directions are excluded.',{profile:'physical',totalAD:1.05}),
  'cast-w':spell('Belveth','W',[80,140,200,260,320],1.5,'One Above and Below hit. Knockup, slow, directional Q reset, True Form stat changes and following attacks are excluded.'),
  'cast-r':spell('Belveth','R',[150,200,250],1.5,'A Void Coral is already available. One consumption explosion adds 20% enemy missing HP as true damage. Coral setup, True Form bonus HP and resulting item conversions, Lavender growth, slow and attack passive are excluded.',{label:'R · Endless Banquet (prepared Coral explosion)',profile:'true',targetHealth:true,packets:(rank,stats,s)=>[{name:'Endless Banquet explosion',type:'true',raw:[150,200,250][rank-1]+1.5*stats.ap+.2*(s.targetHP-currentHP(s))}]}),
 },
 Gnar:{
  'cast-q':spell('Gnar','Q',[5,45,85,125,165],0,'Mini Gnar boomerang on its first target, once per champion. Hyper proc, return damage duplication, catch refund, Mega transformation stats and slow are excluded.',{label:'Q · Boomerang Throw (Mini Gnar)',profile:'physical',totalAD:1.25}),
  'cast-w':spell('Gnar','W',[0,10,20,30,40],1,'Mini Gnar has two Hyper marks already on this champion. One noncritical attack delivers physical AD plus the third-hit magic proc. Setup hits, item on-hits, critical strikes, movement and Mega transformation are excluded.',{label:'W · Hyper (prepared third attack)',profile:'mixed',packets:(rank,stats,s)=>[{name:'Delivery attack (noncritical)',type:'physical',raw:stats.ad},{name:'Hyper magic proc',type:'magic',raw:[0,10,20,30,40][rank-1]+stats.ap+[.06,.08,.1,.12,.14][rank-1]*s.targetHP}]}),
  'cast-e':spell('Gnar','E',[50,85,120,155,190],0,'Mini Gnar bounce onto this champion, using total maximum HP. Hyper proc, attack-speed buff, further bounce, travel, slow and Mega transformation stats are excluded.',{label:'E · Hop (Mini Gnar bounce)',profile:'physical',packets:(rank,stats)=>[{name:'Hop bounce',type:'physical',raw:[50,85,120,155,190][rank-1]+.06*stats.hp}]}),
 },
 Gwen:{
  'cast-q':spell('Gwen','Q',[70,99,128,157,186],.4,'Zero prior Snip Snip stacks: one small snip and the final snip hit outside the center. All magic damage; center true conversion and A Thousand Cuts application, healing, stack setup and attack on-hits are excluded. Snip impact times are approximated together.',{label:'Q · Snip Snip! (zero stacks, outer area)'}),
  'cast-q-max':spell('Gwen','Q',[110,155,200,245,290],.6,'Four Snip Snip stacks are already prepared: five small snips and the final snip hit outside the center. All magic damage; center true conversion and A Thousand Cuts, setup attacks, healing and snip timing are excluded.',{label:'Q · Snip Snip! (four stacks, outer area)'}),
 },
 Jayce:{
  'cast-q':spell('Jayce','Q',[60,110,160,210,260,310],0,'Hammer-form To the Skies impact, supporting all six learned ranks. Transform attack, cannon spells, on-hits, travel and slow are excluded.',{label:'Q · To the Skies! (hammer form)',profile:'physical',bonusAD:1.35}),
  'cast-w':spell('Jayce','W',[140,200,260,320,380,440],1,'Hammer-form Lightning Field with this champion staying in range. Damage is uniformly prorated over 4s; hammer mana-refund attacks, cannon attacks and transformation effects are excluded.',{label:'W · Lightning Field (hammer form)',packets:(rank,stats)=>[{name:'Lightning Field observed damage',type:'magic',raw:[140,200,260,320,380,440][rank-1]+stats.ap,duration:4}]}),
  'cast-e':spell('Jayce','E',[0,0,0,0,0,0],0,'Hammer-form Thundering Blow magic hit with bonus AD plus rank-dependent enemy maximum HP. Cannon gate, transform attack, monster caps, knockback and later damage are excluded.',{label:'E · Thundering Blow (hammer form)',packets:(rank,stats,s)=>[{name:'Thundering Blow',type:'magic',raw:stats.bonusAD+[.08,.108,.136,.164,.192,.22][rank-1]*s.targetHP}]}),
 },
 Kayn:{
  'cast-q':spell('Kayn','Q',[150,210,270,330,390],0,'Untransformed Kayn: both Reaping Slash dash and sweep hit this champion. Impact times are approximated together; Shadow Assassin bonus, Rhaast replacement, monster bonuses and movement are excluded.',{label:'Q · Reaping Slash (base form, both hits)',profile:'physical',bonusAD:1.7}),
  'cast-w':spell('Kayn','W',[85,130,175,220,265],0,'Untransformed Blade\'s Reach hit. Shadow Assassin bonus, Rhaast knockup, healing and slow are excluded.',{label:'W · Blade\'s Reach (base form)',profile:'physical',bonusAD:1.1}),
  'cast-r':spell('Kayn','R',[150,250,350],0,'Base-form Umbral Trespass exit damage on a champion already damaged by Kayn. Prior damage, infestation time, Shadow Assassin bonus, Rhaast replacement and healing are excluded.',{label:'R · Umbral Trespass (base form exit)',profile:'physical',bonusAD:1.5}),
  'cast-r-empowered':spell('Kayn','R',[0,0,0],0,'Rhaast form and an eligible previously damaged champion are already prepared. Exit deals 15% + 0.1% per bonus AD of enemy maximum HP. Base-form flat damage is replaced. Setup, infestation time, healing and Shadow Assassin effects are excluded.',{label:'R · Umbral Trespass (Rhaast exit)',profile:'physical',packets:(_rank,stats,s)=>[{name:'Rhaast Umbral Trespass exit',type:'physical',raw:(.15+.001*stats.bonusAD)*s.targetHP}]}),
 },
 Locke:{
  'cast-q':spell('Locke','Q',[40,48,56,64,72],.2,'One Soul Nail missile hit. Other nails, nail consumption/detonation, Silver Stake attack on-hit and slow are excluded.',{label:'Q · Soul Nails (one missile)'}),
  'cast-e':spell('Locke','E',[40,50,60,70,80],.4,'Teleport arrival hit on a target without existing Soul Nails. Subsequent dash attack, Silver Stake on-hit, nail consumption, travel and resets are excluded.',{label:'E · Teleport (arrival hit)'}),
  'cast-r':spell('Locke','R',[150,225,300],.6,'Initial binding artifact impact only. Seal/execute threshold, earned execution stacks, mark extension, Silver Stake attacks and cooldown refunds are excluded.',{label:'R · Binding artifact (initial impact)'}),
 },
 MasterYi:{
  'cast-q':spell('MasterYi','Q',[20,40,60,80,100],0,'One noncritical Alpha Strike hit on this champion. Other strikes, critical strikes, Wuju Style, on-hit effects, untargetability and cooldown refunds are excluded.',{label:'Q · Alpha Strike (one noncritical hit)',profile:'physical',totalAD:.7}),
  'cast-q-isolated':spell('MasterYi','Q',[35,70,105,140,175],0,'All four noncritical Alpha Strike hits land on one isolated champion: first full damage and three additional hits at 25%. Impact times are approximated together. Critical strikes, Wuju Style, item on-hits and refunds are excluded.',{label:'Q · Alpha Strike (isolated, noncritical)',profile:'physical',totalAD:1.225}),
  'cast-e':spell('MasterYi','E',[20,25,30,35,40],0,'One noncritical attack during Wuju Style, including physical delivery and the true-damage bonus. Double Strike, Alpha Strike interactions, critical strikes, item on-hits, repeat attacks and attack timing are excluded.',{label:'E · Wuju Style (one noncritical attack)',profile:'mixed',packets:(rank,stats)=>[{name:'Delivery attack (noncritical)',type:'physical',raw:stats.ad},{name:'Wuju Style true damage',type:'true',raw:[20,25,30,35,40][rank-1]+.35*stats.bonusAD}]}),
 },
 Mel:{
  'cast-q':spell('Mel','Q',[60,85,110,135,160],.55,'First Radiant Volley explosion only. Other projectiles, Searing Brilliance attack projectiles, Overwhelm stacks/execute and monster bonuses are excluded.',{label:'Q · Radiant Volley (first explosion)'}),
  'cast-q-max':spell('Mel','Q',[85,127,173,223,277],1,'All rank-dependent Radiant Volley projectiles hit the champion: first explosion plus reduced later explosions. Impact times are approximated together; channel timing, attack projectiles and Overwhelm execute are excluded.',{label:'Q · Radiant Volley (all explosions)',packets:(rank,stats)=>[{name:'Radiant Volley full barrage',type:'magic',raw:[60,85,110,135,160][rank-1]+.55*stats.ap+([6,7,8,9,10][rank-1]-1)*([5,7,9,11,13][rank-1]+.05*stats.ap)}]}),
  'cast-e':spell('Mel','E',[60,105,150,195,240],.7,'Initial Solar Snare orb hit only. Surrounding area damage, root, slow, attack projectiles and Overwhelm execute are excluded.',{label:'E · Solar Snare (initial orb)'}),
  'cast-r':spell('Mel','R',[125,200,275],.3,'Requires at least one existing Overwhelm stack on this champion. Scores only active Golden Eclipse damage at impact, with entered prior stacks. Passive execution threshold/damage, automatic new stacks, stack setup and other targets are excluded.',{label:'R · Golden Eclipse (prepared Overwhelm)',stackInput:{label:'Existing Overwhelm stacks',context:'prepared Overwhelm stacks',max:1000000},requiresStacks:true,packets:(rank,stats,s)=>[{name:'Golden Eclipse active damage',type:'magic',raw:[125,200,275][rank-1]+.3*stats.ap+earnedStacks(s)*([4,7,10][rank-1]+.04*stats.ap)}]}),
 },
 Shyvana:{
  'cast-w':spell('Shyvana','W',[80,100,120,140,160],.65,'One human-form shield detonation at impact after prior activation, break or recast. Shield duration/value, healing, movement, Dragon Form stats and attacks are excluded.',{label:'W · Human-form shield detonation'}),
  'cast-e':spell('Shyvana','E',[50,65,80,95,110],[.6,.65,.7,.75,.8],'One human-form fireball explosion including 5% enemy maximum HP. Dragon Form, trail damage, repeat impacts, slow and attacks are excluded.',{label:'E · Human-form fireball',packets:(rank,stats,s)=>[{name:'Human-form fireball',type:'magic',raw:[50,65,80,95,110][rank-1]+[.6,.65,.7,.75,.8][rank-1]*stats.ap+.05*s.targetHP}]}),
  'cast-e-empowered':spell('Shyvana','E',[50,65,80,95,110],[.6,.65,.7,.75,.8],'Dragon Form is already active. One fireball pulse deals 125% of the human-form packet, including maximum-HP damage. Trail/repeat impacts, transformation bonus HP and item conversions, Fury generation and slow are excluded.',{label:'E · Dragon-form fireball (one pulse)',packets:(rank,stats,s)=>[{name:'Dragon-form fireball pulse',type:'magic',raw:1.25*([50,65,80,95,110][rank-1]+[.6,.65,.7,.75,.8][rank-1]*stats.ap+.05*s.targetHP)}]}),
  'cast-r':spell('Shyvana','R',[150,250,350],1,'Transformation is already ready from existing Dragon Fury. One Dragon\'s Descent fire-breath hit; Fury generation/drain, travel, fear, transformation bonus HP and resulting item conversions are excluded.',{label:'R · Dragon\'s Descent (ready transformation hit)'}),
 },
 Smolder:{
  'cast-w':spell('Smolder','W',[60,70,80,90,100],0,'Initial Achooo! impact only. Champion-hit explosion, Dragon Practice magic damage, slow and item procs are excluded.',{label:'W · Achooo! (initial impact)',profile:'physical',bonusAD:.6}),
  'cast-r':spell('Smolder','R',[150,250,350],1,'Mom\'s breath outer-area hit. Center bonus, healing, slow, travel and Dragon Practice effects are excluded.',{label:'R · MMOOOMMMM! (outer area)',profile:'physical',bonusAD:1}),
  'cast-r-empowered':spell('Smolder','R',[225,375,525],1.5,'Mom\'s breath center hit at 150% of the ordinary physical packet. Healing, slow, travel and Dragon Practice effects are excluded.',{label:'R · MMOOOMMMM! (center)',profile:'physical',bonusAD:1.5}),
 },
 Twitch:{'cast-e':spell('Twitch','E',[20,30,40,50,60],0,'Requires existing Deadly Venom on this champion. Contaminate deals base physical damage plus a bonus AD physical packet and AP magic packet per existing stack, up to six. Venom setup/ongoing true damage, R bonus AD, automatic new stacks and other targets are excluded.',{label:'E · Contaminate (prepared Venom)',profile:'mixed',stackInput:{label:'Existing Deadly Venom stacks',context:'prepared Venom stacks',max:6},requiresStacks:true,packets:(rank,stats,s)=>{const count=earnedStacks(s,6);return [{name:'Contaminate physical',type:'physical',raw:[20,30,40,50,60][rank-1]+count*([15,20,25,30,35][rank-1]+.35*stats.bonusAD)},{name:'Contaminate magic',type:'magic',raw:count*.35*stats.ap}]}})},
 Urgot:{
  'cast-q':spell('Urgot','Q',[25,70,115,160,205],0,'One Corrosive Charge impact. Echoing Flames, mark follow-up, slow, travel and attacks are excluded.',{profile:'physical',totalAD:.7}),
  'cast-w':spell('Urgot','W',[12,12,12,12,12],0,'Exactly one noncritical Purge shot, charging the full initial W mana cost. Echoing Flames knees, item on-hits, further shots, mark targeting and slow resistance are excluded.',{label:'W · Purge (one shot)',profile:'physical',totalAD:[.2,.235,.27,.305,.34]}),
  'cast-e':spell('Urgot','E',[90,120,150,180,210],0,'One Disdain champion collision. Shield, displacement, stun, Echoing Flames and following attacks are excluded.',{profile:'physical',bonusAD:1}),
  'cast-r':spell('Urgot','R',[100,225,350],0,'Initial Fear Beyond Death drill hit only. Recast execute, suppression, fear, slow, Echoing Flames and later attacks are excluded.',{label:'R · Fear Beyond Death (initial drill)',profile:'physical',bonusAD:.5}),
 },
 Viego:{'cast-w':spell('Viego','W',[80,135,190,245,300],1,'One Spectral Maw missile hit. Charge changes stun duration, not this damage packet. Charge/travel time, Q passive/mark attacks, item on-hits, possession and stun are excluded.')},
 MonkeyKing:{
  'cast-e':spell('MonkeyKing','E',[80,120,160,200,240],1,'One Nimbus Strike magic hit on this champion. Other targets, clone attacks, attack-speed buff, Q armor reduction and following attacks are excluded.'),
  'cast-r':spell('MonkeyKing','R',[0,0,0],0,'One Cyclone cast with this champion staying in range for up to 2s. Total AD plus enemy maximum-HP damage is uniformly prorated; clone damage, second cast, Q armor reduction, knockup and movement are excluded.',{label:'R · Cyclone (one cast, observed damage)',profile:'physical',packets:(rank,stats,s)=>[{name:'Cyclone observed damage',type:'physical',raw:2*(1.375*stats.ad+[.04,.06,.08][rank-1]*s.targetHP),duration:2}]}),
 },
 Yunara:{
  'cast-q':spell('Yunara','Q',[3,8,13,18,23],.2,'Eight Unleash are already prepared. One noncritical primary-target attack during Q, including normal physical AD delivery, the passive magic on-hit and equal additional active magic on-hit. Initial Q mana is charged; preparation, critical passive, spread, R and other item on-hits are excluded.',{label:'Q · Cultivation of Spirit (prepared attack)',profile:'mixed',packets:(rank,stats)=>[{name:'Delivery attack (noncritical)',type:'physical',raw:stats.ad},{name:'Q passive magic on-hit',type:'magic',raw:[3,8,13,18,23][rank-1]+.2*stats.ap},{name:'Q active magic on-hit',type:'magic',raw:[3,8,13,18,23][rank-1]+.2*stats.ap}]}),
  'cast-w':spell('Yunara','W',[55,95,135,175,215],.5,'Ordinary prayer bead initial hit only. Lingering damage, Transcendent laser, critical-strike passive, slow and other targets are excluded.',{label:'W · Arc of Judgment (ordinary initial hit)',bonusAD:.85}),
 },
 Yuumi:{
  'cast-q':spell('Yuumi','Q',[60,95,130,165,200,235],.2,'One ordinary Prowling Projectile impact, supporting all six ranks. Accelerated attached missile, Best Friend allied on-hit, healing, shield and slow are excluded.',{label:'Q · Prowling Projectile (ordinary missile)'}),
  'cast-q-empowered':spell('Yuumi','Q',[80,135,190,245,300,355],.3,'One accelerated attached Prowling Projectile impact. Attachment/flight setup is already complete; Best Friend allied on-hit, healing and slow are excluded.',{label:'Q · Prowling Projectile (accelerated attached missile)'}),
  'cast-r':spell('Yuumi','R',[75,125,175],.25,'Exactly one Final Chapter wave hits this champion, charging the full initial R mana cost. Other waves, channel timing, allied healing/shields and slow are excluded.',{label:'R · Final Chapter (one wave)'}),
 },
 Zeri:{
  'cast-w':spell('Zeri','W',[30,70,110,150,190],.5,'One Ultrashock Laser pulse without a terrain collision. Wall critical strike, excess attack-speed-to-AD conversion, passive attacks, slow and travel are excluded.',{label:'W · Ultrashock Laser (no terrain)',profile:'physical',totalAD:1}),
  'cast-r':spell('Zeri','R',[150,250,350],1.1,'Initial Lightning Crash nova only. Overcharge, chained shots, excess attack-speed-to-AD conversion, movement and following attacks are excluded.',{label:'R · Lightning Crash (initial nova)',bonusAD:.6}),
 },
 Camille:{
  'cast-q':spell('Camille','Q',[0,0,0,0,0],0,'First noncritical Precision Protocol attack, including normal delivery AD once. Second attack, critical strikes, item on-hits, Spellblade, passive shield and movement are excluded.',{label:'Q · Precision Protocol (first attack)',profile:'physical',totalAD:[1.2,1.25,1.3,1.35,1.4]}),
  'cast-q-empowered':spell('Camille','Q',[0,0,0,0,0],0,'Second noncritical Precision Protocol attack, with at least 1.5s already elapsed after Q1. Includes normal attack AD and doubled Q bonus, then converts 40% + 4% per level after level one, capped at 100%, into true damage. Charges the initial Q mana cost once; Q1 damage, Spellblade, on-hits and critical strikes are excluded.',{label:'Q · Precision Protocol (prepared second attack)',profile:'mixed',packets:(rank,stats,s)=>{const raw=stats.ad*(1+2*[.2,.25,.3,.35,.4][rank-1]),fraction=Math.min(1,.4+.04*(Math.min(18,Math.max(1,s.level))-1));return [{name:'Precision Protocol remaining physical',type:'physical',raw:raw*(1-fraction)},{name:'Precision Protocol converted true damage',type:'true',raw:raw*fraction}]}}),
  'cast-w':spell('Camille','W',[60,85,110,135,160],0,'Inner Tactical Sweep impact only, scored after its windup. Outer maximum-HP bonus, healing, slow and movement are excluded.',{label:'W · Tactical Sweep (inner area)',profile:'physical',bonusAD:.6}),
  'cast-w-empowered':spell('Camille','W',[60,85,110,135,160],0,'Outer Tactical Sweep impact, including enemy maximum HP damage with bonus AD scaling. Windup is outside the scored impact; healing, slow and movement are excluded.',{label:'W · Tactical Sweep (outer edge)',profile:'physical',packets:(rank,stats,s)=>[{name:'Tactical Sweep outer edge',type:'physical',raw:[60,85,110,135,160][rank-1]+.6*stats.bonusAD+([.07,.075,.08,.085,.09][rank-1]+.00025*stats.bonusAD)*s.targetHP}]}),
  'cast-e':spell('Camille','E',[60,90,120,150,180],0,'One Wall Dive champion collision, paying the full E cost. Prior hookshot travel, attack-speed buff, stun and following attacks are excluded.',{label:'E · Wall Dive (champion collision)',profile:'physical',bonusAD:.75}),
 },
 Fiora:{
  'cast-q':spell('Fiora','Q',[70,80,90,100,110],0,'One Lunge hit that does not strike a Vital. Vital true damage, item on-hits, healing, movement and cooldown refund are excluded.',{profile:'physical',bonusAD:[.9,.95,1,1.05,1.1]}),
  'cast-w':spell('Fiora','W',[110,150,190,230,270],1,'One Riposte stab impact after its parry preparation. Damage prevention, stun/slow, Vital damage and attacks are excluded.'),
 },
 Gangplank:{
  'cast-q':spell('Gangplank','Q',[10,40,70,100,130],0,'One noncritical Parrrley hit using total AD. Trial by Fire, Powder Keg explosions, critical strikes, Spellblade, item on-hits, gold and Silver Serpents are excluded.',{label:'Q · Parrrley (noncritical)',profile:'physical',totalAD:1}),
  'cast-r':spell('Gangplank','R',[40,70,100],.1,'Exactly one ordinary Cannon Barrage wave hits this champion, with the full initial R mana cost. Other waves, upgrades including Death\'s Daughter, slow and placement/travel time are excluded.',{label:'R · Cannon Barrage (one wave)'}),
 },
 Illaoi:{
  'cast-w':spell('Illaoi','W',[0,0,0,0,0],0,'One noncritical Harsh Lesson attack: normal AD delivery plus the total-AD-dependent enemy maximum-HP bonus. Nearby tentacle slams, spirit transfer, critical strikes, item on-hits and healing are excluded.',{label:'W · Harsh Lesson (attack only)',profile:'physical',packets:(rank,stats,s)=>[{name:'Harsh Lesson attack',type:'physical',raw:stats.ad+([.03,.035,.04,.045,.05][rank-1]+.00035*stats.ad)*s.targetHP}]}),
  'cast-r':spell('Illaoi','R',[150,250,350],0,'Initial Leap of Faith impact only. Spawned/existing tentacle slams, spirit transfer, healing and following attacks are excluded.',{label:'R · Leap of Faith (initial impact)',profile:'physical',bonusAD:.5}),
 },
 Irelia:{
  'cast-q':spell('Irelia','Q',[5,25,45,65,85],0,'One Bladesurge hit with Ionian Fervor not fully stacked. Passive on-hit, item on-hits, mark reset, healing and minion bonus are excluded.',{profile:'physical',totalAD:.8}),
  'cast-w':spell('Irelia','W',[10,20,30,40,50],.5,'Minimum-charge Defiant Dance release, scored at impact. Charge bonus, defensive reduction, passive and attacks are excluded.',{label:'W · Defiant Dance (minimum charge)',profile:'physical',totalAD:.4}),
  'cast-w-empowered':spell('Irelia','W',[30,60,90,120,150],1.5,'Maximum-damage Defiant Dance release, with charge preparation already completed before the scored impact. Defensive reduction, passive and attacks are excluded.',{label:'W · Defiant Dance (maximum damage)',profile:'physical',totalAD:1.2}),
  'cast-e':spell('Irelia','E',[70,110,150,190,230],1,'One Flawless Duet convergence hit, paying the E cost once. Initial blade placement, passive on-hit, mark reset, stun and attacks are excluded.'),
  'cast-r':spell('Irelia','R',[125,200,275],1,'Initial Vanguard\'s Edge missile hit only. Crossing the cage, passive on-hit, mark reset and following attacks are excluded.',{label:'R · Vanguard\'s Edge (initial missile)'}),
 },
 Kaisa:{
  'cast-q':spell('Kaisa','Q',[40,55,70,85,100],.2,'One Icathian Rain missile hits this champion. Other missiles, evolved count, Plasma and item procs are excluded.',{label:'Q · Icathian Rain (one missile)',profile:'physical',bonusAD:.55}),
  'cast-q-isolated':spell('Kaisa','Q',[90,123.75,157.5,191.25,225],.45,'All six ordinary missiles hit an isolated champion: first full damage, five additional hits at 25%, totaling 2.25 times one missile. Impact times are approximated together. Raw calculation tree and source MaxDamage confirm the multiplier despite misleading rendered parentheses. Plasma and item procs are excluded.',{label:'Q · Icathian Rain (six isolated missiles)',profile:'physical',bonusAD:1.2375}),
  'cast-q-empowered':spell('Kaisa','Q',[150,206.25,262.5,318.75,375],.75,'Q is already evolved and all twelve missiles hit an isolated champion: first full damage, eleven at 25%, totaling 3.75 times one missile. Evolution is not earned automatically; setup and other targets, Plasma and item procs are excluded. Impact times are approximated together.',{label:'Q · Icathian Rain (evolved, twelve isolated missiles)',profile:'physical',bonusAD:2.0625}),
  'cast-w':spell('Kaisa','W',[30,55,80,105,130],.45,'One Void Seeker spell packet on a champion without prior Plasma stacks. Plasma on-hit/detonation, evolved stack count/refund, travel and vision are excluded.',{totalAD:1.3}),
 },
 Kalista:{
  'cast-q':spell('Kalista','Q',[10,75,140,205,270],0,'One Pierce hit using total AD. Rend spear transfer, Oathsworn proc, dash, preceding attacks and minion passthrough are excluded.',{profile:'physical',totalAD:1.05}),
  'cast-e':spell('Kalista','E',[5,15,25,35,45],.65,'Rend requires at least one spear already embedded in this champion. First spear uses the base packet; each additional spear adds its own total AD/AP packet, capped at the exported 254 spears. Spear setup damage, mana refunds, resets, slow and other targets are excluded.',{label:'E · Rend (prepared spears)',profile:'physical',stackInput:{label:'Existing Rend spears',context:'prepared Rend spears',max:254},requiresStacks:true,packets:(rank,stats,s)=>[{name:'Rend prepared spears',type:'physical',raw:[5,15,25,35,45][rank-1]+.7*stats.ad+.65*stats.ap+Math.max(0,earnedStacks(s,254)-1)*([7,14,21,28,35][rank-1]+[.2,.275,.35,.425,.5][rank-1]*stats.ad+.5*stats.ap)}]}),
 },
 Kled:{
  'cast-q':spell('Kled','Q',[30,55,80,105,130],0,'Mounted Bear Trap initial hit only. Tether yank, dismounted pistol, Courage/remounting and Skaarl health pools are excluded.',{label:'Q · Bear Trap on a Rope (initial hit)',profile:'physical',bonusAD:.6}),
  'cast-q-empowered':spell('Kled','Q',[30,55,80,105,130],0,'Mounted Bear Trap hit followed by a retained tether yank at 1.75s. The yank deals twice the initial packet. Slow, Courage/remounting, dismounted pistol and Skaarl health pools are excluded.',{label:'Q · Bear Trap on a Rope (tether retained)',profile:'physical',packets:(rank,stats)=>{const raw=[30,55,80,105,130][rank-1]+.6*stats.bonusAD;return [{name:'Bear Trap initial',type:'physical',raw},{name:'Bear Trap yank',type:'physical',raw:2*raw,time:1.75}]}}),
  'cast-e':spell('Kled','E',[35,60,85,110,135],0,'One mounted Jousting dash hit. Recast, Courage/remounting, movement and Skaarl health pools are excluded.',{profile:'physical',bonusAD:.55}),
  'cast-r':spell('Kled','R',[0,0,0],0,'Minimum-distance Chaaaaaaaarge ram on one champion, dealing enemy maximum-HP magic damage. Prior travel, shield, knockback, Courage and Skaarl health pools are excluded.',{label:'R · Chaaaaaaaarge!!! (minimum distance)',packets:(rank,stats,s)=>[{name:'Charge minimum-distance ram',type:'magic',raw:([.04,.06,.08][rank-1]+.0003*stats.bonusAD)*s.targetHP}]}),
  'cast-r-empowered':spell('Kled','R',[0,0,0],0,'Maximum-distance ram, tripling the minimum-distance enemy maximum-HP packet. Prior travel, shield, knockback, Courage and Skaarl health pools are excluded.',{label:'R · Chaaaaaaaarge!!! (maximum distance)',packets:(rank,stats,s)=>[{name:'Charge maximum-distance ram',type:'magic',raw:3*([.04,.06,.08][rank-1]+.0003*stats.bonusAD)*s.targetHP}]}),
 },
 Naafiri:{
  'cast-q':spell('Naafiri','Q',[35,40,45,50,55],0,'First Darkin Daggers hit plus uniformly prorated five-second bleed. Recast and remaining-bleed cashout, Packmate attacks, W bonus AD, healing and item procs are excluded.',{label:'Q · Darkin Daggers (first cast and bleed)',profile:'physical',packets:(rank,stats)=>[{name:'Darkin Daggers initial',type:'physical',raw:[35,40,45,50,55][rank-1]+.2*stats.bonusAD},{name:'Darkin Daggers bleed',type:'physical',raw:[35,60,85,110,135][rank-1]+.8*stats.bonusAD,duration:5}]}),
  'cast-e':spell('Naafiri','E',[15,25,35,45,55],0,'Both E slashes hit this champion, with impact times approximated together at zero. Packmate attacks, W bonus AD, healing and movement are excluded.',{profile:'physical',packets:(rank,stats)=>[{name:'Eviscerate first slash',type:'physical',raw:[15,25,35,45,55][rank-1]+.4*stats.bonusAD},{name:'Eviscerate second slash',type:'physical',raw:[60,85,110,135,160][rank-1]+.8*stats.bonusAD}]}),
  'cast-r':spell('Naafiri','R',[125,200,275],0,'One champion dash hit from Naafiri herself. Packmate dash damage, W bonus AD, recast, shield, resets and travel are excluded.',{label:'R · Hounds\' Pursuit (Naafiri hit only)',profile:'physical',bonusAD:1}),
 },
 Qiyana:{
  'cast-q':spell('Qiyana','Q',[80,110,140,170,200],0,'Ordinary Edge of Ixtal without an elemental bonus. Royal Privilege is assumed unavailable; its proc, elemental effects, W on-hit and other targets are excluded.',{label:'Q · Edge of Ixtal (ordinary slash)',profile:'physical',bonusAD:.9}),
  'cast-e':spell('Qiyana','E',[50,90,130,170,210],0,'One Audacity hit with Royal Privilege unavailable. Passive proc, W on-hit, dash travel and following spells are excluded.',{profile:'physical',bonusAD:.5}),
  'cast-r':spell('Qiyana','R',[100,200,300],0,'One successful terrain/river/brush explosion, adding 10% enemy maximum HP. Royal Privilege is unavailable; passive proc, setup travel, displacement and stun are excluded.',{profile:'physical',packets:(rank,stats,s)=>[{name:'Supreme Display of Talent explosion',type:'physical',raw:[100,200,300][rank-1]+1.25*stats.bonusAD+.1*s.targetHP}]}),
 },
 Samira:{
  'cast-q':spell('Samira','Q',[0,5,10,15,20],0,'One ranged noncritical Flair hit. Melee Daredevil Impulse damage, critical strikes, Style generation and lifesteal are excluded.',{label:'Q · Flair (ranged, noncritical)',profile:'physical',totalAD:1.1}),
  'cast-w':spell('Samira','W',[20,35,50,65,80],0,'Blade Whirl hits at zero and again at 0.75s if the enemy stays in range. Style generation, missile destruction and following attacks are excluded.',{profile:'physical',packets:(rank,stats)=>{const raw=[20,35,50,65,80][rank-1]+.5*stats.bonusAD;return [{name:'Blade Whirl first slash',type:'physical',raw},{name:'Blade Whirl second slash',type:'physical',raw,time:.75}]}}),
  'cast-e':spell('Samira','E',[50,60,70,80,90],0,'One Wild Rush magic hit using bonus AD. Attack-speed buff, Style generation, melee passive, resets and following attacks are excluded.',{bonusAD:.2}),
 },
 Trundle:{'cast-q':spell('Trundle','Q',[10,30,50,70,90],0,'One noncritical Chomp attack using pre-hit total AD. The subsequent stolen AD is not added back to this hit. Later attacks, critical strikes, item on-hits, slow and healing are excluded.',{label:'Q · Chomp (pre-steal attack)',profile:'physical',totalAD:[1.15,1.25,1.35,1.45,1.55]})},
 Varus:{
  'cast-q':spell('Varus','Q',[80*.66667,150*.66667,220*.66667,290*.66667,360*.66667],0,'Minimum-charge Piercing Arrow on the first target, using the exported 0.66667 multiplier. No existing Blight and W is not active; Blight/W detonation, passthrough reduction, charge time and attack procs are excluded.',{label:'Q · Piercing Arrow (minimum charge)',profile:'physical',bonusAD:1.2*.66667}),
  'cast-q-max':spell('Varus','Q',[80,150,220,290,360],0,'Fully charged Piercing Arrow on the first target, with charge setup completed before the scored impact. No existing Blight and W is not active; Blight/W detonation, passthrough reduction and attack procs are excluded.',{label:'Q · Piercing Arrow (maximum charge)',profile:'physical',bonusAD:1.2}),
  'cast-e':spell('Varus','E',[60,90,120,150,180],0,'One Hail of Arrows hit on a target without existing Blight. Blight detonation, slow field, Grievous Wounds and following attacks are excluded.',{profile:'physical',bonusAD:.9}),
  'cast-r':spell('Varus','R',[150,250,350],1,'One initial Chain of Corruption hit. Blight stack generation/detonation, spread to other champions, root and following attacks are excluded.'),
 },
 Xayah:{
  'cast-q':spell('Xayah','Q',[90,120,150,180,210],0,'Both Double Daggers hit this champion as the first target, with impact times approximated together. Passthrough reduction, Clean Cuts, feather recall and attacks are excluded.',{label:'Q · Double Daggers (both, first target)',profile:'physical',bonusAD:1}),
  'cast-r':spell('Xayah','R',[200,300,400],0,'One Featherstorm dagger wave after 1.5s airborne. Earlier windows score no hit but spend initial mana. Untargetability, Clean Cuts, feather recall and attacks are excluded.',{profile:'physical',packets:(rank,stats)=>[{name:'Featherstorm dagger wave',type:'physical',raw:[200,300,400][rank-1]+stats.bonusAD,time:1.5}]}),
 },
 Yorick:{
  'cast-q':spell('Yorick','Q',[30,50,70,90,110],0,'One noncritical Last Rites attack including normal AD delivery and the Q bonus. Healing, graves, Mist Walkers, Maiden mark, critical strikes and item on-hits are excluded.',{label:'Q · Last Rites (noncritical attack)',profile:'physical',totalAD:1.5}),
  'cast-e':spell('Yorick','E',[0,0,0,0,0],0,'One Mourning Mist impact with an AP-dependent enemy maximum-HP term. Mark armor reduction on later damage, Mist Walker leaps/attacks, Maiden, slow and movement are excluded.',{packets:(rank,stats,s)=>[{name:'Mourning Mist',type:'magic',raw:([.06,.065,.07,.075,.08][rank-1]+.0003*stats.ap)*s.targetHP}]}),
 },
 Yasuo:{
  'cast-q':spell('Yasuo','Q',[20,45,70,95,120],0,'One noncritical Steel Tempest spell hit. Item on-hits, critical strikes and excess-crit-to-AD conversion, Flow shield, Gathering Storm stacks and following attacks are excluded.',{label:'Q · Steel Tempest (noncritical)',profile:'physical',totalAD:1.05}),
  'cast-e':spell('Yasuo','E',[70,85,100,115,130],.6,'One Sweeping Blade with zero prior dash damage stacks. Stack ramp, critical-stat conversions, Flow and following attacks are excluded.',{label:'E · Sweeping Blade (zero prior stacks)',bonusAD:.2}),
  'cast-e-empowered':spell('Yasuo','E',[140,170,200,230,260],1.2,'Four Sweeping Blade damage stacks are already present, doubling this dash packet. Setup dash damage, critical-stat conversions, Flow, per-target cooldown and following attacks are excluded.',{label:'E · Sweeping Blade (four prior stacks)',bonusAD:.4}),
  'cast-r':spell('Yasuo','R',[200,350,500],0,'Enemy is already airborne. One Last Breath damage hit; knockup setup, following critical-strike bonus armor penetration, excess-crit AD conversion, Flow and attacks are excluded.',{profile:'physical',bonusAD:1.5}),
 },
 Yone:{
  'cast-q':spell('Yone','Q',[25,50,75,100,125],0,'One noncritical Mortal Steel spell hit. Item on-hits, critical strikes and excess-crit AD conversion, knockup preparation, E damage repeat and alternating attack passive are excluded.',{label:'Q · Mortal Steel (noncritical)',profile:'physical',totalAD:1.1}),
  'cast-w':spell('Yone','W',[10,20,30,40,50],0,'One champion Spirit Cleave hit, split evenly between physical and magic damage, using the exported BaseDamage and MaxHealthDamage values and champion tooltip. The unrelated WDamage AD helper is not used. Shield, E repeat and critical-stat conversions are excluded.',{profile:'mixed',packets:(rank,_stats,s)=>{const raw=([10,20,30,40,50][rank-1]+[.08,.09,.1,.11,.12][rank-1]*s.targetHP)/2;return [{name:'Spirit Cleave physical half',type:'physical',raw},{name:'Spirit Cleave magic half',type:'magic',raw}]}}),
  'cast-r':spell('Yone','R',[200,400,600],0,'One Fate Sealed hit split evenly between physical and magic. E damage repeat, displacement, knockup, prior travel, excess-crit AD conversion and attacks are excluded.',{profile:'mixed',packets:(rank,stats)=>{const raw=([200,400,600][rank-1]+.8*stats.bonusAD)/2;return [{name:'Fate Sealed physical half',type:'physical',raw},{name:'Fate Sealed magic half',type:'magic',raw}]}}),
 },
 Kayle:{
  'cast-q':spell('Kayle','Q',[60,90,120,150,180],.5,'One Radiant Blast hit before its armor/MR reduction affects subsequent damage. Shred follow-up, E on-hit, level-based waves, passive stacks and slow are excluded.',{bonusAD:.6}),
  'cast-r':spell('Kayle','R',[200,300,400],.7,'One Divine Judgment sword explosion, scored at impact after prior casting preparation. Invulnerability timing, passive attacks/waves and other targets are excluded.',{label:'R · Divine Judgment (sword impact)',bonusAD:1}),
 },
 KogMaw:{
  'cast-q':spell('KogMaw','Q',[80,125,170,215,260],.9,'One Caustic Spittle impact before its resistance shred affects later damage. Shred follow-up, attack-speed passive, W on-hit and death passive are excluded.'),
  'cast-w':spell('KogMaw','W',[0,0,0,0,0],0,'One noncritical attack during Bio-Arcane Barrage, including normal physical delivery plus AP-dependent enemy maximum-HP magic damage. The full W activation mana cost is charged. Other attacks, Q resistance shred, critical strikes and item on-hits are excluded.',{label:'W · Bio-Arcane Barrage (one noncritical attack)',profile:'mixed',packets:(rank,stats,s)=>[{name:'Delivery attack (noncritical)',type:'physical',raw:stats.ad},{name:'Bio-Arcane Barrage bonus',type:'magic',raw:([.03,.0375,.045,.0525,.06][rank-1]+.00015*stats.ap)*s.targetHP}]}),
  'cast-e':spell('KogMaw','E',[70,110,150,190,230],.65,'One Void Ooze impact. Trail slow, Q resistance shred, W attacks and death passive are excluded.'),
  'cast-r':spell('KogMaw','R',[100,140,180],[.35,.4,.45],'One Living Artillery impact with zero prior mana-cost stacks, costing 40 mana. Damage ramps by the exported 0.83333% per 1% missing HP at or above 40% starting HP, and doubles strictly below 40%. Prior shots, repeated-cost ramp, impact travel, Q shred and death passive are excluded.',{label:'R · Living Artillery (first-cost shot)',targetHealth:true,packets:(rank,stats,s)=>{const hp=Math.min(100,Math.max(0,s.targetHealthPercent??100)),raw=[100,140,180][rank-1]+[.35,.4,.45][rank-1]*stats.ap+.75*stats.bonusAD;return [{name:'Living Artillery',type:'magic',raw:raw*(hp<40?2:1+.0083333*(100-hp))}]}}),
 },
 Kindred:{
  'cast-q':spell('Kindred','Q',[40,65,90,115,140],0,'One Dance of Arrows hit on this champion. Other targets, mark attack-speed benefits, W cooldown changes, E proc, attacks and healing are excluded.',{profile:'physical',bonusAD:.75}),
  'cast-w':spell('Kindred','W',[25,30,35,40,45],.2,'Exactly one Wolf bite, including earned Mark scaling on enemy current HP. The full W activation mana cost is charged. Earned marks are supplied, not generated; repeated bites, preceding Lamb attack damage, E proc and healing are excluded.',{label:'W · Wolf\'s Frenzy (one bite)',targetHealth:true,stackInput:{label:'Earned Mark of the Kindred stacks',context:'earned Kindred marks',max:1000000},packets:(rank,stats,s)=>[{name:'Wolf\'s Frenzy bite',type:'magic',raw:[25,30,35,40,45][rank-1]+.2*stats.bonusAD+.2*stats.ap+(.015+.01*earnedStacks(s))*currentHP(s)}]}),
 },
 Aurora:{
  'cast-q':spell('Aurora','Q',[45,70,95,120,145],.4,'Initial Twofold Hex hit only. Recast missing-health damage, Spirit Abjuration passive and other targets are excluded.',{label:'Q · Twofold Hex (initial hit)'}),
  'cast-e':spell('Aurora','E',[80,120,160,200,240],.7,'One The Weirding hit. Passive detonation, movement and slow are excluded.'),
  'cast-r':spell('Aurora','R',[175,275,375],.7,'One landing pulse. Passive detonation, realm hopping, boundary slow and travel are excluded.'),
 },
 Bard:{'cast-q':spell('Bard','Q',[80,120,160,200,240],.8,'One Cosmic Binding hit on this champion. Wall/second-target stun, meeps, chime bonuses and attacks are excluded.')},
 Heimerdinger:{
  'cast-w':spell('Heimerdinger','W',[50,75,100,125,150],.55,'One ordinary rocket hits this champion. Other rockets, turret charge, turret attacks and UPGRADE are excluded.',{label:'W · Hextech Micro-Rockets (one rocket)'}),
  'cast-w-empowered':spell('Heimerdinger','W',[90,135,180,225,270],1.03,'All five ordinary rockets hit this champion, with the reduced additional-hit damage. Impacts are approximated together at zero. This is not R-upgraded W; turret attacks and charge follow-up are excluded.',{label:'W · Hextech Micro-Rockets (all five)'}),
  'cast-e':spell('Heimerdinger','E',[60,100,140,180,220],.6,'One ordinary grenade impact. Turret attacks, charge follow-up, stun, slow and R upgrade are excluded.'),
 },
 Hwei:{
  'cast-q':spell('Hwei','Q',[50,80,110,140,170],.8,'QQ Devastating Fire only, including its rank-dependent enemy maximum HP term. Other Q paintings, Signature of the Visionary passive and WE bonus lights are excluded.',{label:'QQ · Devastating Fire',packets:(rank,stats,s)=>[{name:'Devastating Fire',type:'magic',raw:[50,80,110,140,170][rank-1]+.8*stats.ap+[.03,.04,.05,.06,.07][rank-1]*s.targetHP}]}),
  'cast-e':spell('Hwei','E',[70,110,150,190,230],.65,'EQ Grim Visage impact only. Other E paintings, fear, passive detonation and WE bonus lights are excluded.',{label:'EQ · Grim Visage'}),
  'cast-r':spell('Hwei','R',[200,325,450],.8,'Spiraling Despair attached at zero: uniformly prorated burn over 3s and final explosion at 3s if the window permits it. Missile travel, passive detonation, WE lights and slow are excluded.',{packets:(rank,stats)=>[{name:'Spiraling Despair burn',type:'magic',raw:3*([10,20,30][rank-1]+.05*stats.ap),duration:3},{name:'Spiraling Despair explosion',type:'magic',raw:[200,325,450][rank-1]+.8*stats.ap,time:3}]}),
 },
 Nasus:{
  'cast-q':spell('Nasus','Q',[30,50,70,90,110],0,'One noncritical Siphoning Strike attack, including delivery AD once and your finite earned Q damage stacks. Stacks are not AD. Stack generation, critical strikes, lifesteal, Spellblade and other on-hits are excluded.',{label:'Q · Siphoning Strike (earned stacks)',profile:'physical',stackInput:{label:'Earned Siphoning Strike stacks',context:'earned Q stacks',max:1000000},packets:(rank,stats,s)=>[{name:'Siphoning Strike attack',type:'physical',raw:stats.ad+[30,50,70,90,110][rank-1]+earnedStacks(s)}]}),
  'cast-e':spell('Nasus','E',[50,80,110,140,170],.6,'Initial Spirit Fire damage plus a five-second field, uniformly prorated inside the window while the target remains in it. Armor shred, ultimate stats, Q attacks and passive lifesteal are excluded.',{packets:(rank,stats)=>[{name:'Spirit Fire initial',type:'magic',raw:[50,80,110,140,170][rank-1]+.6*stats.ap},{name:'Spirit Fire field',type:'magic',raw:5*([10,16,22,28,34][rank-1]+.12*stats.ap),duration:5}]}),
 },
 Nidalee:{
  'cast-q':spell('Nidalee','Q',[70,90,110,130,150],.5,'Human javelin at minimum damage distance. Hunted setup, cougar follow-up, travel time and attacks are excluded.',{label:'Q · Javelin Toss (minimum distance)'}),
  'cast-q-max':spell('Nidalee','Q',[227.5,292.5,357.5,422.5,487.5],1.625,'Human javelin at maximum damage distance, multiplying the base packet by 3.25. Prior flight is outside the scored impact. Hunted and cougar follow-up are excluded.',{label:'Q · Javelin Toss (maximum distance)'}),
  'cast-w':spell('Nidalee','W',[40,80,120,160,200],.2,'One human trap triggers at zero and deals uniformly prorated damage over 4s. Placement/arming time, Hunted effects, repeat traps and cougar follow-up are excluded.',{label:'W · Bushwhack (triggered trap)',packets:(rank,stats)=>[{name:'Bushwhack poison',type:'magic',raw:4*([10,20,30,40,50][rank-1]+.05*stats.ap),duration:4}]}),
 },
 Sona:{
  'cast-q':spell('Sona','Q',[50,85,120,155,190],.4,'One direct Hymn of Valor bolt on this champion. Aura on-hit, Power Chord, allied damage, other targets and Accelerando generation are excluded.'),
  'cast-r':spell('Sona','R',[150,250,350],.5,'One Crescendo hit. Stun, aura effects, Power Chord and following attacks are excluded.'),
 },
 Swain:{
  'cast-q':spell('Swain','Q',[60,90,120,150,180],.45,'One Death\'s Hand bolt hits. Other bolts, soul collection, healing and ultimate damage are excluded.',{label:'Q · Death\'s Hand (one bolt)'}),
  'cast-q-max':spell('Swain','Q',[120,180,240,300,360],.9,'All five Death\'s Hand bolts hit this champion: first full damage, four additional bolts at 25% each. Soul collection, healing and ultimate damage are excluded.',{label:'Q · Death\'s Hand (all five bolts)'}),
  'cast-w':spell('Swain','W',[70,115,160,205,250],.6,'Vision of Empire explodes at 1.5s. Earlier windows score no hit but spend mana. Soul HP, healing, reveal and slow are excluded.',{packets:(rank,stats)=>[{name:'Vision of Empire',type:'magic',raw:[70,115,160,205,250][rank-1]+.6*stats.ap,time:1.5}]}),
  'cast-e':spell('Swain','E',[90,130,170,210,250],.7,'One Nevermove returning-wave detonation. Outgoing travel, pull, soul collection, healing and root are excluded.',{label:'E · Nevermove (return detonation)'}),
 },
 Sylas:{
  'cast-q':spell('Sylas','Q',[40,60,80,100,120],.4,'Initial Chain Lash only. Intersection explosion, Petricite Burst, slow and following attacks are excluded.',{label:'Q · Chain Lash (initial hit)'}),
  'cast-q-empowered':spell('Sylas','Q',[40,60,80,100,120],.4,'Initial chain hit and intersection explosion at 0.6s, assuming the champion remains in the intersection. Petricite Burst, slow and following attacks are excluded.',{label:'Q · Chain Lash (with intersection explosion)',packets:(rank,stats)=>[{name:'Chain Lash initial',type:'magic',raw:[40,60,80,100,120][rank-1]+.4*stats.ap},{name:'Chain Lash explosion',type:'magic',raw:[60,115,170,225,280][rank-1]+.8*stats.ap,time:.6}]}),
  'cast-w':spell('Sylas','W',[75,110,145,180,215],.6,'One Kingslayer damage hit. Healing, Petricite Burst, dash and following attacks are excluded.'),
  'cast-e':spell('Sylas','E',[80,130,180,230,280],.8,'One Abduct chain hit after the initial dash, paying the full E mana cost. Petricite Burst, knockup, travel and following attacks are excluded.',{label:'E · Abduct (chain hit)'}),
 },
 Taliyah:{
  'cast-q':spell('Taliyah','Q',[55,72.5,90,107.5,125],.5,'First ordinary Threaded Volley rock only. Worked-ground boulder, other rocks, displacement and monster bonuses are excluded.',{label:'Q · Threaded Volley (first rock)'}),
  'cast-q-max':spell('Taliyah','Q',[143,188.5,234,279.5,325],1.3,'All five ordinary rocks hit the same champion: first at full damage, four at 40%. Impact times are approximated together at zero; volley timing, worked-ground boulder and monster bonuses are excluded.',{label:'Q · Threaded Volley (all five rocks)'}),
  'cast-e':spell('Taliyah','E',[60,105,150,195,240],.6,'Initial Unraveled Earth hit only. Dash/knockback-triggered stone detonations, stun and slow are excluded.',{label:'E · Unraveled Earth (initial hit)'}),
 },
 Teemo:{
  'cast-q':spell('Teemo','Q',[80,125,170,215,260],.7,'One Blinding Dart hit. Blind, Toxic Shot attacks and item on-hits are excluded.'),
  'cast-e':spell('Teemo','E',[9,23,37,51,65],.3,'One noncritical attack: normal physical AD delivery, Toxic Shot magic impact, then uniformly prorated poison over 4s. Champion ratios only; monster modifier, refreshes, repeat attacks, critical strikes and item on-hits are excluded.',{label:'E · Toxic Shot (one attack and poison)',profile:'mixed',packets:(rank,stats)=>[{name:'Delivery attack (noncritical)',type:'physical',raw:stats.ad},{name:'Toxic Shot impact',type:'magic',raw:[9,23,37,51,65][rank-1]+.3*stats.ap+.05*stats.bonusAD},{name:'Toxic Shot poison',type:'magic',raw:4*([6,12,18,24,30][rank-1]+.1*stats.ap+.025*stats.bonusAD),duration:4}]}),
  'cast-r':spell('Teemo','R',[200,325,450],.5,'One armed mushroom triggers at zero, dealing uniformly prorated poison over 4s. Placement/arming time is outside the scored window, while its initial mana cost is included. Repeated traps, slow, vision and item procs are excluded.',{label:'R · Noxious Trap (triggered mushroom)',packets:(rank,stats)=>[{name:'Noxious Trap poison',type:'magic',raw:[200,325,450][rank-1]+.5*stats.ap,duration:4}]}),
 },
 Thresh:{
  'cast-q':spell('Thresh','Q',[100,150,200,250,300],.9,'One Death Sentence hit. Recast travel, stun, cooldown refund, soul generation and following attacks are excluded.'),
  'cast-e':spell('Thresh','E',[65,110,155,200,245],.6,'Active Flay spell hit only. Charged passive attack, earned souls, displacement and slow are excluded.',{label:'E · Flay (active spell)'}),
  'cast-r':spell('Thresh','R',[250,400,550],1,'One champion breaks the first damaging wall. Subsequent walls deal no damage here. Setup time, slow, earned souls and attacks are excluded.',{label:'R · The Box (first wall)'}),
 },
 TwistedFate:{
  'cast-q':spell('TwistedFate','Q',[60,105,150,195,240],.85,'One Wild Cards projectile hits this champion. Other cards do not add damage to the same target here. Pick a Card, Stacked Deck, critical strikes and item procs are excluded.',{bonusAD:.5}),
  'cast-e':spell('TwistedFate','E',[65,90,115,140,165],.4,'Stacked Deck is already ready: one noncritical physical attack plus its magic proc. Three setup attacks are excluded, as are Pick a Card, critical strikes and item on-hits.',{label:'E · Stacked Deck (ready fourth attack)',profile:'mixed',packets:(rank,stats)=>[{name:'Delivery attack (noncritical)',type:'physical',raw:stats.ad},{name:'Stacked Deck proc',type:'magic',raw:[65,90,115,140,165][rank-1]+.2*stats.bonusAD+.4*stats.ap}]}),
 },
 Viktor:{
  'cast-q':spell('Viktor','Q',[60,75,90,105,120],.4,'Initial Siphon Power spell only. Empowered discharge attack, shield, upgraded movement and item procs are excluded.',{label:'Q · Siphon Power (initial spell)'}),
  'cast-e':spell('Viktor','E',[70,110,150,190,230],.5,'Initial Hextech Ray only. Upgraded aftershock, slow and following attacks are excluded.',{label:'E · Hextech Ray (initial ray)'}),
  'cast-r':spell('Viktor','R',[100,175,250],.5,'Initial storm burst at zero plus up to six one-second damage ticks, assuming the target stays in the storm. Death-triggered growth/duration extensions, storm movement, interrupt and attacks are excluded.',{label:'R · Arcane Storm (target stays)',packets:(rank,stats)=>[{name:'Arcane Storm initial',type:'magic',raw:[100,175,250][rank-1]+.5*stats.ap},...Array.from({length:6},(_,i)=>({name:`Arcane Storm tick ${i+1}`,type:'magic' as const,raw:[65,105,145][rank-1]+.35*stats.ap,time:i+1}))]}),
 },
 Singed:{'cast-e':spell('Singed','E',[50,60,70,80,90],.55,'One Fling impact including enemy maximum HP damage. Poison Trail, Insanity Potion stat bonuses, passive movement, grounding and root are excluded.',{packets:(rank,stats,s)=>[{name:'Fling',type:'magic',raw:[50,60,70,80,90][rank-1]+.55*stats.ap+[.06,.065,.07,.075,.08][rank-1]*s.targetHP}]})},
 Shaco:{
  'cast-e':spell('Shaco','E',[70,95,120,145,170],.6,'One Two-Shiv Poison hit from the front. Damage is multiplied by 1.5 strictly below 30% starting HP. Backstab, attacks, boxes and slow are excluded.',{targetHealth:true,packets:(rank,stats,s)=>[{name:'Two-Shiv Poison',type:'magic',raw:([70,95,120,145,170][rank-1]+.8*stats.bonusAD+.6*stats.ap)*((s.targetHealthPercent??100)<30?1.5:1)}]}),
  'cast-r':spell('Shaco','R',[150,225,300],.7,'Clone-death explosion only, scored at impact and including the R mana cost. Prior clone lifetime, clone attacks, mini-box attacks, fear and Backstab are excluded.',{label:'R · Hallucinate (clone-death explosion)'}),
 },
 Jax:{
  'cast-q':spell('Jax','Q',[65,105,145,185,225],0,'Leap Strike spell damage on one enemy champion. W empowerment, R passive proc, item on-hits, travel and following attacks are excluded.',{profile:'physical',bonusAD:1}),
  'cast-w':spell('Jax','W',[50,85,120,155,190],.6,'One noncritical attack plus ordinary champion Empower damage. Normal attack AD is counted once; R passive third-hit proc, critical strikes, item on-hits and structure modifier are excluded.',{label:'W · Empower (noncritical attack)',profile:'mixed',packets:(rank,stats)=>[{name:'Delivery attack (noncritical)',type:'physical',raw:stats.ad},{name:'Empower bonus',type:'magic',raw:[50,85,120,155,190][rank-1]+.6*stats.ap}]}),
  'cast-r':spell('Jax','R',[100,175,250],1,'Active Grandmaster-at-Arms swing damage only. Passive third-hit proc, armor/MR buffs, subsequent attacks and structure modifier are excluded.',{label:'R · Grandmaster-at-Arms (active swing)'}),
 },
 Jinx:{
  'cast-w':spell('Jinx','W',[10,60,110,160,210],0,'One Zap impact using total AD. Cast windup, slow, passive takedown buff and following attacks are excluded.',{profile:'physical',totalAD:1.4}),
  'cast-e':spell('Jinx','E',[90,140,190,240,290],1,'One armed Flame Chomper triggers on this champion. Other chompers, placement/arming time, root and passive takedown buff are excluded.',{label:'E · Flame Chompers! (one triggered trap)'}),
  'cast-r':spell('Jinx','R',[20,35,50],0,'Primary champion hit at minimum travel damage. Adds the full rank-dependent enemy missing-HP term, which is not reduced by travel. Flight time, splash and passive takedown buff are excluded.',{label:'R · Super Mega Death Rocket! (minimum travel)',profile:'physical',targetHealth:true,packets:(rank,stats,s)=>[{name:'Rocket minimum travel',type:'physical',raw:[20,35,50][rank-1]+.12*stats.bonusAD+[.25,.3,.35][rank-1]*(s.targetHP-currentHP(s))}]}),
  'cast-r-empowered':spell('Jinx','R',[200,350,500],0,'Primary champion hit at maximum travel damage, reached after sufficient prior flight. Adds the full rank-dependent missing-HP term. Flight time, splash and passive takedown buff are excluded.',{label:'R · Super Mega Death Rocket! (maximum travel)',profile:'physical',targetHealth:true,packets:(rank,stats,s)=>[{name:'Rocket maximum travel',type:'physical',raw:[200,350,500][rank-1]+1.2*stats.bonusAD+[.25,.3,.35][rank-1]*(s.targetHP-currentHP(s))}]}),
 },
 Tristana:{
  'cast-w':spell('Tristana','W',[70,105,140,175,210],.5,'One Rocket Jump landing, including bonus AD and AP damage. E bomb trigger/stacks, resets, slow and travel are excluded.',{bonusAD:1}),
  'cast-r':spell('Tristana','R',[225,275,325],1,'One Buster Shot hit, including bonus AD and AP. E bomb triggers, knockback and following attacks are excluded.',{bonusAD:.7}),
 },
 Vayne:{
  'cast-q':spell('Vayne','Q',[0,0,0,0,0],.5,'One noncritical Tumble attack with normal delivery AD plus rank-dependent total AD bonus and physical AP scaling. Silver Bolts, Final Hour bonus AD, critical strikes and item on-hits are excluded.',{label:'Q · Tumble (noncritical attack)',profile:'physical',totalAD:[1.75,1.85,1.95,2.05,2.15]}),
  'cast-e':spell('Vayne','E',[50,85,120,155,190],0,'Initial Condemn hit without a wall. Silver Bolts, Final Hour bonus AD, displacement and attacks are excluded.',{label:'E · Condemn (no wall)',profile:'physical',bonusAD:.5}),
  'cast-e-empowered':spell('Vayne','E',[125,212.5,300,387.5,475],0,'Condemn initial hit plus terrain-collision bonus of 150% of that packet, totaling 250%. The collision is assumed successful and impact times are approximated together. Silver Bolts, Final Hour bonus AD and stun are excluded.',{label:'E · Condemn (wall collision)',profile:'physical',bonusAD:1.25}),
 },
 Ekko:{
  'cast-q':spell('Ekko','Q',[80,95,110,125,140],.3,'Both outgoing and return hits land on this champion. Their impact times are approximated together at zero; Z-Drive passive, W passive, travel and slow are excluded.',{label:'Q · Timewinder (both passes)',packets:(rank,stats)=>[{name:'Timewinder outgoing',type:'magic',raw:[80,95,110,125,140][rank-1]+.3*stats.ap},{name:'Timewinder return',type:'magic',raw:[40,65,90,115,140][rank-1]+.7*stats.ap}]}),
  'cast-e':spell('Ekko','E',[50,75,100,125,150],.4,'One noncritical delivery attack plus E magic bonus. Attack AD is counted once; Z-Drive passive, W passive, item on-hits and mobility are excluded.',{label:'E · Phase Dive (noncritical attack)',profile:'mixed',packets:(rank,stats)=>[{name:'Delivery attack (noncritical)',type:'physical',raw:stats.ad},{name:'Phase Dive bonus',type:'magic',raw:[50,75,100,125,150][rank-1]+.4*stats.ap}]}),
  'cast-r':spell('Ekko','R',[200,350,500],1.75,'One rewind explosion with the enemy at the destination. Prior movement and damage, healing, passive stacks and invulnerability are excluded.'),
 },
 Elise:{
  'cast-q':spell('Elise','Q',[40,70,100,130,160],0,'Human-form Q uses enemy current HP at impact, including its AP-dependent percentage. Spider form, spiderlings, healing and monster damage caps are excluded.',{label:'Q · Neurotoxin (human form)',targetHealth:true,packets:(rank,stats,s)=>[{name:'Neurotoxin',type:'magic',raw:[40,70,100,130,160][rank-1]+(.04+.0003*stats.ap)*currentHP(s)}]}),
  'cast-w':spell('Elise','W',[60,100,140,180,220],.75,'One human-form spider explosion at impact. Chase time, spider form attacks and passive spiderlings are excluded.',{label:'W · Volatile Spiderling (human form)'}),
 },
 Evelynn:{
  'cast-q':spell('Evelynn','Q',[25,30,35,40,45],.25,'First missile only on an uncharmed target. Three recasts, mark bonus triggers, Allure resistance reduction and passive effects are excluded.',{label:'Q · Hate Spike (first missile)'}),
  'cast-e':spell('Evelynn','E',[60,90,120,150,180],0,'Ordinary Whiplash on an uncharmed target. Uses enemy maximum HP, including AP-dependent scaling; on-hits, Allure resistance reduction and movement are excluded.',{label:'E · Whiplash (ordinary)',packets:(rank,stats,s)=>[{name:'Whiplash',type:'magic',raw:[60,90,120,150,180][rank-1]+(.03+.00015*stats.ap)*s.targetHP}]}),
  'cast-e-empowered':spell('Evelynn','E',[80,120,160,200,240],0,'Empowered Whiplash is already ready from Demon Shade. Enemy is uncharmed. Preparation, on-hits, Allure resistance reduction and other targets are excluded.',{label:'E · Whiplash (empowered)',packets:(rank,stats,s)=>[{name:'Empowered Whiplash',type:'magic',raw:[80,120,160,200,240][rank-1]+(.04+.00025*stats.ap)*s.targetHP}]}),
  'cast-r':spell('Evelynn','R',[125,250,375],.75,'One Last Caress hit on an uncharmed target. Damage is multiplied by 2.4 only strictly below 30% starting HP; this is bonus damage, not a guaranteed execute. Allure resistance reduction and earlier combo damage are excluded.',{targetHealth:true,packets:(rank,stats,s)=>[{name:'Last Caress',type:'magic',raw:([125,250,375][rank-1]+.75*stats.ap)*((s.targetHealthPercent??100)<30?2.4:1)}]}),
 },
 Ivern:{
  'cast-q':spell('Ivern','Q',[80,125,170,215,260],.7,'One Rootcaller hit. Root, ally dash, brush attacks and Daisy damage are excluded.'),
  'cast-e':spell('Ivern','E',[70,90,110,130,150],.8,'One Triggerseed explosion at 2s with the enemy in range. Earlier windows score no explosion but spend mana. Shield, renewal, slow and Daisy damage are excluded.',{packets:(rank,stats)=>[{name:'Triggerseed explosion',type:'magic',raw:[70,90,110,130,150][rank-1]+.8*stats.ap,time:2}]}),
 },
 Kassadin:{
  'cast-q':spell('Kassadin','Q',[65,95,125,155,185],.8,'One Null Sphere hit. Shield, interrupt, passive defenses and later attacks are excluded.'),
  'cast-e':spell('Kassadin','E',[70,100,130,160,190],.7,'One Force Pulse hit. Slow, nearby spell cooldown reductions and following spells are excluded.'),
  'cast-r':spell('Kassadin','R',[80,95,110],.5,'One Riftwalk with zero prior stacks, including 2% maximum mana. Available mana only determines affordability; prior casts, movement and following casts are excluded.',{label:'R · Riftwalk (zero prior stacks)',packets:(rank,stats)=>[{name:'Riftwalk',type:'magic',raw:[80,95,110][rank-1]+.5*stats.ap+.02*stats.mana}]}),
  'cast-r-empowered':spell('Kassadin','R',[80,95,110],.5,'Four Riftwalk stacks are already active within their 15s duration. This cast costs 640 mana upfront and includes four stack bonuses. Prior setup damage and mana, stack decay and subsequent casts are excluded.',{label:'R · Riftwalk (four prior stacks)',costMultiplier:16,packets:(rank,stats)=>[{name:'Riftwalk at four stacks',type:'magic',raw:[80,95,110][rank-1]+.5*stats.ap+.02*stats.mana+4*([35,45,55][rank-1]+.07*stats.ap+.01*stats.mana)}]}),
 },
 Khazix:{
  'cast-q':spell('Khazix','Q',[80,105,130,155,180],0,'One Q on a non-isolated champion. Passive attack, evolution cooldown changes and following attacks are excluded.',{label:'Q · Taste Their Fear (not isolated)',profile:'physical',bonusAD:1.05}),
  'cast-q-isolated':spell('Khazix','Q',[80,105,130,155,180],0,'Enemy is already isolated; Q damage is multiplied by 2.1. Passive attack, isolation setup, evolution cooldown changes and repeats are excluded.',{label:'Q · Taste Their Fear (isolated)',profile:'physical',packets:(rank,stats)=>[{name:'Isolated Taste Their Fear',type:'physical',raw:([80,105,130,155,180][rank-1]+1.05*stats.bonusAD)*2.1}]}),
  'cast-w':spell('Khazix','W',[75,105,135,165,195],0,'One spike explosion on this champion. Other spikes, healing, evolution utility and passive attacks are excluded.',{profile:'physical',bonusAD:1}),
  'cast-e':spell('Khazix','E',[65,100,135,170,205],0,'One leap landing. Evolution resets, passive attacks, travel and following casts are excluded.',{profile:'physical',bonusAD:.4}),
 },
 Lillia:{
  'cast-q':spell('Lillia','Q',[35,45,55,65,75],.35,'Enemy is hit by the outer edge: one magic packet and an equal true-damage packet. Dream-Laden Bough burn, healing and movement stacks are excluded.',{label:'Q · Blooming Blows (outer edge)',profile:'mixed',packets:(rank,stats)=>{const raw=[35,45,55,65,75][rank-1]+.35*stats.ap;return [{name:'Blooming Blows magic',type:'magic',raw},{name:'Blooming Blows outer true damage',type:'true',raw}]}}),
  'cast-w':spell('Lillia','W',[80,100,120,140,160],.35,'One outer-area W hit. Center bonus, passive burn, movement and following attacks are excluded.',{label:'W · Watch Out! Eep! (outer area)'}),
  'cast-w-empowered':spell('Lillia','W',[240,300,360,420,480],1.05,'One center W hit deals triple the outer-area packet. Passive burn, movement and sleep/wake damage are excluded.',{label:'W · Watch Out! Eep! (center)'}),
  'cast-e':spell('Lillia','E',[60,85,110,135,160],.5,'One Swirlseed hit. Rolling travel, passive burn, slow and sleep/wake damage are excluded.'),
 },
 Lulu:{
  'cast-q':spell('Lulu','Q',[60,95,130,165,200],.5,'One Glitterlance bolt hits. Pix attacks, second bolt, slow and other targets are excluded.',{label:'Q · Glitterlance (one bolt)'}),
  'cast-q-empowered':spell('Lulu','Q',[90,142.5,195,247.5,300],.75,'Both Glitterlance bolts hit the same champion; the second deals 50% damage. Pix positioning is assumed ready. Pix attacks, setup damage and slow are excluded.',{label:'Q · Glitterlance (both bolts)'}),
  'cast-e':spell('Lulu','E',[70,110,150,190,230],.5,'Offensive E on one enemy champion. Ally shield, subsequent Pix attacks and vision utility are excluded.',{label:'E · Help, Pix! (offensive)'}),
 },
 Malzahar:{
  'cast-q':spell('Malzahar','Q',[70,105,140,175,210],.55,'One Call of the Void hit. E refresh, voidlings, silence and passive shield are excluded.'),
  'cast-e':spell('Malzahar','E',[80,115,150,185,220],.8,'One Malefic Visions application, prorated uniformly across its four-second duration inside the observation window. This approximates the exported 0.25s ticks. Refreshes, spreading, voidlings, mana refunds and minion execution are excluded.',{label:'E · Malefic Visions (observed damage)',packets:(rank,stats)=>[{name:'Malefic Visions observed damage',type:'magic',raw:[80,115,150,185,220][rank-1]+.8*stats.ap,duration:4}]}),
 },
 Milio:{'cast-q':spell('Milio','Q',[80,140,200,260,320],1.2,'One Ultra Mega Fire Kick hit. Fired Up allied triggers, healing, shields, knockback and slow are excluded.')},
 Rakan:{
  'cast-q':spell('Rakan','Q',[70,115,160,205,250],.7,'One Gleaming Quill hit. Healing, passive shield and follow-up damage are excluded.'),
  'cast-w':spell('Rakan','W',[70,120,170,220,270],.8,'One Grand Entrance impact. Travel time, knockup, passive shield and following attacks are excluded.'),
  'cast-r':spell('Rakan','R',[100,200,300],.5,'One contact with this champion during The Quickness. Repeated contacts add no damage; charm, movement and following spells are excluded.'),
 },
 Renata:{
  'cast-q':spell('Renata','Q',[80,125,170,215,260],.8,'Initial Handshake hit on one champion. Recast displacement, collision effects, passive mark and allied damage are excluded.'),
  'cast-e':spell('Renata','E',[65,95,125,155,185],.55,'One enemy hit by Loyalty Program. Shield, slow, passive mark and allied follow-up are excluded.'),
 },
 Soraka:{
  'cast-q':spell('Soraka','Q',[85,120,155,190,225],.35,'One Starcall impact. Flight time, Rejuvenation healing, slow and movement are excluded.'),
  'cast-e':spell('Soraka','E',[70,95,120,145,170],.4,'Initial Equinox hit at zero and an equal closing hit at 1.5s, assuming the target stays in the area. Root, silence and healing are excluded.',{label:'E · Equinox (target stays)',packets:(rank,stats)=>{const raw=[70,95,120,145,170][rank-1]+.4*stats.ap;return [{name:'Equinox initial',type:'magic',raw},{name:'Equinox closing',type:'magic',raw,time:1.5}]}}),
 },
 Zilean:{'cast-q':spell('Zilean','Q',[75,115,165,230,300],.9,'One bomb attached at time zero, exploding after its 3s fuse. Earlier windows score no hit but spend initial mana. Rewind resets, early double-bomb detonation, stun and revive are excluded.',{label:'Q · Time Bomb (one full fuse)',packets:(rank,stats)=>[{name:'Time Bomb explosion',type:'magic',raw:[75,115,165,230,300][rank-1]+.9*stats.ap,time:3}]})},
 Zyra:{
  'cast-q':spell('Zyra','Q',[60,100,140,180,220],.65,'One Deadly Spines hit. Seeds, plants, plant attacks and passive generation are excluded.'),
  'cast-e':spell('Zyra','E',[60,95,130,165,200],.6,'One Grasping Roots hit. Root, seeds, plants and following attacks are excluded.'),
  'cast-r':spell('Zyra','R',[200,300,400],.7,'Initial Stranglethorns damage only. Later knockup adds no damage here; plant enrage, plant attacks and other targets are excluded.'),
 },
 Nautilus:{
  'cast-q':spell('Nautilus','Q',[85,125,165,205,245],.9,'One champion hook hit. Terrain refund, displacement, passive attack and follow-up damage are excluded.'),
  'cast-e':spell('Nautilus','E',[55,90,125,160,195],.5,'One Riptide wave hits this champion. Other wave contacts, repeat-hit reduction, slow and monster bonus are excluded.',{label:'E · Riptide (one wave)'}),
  'cast-r':spell('Nautilus','R',[150,275,400],.8,'Primary target damage only. Travel, secondary-target packets, knockup and stun are excluded.',{label:'R · Depth Charge (primary target)'}),
 },
 Sejuani:{
  'cast-q':spell('Sejuani','Q',[90,140,190,240,290],.75,'One champion collision. Knockup, Frost setup, Icebreaker and passive defenses are excluded.'),
  'cast-w':spell('Sejuani','W',[5,15,25,35,45],.3,'Both swings land, using total maximum HP. Impact times are approximated together at zero; swing timing, Frost stacks, Icebreaker and slow are excluded.',{label:'W · Winter\'s Wrath (both swings)',profile:'physical',packets:(rank,stats)=>[{name:'Winter\'s Wrath first swing',type:'physical',raw:[5,15,25,35,45][rank-1]+.3*stats.ap+.04*stats.hp},{name:'Winter\'s Wrath second swing',type:'physical',raw:[5,25,45,65,85][rank-1]+.6*stats.ap+.08*stats.hp}]}),
  'cast-e':spell('Sejuani','E',[55,105,155,205,255],.7,'Requires four Frost stacks already on this champion. Stack setup, Icebreaker follow-up, stun and allied attacks are excluded.'),
  'cast-r':spell('Sejuani','R',[125,150,175],.4,'Short-range initial bola hit only, before the travel threshold for the enhanced storm. Ice storm, Icebreaker, travel time and stun are excluded.',{label:'R · Glacial Prison (short-range initial hit)'}),
 },
 Maokai:{
  'cast-q':spell('Maokai','Q',[75,120,165,210,255],.5,'One Bramble Smash hit. Displacement, slow, passive healing and following attacks are excluded.'),
  'cast-w':spell('Maokai','W',[60,85,110,135,160],.4,'One Twisted Advance hit. Root, travel, untargetability and passive healing are excluded.'),
  'cast-e':spell('Maokai','E',[50,75,100,125,150],.25,'One ordinary sapling detonation outside brush, scaling with bonus HP. Placement/chase time, brush damage-over-time, slow and passive cooldown refunds are excluded.',{label:'E · Sapling Toss (outside brush)',bonusHP:.05}),
  'cast-r':spell('Maokai','R',[150,225,300],.75,'One vine hits this champion. Additional vines do not add damage here; root, travel and other targets are excluded.'),
 },
 Sion:{
  'cast-q':spell('Sion','Q',[30,45,60,75,90],0,'Uncharged Q impact only. Charge bonus, stun, passive zombie attacks and other targets are excluded.',{label:'Q · Decimating Smash (uncharged)',profile:'physical',totalAD:[.4,.5,.6,.7,.8]}),
  'cast-q-max':spell('Sion','Q',[90,155,220,285,350],0,'Fully charged Q impact, requiring two seconds of prior preparation before the scored hit. Charge time, stun and passive zombie attacks are excluded.',{label:'Q · Decimating Smash (fully charged)',profile:'physical',totalAD:[1.2,1.5,1.8,2.1,2.4]}),
  'cast-w':spell('Sion','W',[40,65,90,115,140],.4,'Shield is assumed to remain intact until detonation at 3s. Adds 14% enemy maximum HP; windows below 3s score no hit but pay initial mana. Shield value, incoming damage and automatic passive HP stacks are excluded.',{label:'W · Soul Furnace (shield survives to detonation)',packets:(rank,stats,s)=>s.duration>=3?[{name:'Soul Furnace detonation',type:'magic',raw:[40,65,90,115,140][rank-1]+.4*stats.ap+.14*s.targetHP,time:3}]:[]}),
  'cast-e':spell('Sion','E',[65,100,135,170,205],.55,'One direct roar hit. Armor reduction is not applied to subsequent physical spells; minion collisions, slow and later damage are excluded.'),
  'cast-r':spell('Sion','R',[150,300,450],0,'Minimum-distance impact only. Distance scaling to maximum damage, charge travel, displacement and passive attacks are excluded.',{label:'R · Unstoppable Onslaught (minimum-distance hit)',profile:'physical',bonusAD:.6}),
 },
 Poppy:{
  'cast-q':spell('Poppy','Q',[30,55,80,105,130],0,'Initial hit at 0s; the same champion remains in the area for the second hit at 1s if the window permits it. Each hit includes rank-dependent enemy maximum HP damage. Slow, monster caps and passive attacks are excluded.',{label:'Q · Hammer Shock (target stays for eruption)',profile:'physical',packets:(rank,stats,s)=>{const raw=[30,55,80,105,130][rank-1]+.75*stats.bonusAD+[.07,.075,.08,.085,.09][rank-1]*s.targetHP;return [{name:'Hammer Shock impact',type:'physical',raw},...(s.duration>=1?[{name:'Hammer Shock eruption',type:'physical' as const,raw,time:1}]:[])]}}),
  'cast-w':spell('Poppy','W',[70,110,150,190,230],.7,'One enemy dash is intercepted. Requires an actual dash into the field; grounding, defenses, movement and further interceptions are excluded.',{label:'W · Steadfast Presence (dash intercepted)'}),
  'cast-e':spell('Poppy','E',[40,60,80,100,120],0,'Initial tackle hit only. Wall collision bonus hit, wall stun, displacement and passive attack are excluded.',{label:'E · Heroic Charge (no wall collision)',profile:'physical',bonusAD:.6}),
  'cast-r':spell('Poppy','R',[100,150,200],0,'Uncharged tap deals half the charged damage packet. Charge range, knockback, untargetability and following attacks are excluded.',{label:'R · Keeper\'s Verdict (uncharged tap)',profile:'physical',bonusAD:.45}),
 },
 Alistar:{
  'cast-q':spell('Alistar','Q',[60,100,140,180,220],.8,'One Pulverize hit. Knockup, Trample stacks, healing and other targets are excluded.'),
  'cast-w':spell('Alistar','W',[55,110,165,220,275],1,'One Headbutt hit. Knockback, Q combo, Trample stacks and following attacks are excluded.'),
 },
 Leona:{
  'cast-q':spell('Leona','Q',[10,35,60,85,110],.3,'One noncritical delivery attack plus the Q magic bonus. Attack AD is included once; Sunlight requires another champion and is excluded, as are item on-hits and stun.',{label:'Q · Shield of Daybreak (noncritical attack)',profile:'mixed',packets:(rank,stats)=>[{name:'Delivery attack (noncritical)',type:'physical',raw:stats.ad},{name:'Shield of Daybreak bonus',type:'magic',raw:[10,35,60,85,110][rank-1]+.3*stats.ap}]}),
  'cast-w':spell('Leona','W',[55,85,115,145,175],.4,'One Eclipse explosion at 3s, assuming the enemy is in range. Earlier windows score no hit but pay initial mana. Defensive stats, buff extension and Sunlight follow-up are excluded.',{packets:(rank,stats,s)=>s.duration>=3?[{name:'Eclipse explosion',type:'magic',raw:[55,85,115,145,175][rank-1]+.4*stats.ap,time:3}]:[]}),
  'cast-e':spell('Leona','E',[50,90,130,170,210],.4,'One Zenith Blade hit. Root, dash, Sunlight follow-up and attacks are excluded.'),
  'cast-r':spell('Leona','R',[150,225,300],.8,'One Solar Flare hit. Stun/slow zones, Sunlight follow-up and other targets are excluded.'),
 },
 Braum:{
  'cast-q':spell('Braum','Q',[75,120,165,210,255],0,'One Winter\'s Bite magic hit, scaling with total maximum HP. Concussive Blows, stun, slow and following attacks are excluded.',{packets:(rank,stats)=>[{name:'Winter\'s Bite',type:'magic',raw:[75,120,165,210,255][rank-1]+.025*stats.hp}]}),
  'cast-r':spell('Braum','R',[150,250,350],.6,'One Glacial Fissure magic hit. Knockup, slow field, Concussive Blows and other targets are excluded.'),
 },
 Nunu:{
  'cast-q':spell('Nunu','Q',[60,100,140,180,220],.65,'Champion Consume magic damage with bonus HP scaling. Monster/minion true damage, healing and passive attack-speed effects are excluded.',{label:'Q · Consume (champion target)',bonusHP:.05}),
  'cast-e':spell('Nunu','E',[15,22.5,30,37.5,45],.12,'One snowball projectile packet from the initial cast, paying initial mana. Other snowballs, recasts, root detonation and slow are excluded.',{label:'E · Snowball Barrage (one snowball)'}),
  'cast-r':spell('Nunu','R',[625,925,1275],3,'Full uninterrupted three-second channel, with this champion inside the final explosion. Windows below 3s score no hit but spend initial mana. Early releases, shields, slow and interruption are excluded.',{label:'R · Absolute Zero (full channel)',packets:(rank,stats,s)=>s.duration>=3?[{name:'Absolute Zero full detonation',type:'magic',raw:[625,925,1275][rank-1]+3*stats.ap,time:3}]:[]}),
 },
 Volibear:{
  'cast-q':spell('Volibear','Q',[10,20,30,40,50],0,'One noncritical empowered attack, including delivery AD once and Q bonus AD scaling. Passive lightning, item on-hits, stun and movement are excluded.',{label:'Q · Thundering Smash (noncritical attack)',profile:'physical',totalAD:1,bonusAD:1.6}),
  'cast-w':spell('Volibear','W',[5,30,55,80,105],0,'First maul on an unmarked target. Bonus HP is used, not total HP. Subsequent marked-target maul, healing, item on-hits and automatic ultimate HP are excluded.',{label:'W · Frenzied Maul (unmarked)',profile:'physical',totalAD:1.1,bonusHP:.06}),
  'cast-w-empowered':spell('Volibear','W',[5,30,55,80,105],0,'One maul on a target already marked by W. The multiplier is 1.5 + 0.0025 per bonus AD. Mark setup damage/mana, healing, on-hits and automatic ultimate HP are excluded.',{label:'W · Frenzied Maul (already marked)',profile:'physical',packets:(rank,stats)=>[{name:'Frenzied Maul marked hit',type:'physical',raw:([5,30,55,80,105][rank-1]+1.1*stats.ad+.06*stats.bonusHP)*(1.5+.0025*stats.bonusAD)}]}),
  'cast-e':spell('Volibear','E',[80,110,140,170,200],.7,'One lightning impact with rank-dependent enemy maximum HP damage. Telegraph time is outside the scored impact; shield, slow, monster cap and automatic ultimate HP are excluded.',{packets:(rank,stats,s)=>[{name:'Sky Splitter',type:'magic',raw:[80,110,140,170,200][rank-1]+.7*stats.ap+[.11,.12,.13,.14,.15][rank-1]*s.targetHP}]}),
  'cast-r':spell('Volibear','R',[300,500,700],1.25,'One center landing physical hit. Automatic ultimate bonus HP and resulting item conversions, tower damage, displacement, slow and passive lightning are excluded.',{label:'R · Stormbringer (center landing)',profile:'physical',bonusAD:2.5}),
 },
 Warwick:{
  'cast-q':spell('Warwick','Q',[0,0,0,0,0],1,'One champion bite spell packet, with total AD/AP and rank-dependent enemy maximum HP damage. Passive attack damage, item on-hits, healing, movement and monster caps are excluded.',{packets:(rank,stats,s)=>[{name:'Jaws of the Beast',type:'magic',raw:1.2*stats.ad+stats.ap+[.06,.07,.08,.09,.1][rank-1]*s.targetHP}]}),
 },
 XinZhao:{
  'cast-q':spell('XinZhao','Q',[15,30,45,60,75],0,'First empowered noncritical attack, including its normal AD delivery. Other two attacks, Determination passive, on-hits, cooldown refunds and knockup are excluded.',{label:'Q · Three Talon Strike (first attack)',profile:'physical',totalAD:1,bonusAD:.4}),
  'cast-w':spell('XinZhao','W',[30,40,50,60,70],0,'Initial slash only. The thrust, its AP/crit scaling, slow, mark and attacks are excluded.',{label:'W · Wind Becomes Lightning (initial slash)',profile:'physical',totalAD:.3}),
  'cast-e':spell('XinZhao','E',[50,75,100,125,150],1.2,'One Audacious Charge magic hit. Attack-speed buff, attacks, slow and passive healing are excluded.'),
  'cast-r':spell('XinZhao','R',[75,175,275],1.1,'One sweep adds 15% of enemy current HP at impact, using the supplied starting-HP percentage. Challenge setup, knockback, immunity and following attacks are excluded.',{profile:'physical',targetHealth:true,packets:(rank,stats,s)=>[{name:'Crescent Guard',type:'physical',raw:[75,175,275][rank-1]+stats.bonusAD+1.1*stats.ap+.15*currentHP(s)}]}),
 },
 Vi:{
  'cast-q':spell('Vi','Q',[40,60,80,100,120],0,'Minimum-charge Q hit. Denting Blows damage/armor reduction, passive shield, charge timing and knockback are excluded.',{label:'Q · Vault Breaker (minimum charge)',profile:'physical',bonusAD:.6}),
  'cast-q-max':spell('Vi','Q',[100,150,200,250,300],0,'Fully charged Q impact is 2.5 times minimum damage. Prior charging is assumed complete; charge timing, Denting Blows, passive shield and knockback are excluded.',{label:'Q · Vault Breaker (fully charged)',profile:'physical',bonusAD:1.5}),
  'cast-e':spell('Vi','E',[10,30,50,70,90],1,'One noncritical empowered attack, including total AD delivery once. Other charges, crit, Denting Blows, item on-hits and cone targets are excluded.',{label:'E · Relentless Force (noncritical attack)',profile:'physical',totalAD:1.1}),
  'cast-r':spell('Vi','R',[150,250,350],0,'One ultimate hit on this champion. Secondary targets, travel, Denting Blows, passive shield and following attacks are excluded.',{profile:'physical',bonusAD:.9}),
 },
 Fizz:{
  'cast-q':spell('Fizz','Q',[10,25,40,55,70],.55,'One dash spell with physical delivery AD and the separate magic bonus. W passive damage, item on-hits and follow-up attacks are excluded.',{profile:'mixed',packets:(rank,stats)=>[{name:'Urchin Strike physical delivery',type:'physical',raw:stats.ad},{name:'Urchin Strike magic bonus',type:'magic',raw:[10,25,40,55,70][rank-1]+.55*stats.ap}]}),
  'cast-e':spell('Fizz','E',[80,130,180,230,280],.95,'One landing hit. Prior hop time, untargetability, slow and subsequent attacks are excluded.'),
  'cast-r':spell('Fizz','R',[180,300,420],.6,'Small shark explodes 2s after attachment, assumed at 0s. Windows below 2s score no hit but spend initial mana. Prior fish travel, crowd control and other targets are excluded.',{label:'R · Chum the Waters (small shark)',packets:(rank,stats,s)=>s.duration>=2?[{name:'Small shark explosion',type:'magic',raw:[180,300,420][rank-1]+.6*stats.ap,time:2}]:[]}),
  'cast-r-empowered':spell('Fizz','R',[270,450,630],.9,'Maximum-distance attachment creates the big shark, exploding 2s after attachment at 1.5 times small-shark damage. Attachment is assumed at 0s; prior fish travel, crowd control and other targets are excluded.',{label:'R · Chum the Waters (big shark)',packets:(rank,stats,s)=>s.duration>=2?[{name:'Big shark explosion',type:'magic',raw:[270,450,630][rank-1]+.9*stats.ap,time:2}]:[]}),
 },
 Fiddlesticks:{
  'cast-q':spell('Fiddlesticks','Q',[0,0,0,0,0],0,'Target is not recently feared by Fiddlesticks. Uses enemy current HP from the supplied percentage, with the exported rank-dependent minimum damage. Recent-fear doubling, passive fear setup and monster rules are excluded.',{label:'Q · Terrify (not recently feared)',targetHealth:true,packets:(rank,stats,s)=>[{name:'Terrify',type:'magic',raw:Math.max([40,60,80,100,120][rank-1],([.04,.045,.05,.055,.06][rank-1]+.0003*stats.ap)*currentHP(s))}]}),
  'cast-e':spell('Fiddlesticks','E',[70,105,140,175,210],.5,'One Reap hit. Slow, center silence, passive fear, setup and other targets are excluded.'),
 },
 Galio:{
  'cast-q':spell('Galio','Q',[70,105,140,175,210],.7,'One projectile impact only. The lingering tornado and its target-health damage, passive attack and subsequent casts are excluded.',{label:'Q · Winds of War (projectile impact)'}),
  'cast-w':spell('Galio','W',[20,30,40,50,60],.3,'Minimum-charge release hit only. Charging bonus, taunt, shield and damage reduction are excluded.',{label:'W · Shield of Durand (minimum charge)'}),
  'cast-e':spell('Galio','E',[100,135,170,205,240],1,'One champion collision. Passive attack, displacement and monster/minion rules are excluded.'),
 },
 Garen:{
  'cast-q':spell('Garen','Q',[30,60,90,120,150],0,'One noncritical empowered attack, including its total AD delivery damage once. Crit, item on-hits, silence, movement and subsequent attacks are excluded.',{label:'Q · Decisive Strike (noncritical attack)',profile:'physical',totalAD:1.5}),
 },
 Kennen:{
  'cast-q':spell('Kennen','Q',[75,125,175,225,275],.75,'One shuriken hit. Mark of the Storm stun, energy restoration and following attacks are excluded.'),
  'cast-w':spell('Kennen','W',[70,95,120,145,170],.8,'Active blast on a target already carrying a Mark of the Storm. Mark setup damage/cost, fifth-attack passive, stun and energy restoration are excluded.',{label:'W · Electrical Surge (already marked)'}),
  'cast-e':spell('Kennen','E',[80,120,160,200,240],.8,'One champion contact. Energy refunds, repeated contacts, attack-speed bonus, stun and following attacks are excluded.'),
 },
 LeeSin:{
  'cast-q':spell('LeeSin','Q',[60,90,120,150,180],0,'Sonic Wave initial projectile only. Resonating Strike, missing-health bonus, Flurry attacks and energy recovery are excluded.',{label:'Q · Sonic Wave (initial hit)',profile:'physical',bonusAD:.9}),
  'cast-e':spell('LeeSin','E',[35,60,85,110,135],0,'One Tempest magic hit scaling with total AD. Cripple, Flurry attacks and energy restoration are excluded.',{profile:'magic',totalAD:.9}),
  'cast-r':spell('LeeSin','R',[175,400,625],0,'One kick on the primary champion. Secondary collision damage, target-health collision scaling, displacement, Flurry and energy restoration are excluded.',{profile:'physical',bonusAD:2}),
 },
 Akali:{
  'cast-q':spell('Akali','Q',[45,70,95,120,145],.6,'One kunai hit. Uses the base 200-energy cap; Shroud bonus capacity, energy restoration, passive attacks and tip slow are excluded.',{totalAD:.65}),
  'cast-e':spell('Akali','E',[21,42,63,84,105],.33,'First shuriken hit only: 30% of the combined E formula. Recast dash damage, passive attacks and Shroud bonus energy capacity are excluded.',{label:'E · Shuriken Flip (first hit)',totalAD:.3}),
  'cast-r':spell('Akali','R',[110,220,330],.3,'First vault magic damage only. Second dash, missing-health execute scaling, passive attacks and travel are excluded.',{label:'R · Perfect Execution (first vault)',bonusAD:.5}),
 },
 Zed:{
  'cast-q':spell('Zed','Q',[80,120,160,200,240],0,'One shuriken hits its first target. Shadow projectiles, prior-target reduction, Death Mark, passive attack and energy restoration are excluded.',{label:'Q · Razor Shuriken (one first-target hit)',profile:'physical',bonusAD:1}),
  'cast-e':spell('Zed','E',[70,92.5,115,137.5,160],0,'One Shadow Slash packet. Overlapping slashes do not add damage; shadow slow, Death Mark, cooldown refunds and energy restoration are excluded.',{profile:'physical',bonusAD:.7}),
 },
 Shen:{
  'cast-e':spell('Shen','E',[60,85,110,135,160],0,'One champion dash hit using bonus HP. Base energy cap is 400; on-hit energy recovery, taunt, Q attacks and passive shield are excluded.',{profile:'physical',bonusHP:.11}),
 },
 Renekton:{
  'cast-q':spell('Renekton','Q',[60,90,120,150,180],0,'Ordinary Q assumes less than 50 Fury at cast. Healing, Fury generation, ultimate bonuses and other attacks are excluded.',{label:'Q · Cull the Meek (ordinary)',profile:'physical',bonusAD:1}),
  'cast-q-empowered':spell('Renekton','Q',[90,135,180,225,270],0,'Empowered Q requires at least 50 Fury already available and consumes it. Fury setup, healing, Fury generation and ultimate bonuses are excluded.',{label:'Q · Cull the Meek (50 Fury ready)',profile:'physical',bonusAD:1.4}),
  'cast-w':spell('Renekton','W',[5,20,35,50,65],0,'Ordinary two-strike attack assumes less than 50 Fury. Delivery AD is included in the two packets; crit, item on-hits, Fury generation and stun are excluded.',{label:'W · Ruthless Predator (ordinary two hits)',profile:'physical',packets:(rank,stats)=>[1,2].map(n=>({name:`Ruthless Predator hit ${n}`,type:'physical',raw:[5,20,35,50,65][rank-1]+.75*stats.ad}))}),
  'cast-w-empowered':spell('Renekton','W',[5,20,35,50,65],0,'Three-strike attack requires at least 50 Fury already available and consumes it. Delivery AD is included once per strike; Fury setup, shield destruction, item on-hits, crit and stun are excluded.',{label:'W · Ruthless Predator (50 Fury ready)',profile:'physical',packets:(rank,stats)=>[1,2,3].map(n=>({name:`Empowered Ruthless Predator hit ${n}`,type:'physical',raw:[5,20,35,50,65][rank-1]+.75*stats.ad}))}),
  'cast-e':spell('Renekton','E',[40,70,100,130,160],0,'One ordinary Slice dash. Dice recast, empowered Dice armor reduction, Fury generation and ultimate bonuses are excluded.',{label:'E · Slice (first dash)',profile:'physical',bonusAD:.9}),
 },
 Riven:{
  'cast-q':spell('Riven','Q',[45,75,105,135,165],0,'First Broken Wings slash only. Other slashes, Runic Blade attacks and automatic Blade of the Exile AD are excluded; enter any already active bonus AD explicitly.',{label:'Q · Broken Wings (first slash)',profile:'physical',bonusAD:[.6,.65,.7,.75,.8]}),
  'cast-w':spell('Riven','W',[65,95,125,155,185],0,'One Ki Burst hit. Stun, Runic Blade attacks and automatic ultimate AD are excluded; enter existing ultimate bonus AD through Extra AD.',{profile:'physical',bonusAD:1}),
 },
 Aatrox:{
  'cast-q':spell('Aatrox','Q',[10,25,40,55,70],0,'First Q swing, outside the sweet spot. Later swings, passive attacks, healing and automatic World Ender AD are excluded; enter existing ultimate AD explicitly.',{label:'Q · Darkin Blade (first swing, ordinary)',profile:'physical',totalAD:[.6,.675,.75,.825,.9]}),
  'cast-q-empowered':spell('Aatrox','Q',[17.5,43.75,70,96.25,122.5],0,'First Q swing at its sweet spot: 1.75 times the ordinary hit. Later swings, passive attacks, healing and automatic ultimate AD are excluded.',{label:'Q · Darkin Blade (first swing sweet spot)',profile:'physical',totalAD:[1.05,1.18125,1.3125,1.44375,1.575]}),
  'cast-w':spell('Aatrox','W',[30,40,50,60,70],0,'Initial chain hit only. Conditional pull-back hit, passive attacks, healing, slow and automatic ultimate AD are excluded.',{label:'W · Infernal Chains (initial hit)',profile:'physical',totalAD:.4}),
 },
 RekSai:{
  'cast-q':spell('RekSai','Q',[50,80,110,140,170],.7,'One burrowed Prey Seeker magic hit. Requires already being burrowed; unburrowed empowered attacks, Fury generation and other targets are excluded.',{label:'Q · Prey Seeker (already burrowed)',bonusAD:.25}),
  'cast-e':spell('RekSai','E',[70,95,120,145,170],0,'Ordinary unburrowed bite below maximum Fury. Fury generation, attacks, healing and tunnel movement are excluded.',{label:'E · Furious Bite (below maximum Fury)',profile:'physical',bonusAD:.6}),
  'cast-e-empowered':spell('RekSai','E',[84,114,144,174,204],0,'Requires maximum Fury already available. Current source converts the bite to true damage at 1.2 times the ordinary packet. Fury setup, healing, attacks and tunnel movement are excluded.',{label:'E · Furious Bite (maximum Fury ready)',profile:'true',bonusAD:.72}),
 },
 Katarina:{
  'cast-q':spell('Katarina','Q',[80,115,150,185,220],.4,'One initial blade hit on this champion. Bounces to other targets, dagger pickup, passive reset and following attacks are excluded.'),
  'cast-e':spell('Katarina','E',[20,30,40,50,60],.25,'One Shunpo magic packet. Dagger pickup, on-hit effects, subsequent attacks, cooldown resets and ultimate are excluded.',{totalAD:.4}),
 },
 Caitlyn:{
  'cast-q':spell('Caitlyn','Q',[50,90,130,170,210],0,'Full damage to the first target hit. Uses rank-dependent total AD scaling. Subsequent-target reduction, trap exceptions, Headshot and item procs are excluded.',{label:'Q · Piltover Peacemaker (first target)',profile:'physical',totalAD:[1.25,1.45,1.65,1.85,2.05]}),
  'cast-e':spell('Caitlyn','E',[80,130,180,230,280],.8,'One net magic hit. Headshot mark and follow-up attack, slow and recoil are excluded.'),
 },
 Ashe:{
  'cast-w':spell('Ashe','W',[60,95,130,165,200],0,'One Volley arrow hits this champion. Multiple arrows do not add extra damage to the same target. Frost Shot attacks, slow and item procs are excluded.',{profile:'physical',bonusAD:1}),
  'cast-r':spell('Ashe','R',[200,400,600],1.2,'One direct champion hit. Splash targets, stun duration, travel and follow-up attacks are excluded.'),
 },
 MissFortune:{
  'cast-q':spell('MissFortune','Q',[20,45,70,95,120],.35,'First-target Double Up spell packet only. Love Tap, item on-hits, the delivery of any separate attack and second-target bounce/crit are excluded.',{label:'Q · Double Up (first target)',profile:'physical',totalAD:1}),
 },
 Draven:{
  'cast-e':spell('Draven','E',[75,110,145,180,215],0,'One Stand Aside hit. Knockback, slow, axes and subsequent attacks are excluded.',{profile:'physical',bonusAD:.5}),
  'cast-r':spell('Draven','R',[200,300,400],0,'Full first outward hit with no prior enemies struck. Return hit, per-target falloff and Adoration execute are excluded.',{label:'R · Whirling Death (first outward hit)',profile:'physical',bonusAD:[1.1,1.3,1.5]}),
 },
 Graves:{
  'cast-q':spell('Graves','Q',[50,75,100,125,150],0,'Initial projectile only. Delayed detonation, wall timing, shotgun attacks and item procs are excluded.',{label:'Q · End of the Line (initial hit)',profile:'physical',bonusAD:.55}),
  'cast-w':spell('Graves','W',[60,110,160,210,260],.6,'One Smoke Screen impact magic hit. Nearsight, slow, smoke duration and follow-up damage are excluded.'),
  'cast-r':spell('Graves','R',[275,425,575],0,'Direct projectile impact on this champion. The cone is not added to the direct hit; recoil, other targets and follow-up damage are excluded.',{label:'R · Collateral Damage (direct impact)',profile:'physical',bonusAD:1.5}),
 },
 Quinn:{
  'cast-q':spell('Quinn','Q',[65,100,135,170,205],.5,'One champion hit, using rank-dependent bonus AD and AP. Harrier follow-up attacks, nearsight and monster bonus are excluded.',{profile:'physical',bonusAD:[.8,.85,.9,.95,1]}),
  'cast-e':spell('Quinn','E',[40,65,90,115,140],0,'One Vault spell hit. Harrier follow-up attack, bounce movement and slow are excluded.',{profile:'physical',bonusAD:.2}),
 },
 JarvanIV:{
  'cast-e':spell('JarvanIV','E',[80,120,160,200,240],.8,'One flag landing magic hit. Attack-speed aura, Martial Cadence attacks and Dragon Strike/armor reduction are excluded.'),
  'cast-r':spell('JarvanIV','R',[200,325,450],0,'One Cataclysm impact. Target armor is the entered value; no prior Dragon Strike shred, Martial Cadence attacks or terrain value are assumed.',{profile:'physical',bonusAD:1.8}),
 },
 Nocturne:{
  'cast-q':spell('Nocturne','Q',[65,105,145,185,225],0,'One Duskbringer projectile hit using supplied bonus AD at impact. Enter any already active trail AD through Extra AD; automatic trail AD generation, Umbra Blades attacks, movement and subsequent hits are excluded.',{profile:'physical',bonusAD:.85}),
  'cast-r':spell('Nocturne','R',[150,275,400],0,'One successful Paranoia dash impact, charging the initial ultimate mana cost. Darkness, travel, trail AD and following attacks are excluded.',{profile:'physical',bonusAD:1.2}),
 },
 Talon:{
  'cast-q':spell('Talon','Q',[65,85,105,125,145],0,'Ranged leap damage only. Melee critical variant, Blade\'s End bleed, item on-hits, attacks and kill healing are excluded.',{label:'Q · Noxian Diplomacy (ranged leap)',profile:'physical',bonusAD:1}),
  'cast-w':spell('Talon','W',[50,60,70,80,90],0,'Outward Rake hit only. Returning blades, slow and Blade\'s End bleed are excluded.',{label:'W · Rake (outward hit)',profile:'physical',bonusAD:.4}),
  'cast-r':spell('Talon','R',[90,135,180],0,'One outward blade hit only. Converging blades, Blade\'s End bleed, stealth, attacks and movement are excluded.',{label:'R · Shadow Assault (outward hit)',profile:'physical',bonusAD:1}),
 },
 Pantheon:{
  'cast-r':spell('Pantheon','R',[300,500,700],1,'Center landing magic damage only. Thrown spear physical damage, edge reduction, travel/channel time, Mortal Will attacks and subsequent casts are excluded. Passive armor penetration does not modify this magic packet.',{label:'R · Grand Starfall (center landing)'}),
 },
 Orianna:{
  'cast-q':spell('Orianna','Q',[60,90,120,150,180],.55,'Full damage to the first target along the ball path. Prior-target falloff, ball travel, passive attacks and follow-up spells are excluded.',{label:'Q · Command: Attack (first target)'}),
  'cast-w':spell('Orianna','W',[70,110,150,190,230],.8,'One Dissonance pulse with the ball already in place. Ball setup damage/mana, movement effects and passive attacks are excluded.'),
  'cast-e':spell('Orianna','E',[60,90,120,150,180],.3,'One champion crossed by the returning ball. Shield, defensive stats, ball setup and passive attacks are excluded.',{label:'E · Command: Protect (ball hits enemy)'}),
  'cast-r':spell('Orianna','R',[225,350,475],1.1,'One Shockwave hit with the ball already in place. Ball setup damage/mana, displacement and passive attacks are excluded.'),
 },
 Diana:{
  'cast-q':spell('Diana','Q',[70,105,140,175,210],.7,'One Crescent Strike hit. Moonlight application, Lunar Rush resets and Moonsilver Blade attacks are excluded.'),
  'cast-w':spell('Diana','W',[20,32,44,56,68],.18,'All three orbs hit this champion, approximated together at impact. Shield value, contact timing, passive attacks and other targets are excluded.',{label:'W · Pale Cascade (three orbs hit)',packets:(rank,stats)=>[1,2,3].map(n=>({name:`Pale Cascade orb ${n}`,type:'magic',raw:[20,32,44,56,68][rank-1]+.18*stats.ap}))}),
  'cast-e':spell('Diana','E',[50,70,90,110,130],.6,'One Lunar Rush damage packet. Moonlight setup damage/mana, cooldown resets, repeated dashes and passive attacks are excluded.'),
 },
 Lissandra:{
  'cast-q':spell('Lissandra','Q',[80,115,150,185,220],.75,'One Ice Shard hit. Shattering extends range without adding another hit on the same target; slow and Iceborn thralls are excluded.'),
  'cast-w':spell('Lissandra','W',[70,105,140,175,210],.7,'One Ring of Frost hit. Root, Iceborn thralls and follow-up spells are excluded.'),
  'cast-e':spell('Lissandra','E',[70,105,140,175,210],.6,'One claw passage hit. Teleporting does not grant an extra hit; movement, thralls and follow-up spells are excluded.'),
  'cast-r':spell('Lissandra','R',[150,250,350],.75,'One enemy-target Frozen Tomb hit. Self-cast effects, healing, stun, thralls and other targets are excluded.',{label:'R · Frozen Tomb (enemy target)'}),
 },
 Syndra:{
  'cast-q':spell('Syndra','Q',[90,125,160,195,230],.7,'One Dark Sphere hit with fewer than 120 Splinters (no passive AP multiplier). Extra charge, Splinter generation and follow-up damage are excluded.'),
  'cast-w':spell('Syndra','W',[70,100,130,160,190],.65,'One thrown object hit with fewer than 60 Splinters. Upgraded W bonus true damage, passive AP multiplier, pickup damage and other targets are excluded.',{label:'W · Force of Will (before upgrade)'}),
  'cast-e':spell('Syndra','E',[60,95,130,165,200],.6,'One Scatter the Weak hit with fewer than 120 Splinters (no passive AP multiplier). Sphere collisions do not add another E packet here; stun and follow-up damage are excluded.'),
  'cast-r':spell('Syndra','R',[80,120,160],.2,'Only the three orbiting spheres, with fewer than 120 Splinters (no passive AP multiplier). Ground spheres, upgraded execute, setup casts and sphere travel time are excluded.',{label:'R · Unleashed Power (three spheres)',packets:(rank,stats)=>[1,2,3].map(n=>({name:`Unleashed Power sphere ${n}`,type:'magic',raw:[80,120,160][rank-1]+.2*stats.ap}))}),
 },
 Anivia:{
  'cast-q':spell('Anivia','Q',[50,70,90,110,130],.25,'Both projectile passage and explosion hit this champion, approximated at impact. Travel, stun, Chill setup for other abilities and follow-up E are excluded.',{label:'Q · Flash Frost (passage + explosion)',packets:(rank,stats)=>[{name:'Flash Frost passage',type:'magic',raw:[50,70,90,110,130][rank-1]+.25*stats.ap},{name:'Flash Frost explosion',type:'magic',raw:[60,95,130,165,200][rank-1]+.45*stats.ap}]}),
  'cast-e':spell('Anivia','E',[55,80,105,130,155],.55,'One Frostbite on a target that is not Chilled. No Chill multiplier or setup spell damage.',{label:'E · Frostbite (not Chilled)'}),
  'cast-e-empowered':spell('Anivia','E',[110,160,210,260,310],1.1,'One Frostbite against a target already Chilled, doubling the base spell packet. Q/R setup damage, setup mana and timing are excluded; Chill is an explicit prerequisite.',{label:'E · Frostbite (already Chilled)'}),
 },
 Brand:{
  'cast-q':spell('Brand','Q',[70,100,130,160,190],.65,'One Sear hit. Blaze burn, explosion and stun are excluded.'),
  'cast-w':spell('Brand','W',[75,120,165,210,255],.7,'One Pillar hit against a target that is not Ablaze. The 25% Ablaze bonus, subsequent burn and explosion are excluded.',{label:'W · Pillar of Flame (not Ablaze)'}),
  'cast-e':spell('Brand','E',[55,80,105,130,155],.6,'One Conflagration hit. Blaze burn, explosion and spread to other targets are excluded.'),
  'cast-r':spell('Brand','R',[100,175,250],.3,'One bounce against this champion, charging the initial ultimate mana cost. Further bounces, Blaze burn and explosion are excluded.',{label:'R · Pyroclasm (one bounce)'}),
 },
 Velkoz:{
  'cast-q':spell('Velkoz','Q',[80,120,160,200,240],.9,'One projectile hit, including a split projectile if that is the one that lands. No extra split hit, Organic Deconstruction or researched-target effects.'),
  'cast-w':spell('Velkoz','W',[30,50,70,90,110],.2,'Initial Void Rift hit only. Delayed eruption, second charge and Organic Deconstruction are excluded.',{label:'W · Void Rift (initial hit)'}),
  'cast-e':spell('Velkoz','E',[70,100,130,160,190],.3,'One Tectonic Disruption hit. Organic Deconstruction, knockup and displacement are excluded.'),
 },
 Xerath:{
  'cast-q':spell('Xerath','Q',[70,110,150,190,230],.9,'One beam hit. Charging changes range, not damage; charge time, travel and passive mana restoration are excluded.'),
  'cast-w':spell('Xerath','W',[50,85,120,155,190],.65,'One outer-area hit. Center bonus damage and slow are excluded.',{label:'W · Eye of Destruction (outer area)'}),
  'cast-e':spell('Xerath','E',[70,100,130,160,190],.45,'One Shocking Orb hit; stun duration and travel time are excluded.'),
  'cast-r':spell('Xerath','R',[170,220,270],.45,'First artillery hit on a champion with zero prior ramp stacks. Charges the initial ultimate mana cost; additional shots and champion-hit ramp damage are excluded.',{label:'R · Rite of the Arcane (first shot)'}),
 },
 Neeko:{
  'cast-q':spell('Neeko','Q',[60,110,160,210,260],.6,'Initial explosion only. Conditional second and third blooms, disguise and passive attacks are excluded.',{label:'Q · Blooming Burst (initial hit)'}),
  'cast-e':spell('Neeko','E',[80,115,150,185,220],.65,'One Tangle-Barbs hit. Passing through units changes root duration, not this damage; root and follow-up damage are excluded.'),
 },
 Vex:{
  'cast-q':spell('Vex','Q',[70,115,160,205,250],.7,'One Mistral Bolt hit on an unmarked target. Gloom detonation, Doom fear and travel are excluded.'),
  'cast-w':spell('Vex','W',[80,120,160,200,240],.3,'One Personal Space hit on an unmarked target. Shield value, Gloom detonation and Doom fear are excluded.'),
  'cast-e':spell('Vex','E',[50,70,90,110,130],[.4,.45,.5,.55,.6],'One Looming Darkness hit on an unmarked target. Uses rank-dependent AP scaling; Gloom application/detonation, fear and slow are excluded.'),
  'cast-r':spell('Vex','R',[75,125,175],.2,'Initial missile hit only. Recast arrival damage, Gloom, resets and travel time are excluded.',{label:'R · Shadow Surge (initial hit)'}),
 },
 Seraphine:{
  'cast-e':spell('Seraphine','E',[70,100,130,160,190],.5,'One Beat Drop wave. Echo double-cast, Notes, root/stun and allied interactions are excluded.'),
  'cast-r':spell('Seraphine','R',[150,200,250],.4,'One Encore hit on this champion. Charm, range extensions, Notes and additional targets are excluded.'),
 },
 Karma:{
  'cast-q':spell('Karma','Q',[60,110,160,210,260],.7,'One ordinary Inner Flame hit. Mantra Soulflare impact/field damage, slow and passive cooldown refunds are excluded.',{label:'Q · Inner Flame (without Mantra)'}),
  'cast-w':spell('Karma','W',[40,65,90,115,140],.45,'Initial ordinary tether hit only. Tether completion, Mantra Renewal, healing and root are excluded.',{label:'W · Focused Resolve (initial hit)'}),
 },
 Nami:{
  'cast-q':spell('Nami','Q',[90,145,200,255,310],.5,'One Aqua Prison hit. Suspension, passive movement speed and other targets are excluded.'),
  'cast-w':spell('Nami','W',[60,95,130,165,200],.5,'Direct offensive first hit on this champion. Bounce modifiers, healing, allied casts and Tidecaller procs are excluded.',{label:'W · Ebb and Flow (first offensive hit)'}),
  'cast-r':spell('Nami','R',[150,250,350],.6,'One Tidal Wave hit. Knockup, slow, travel and allied movement speed are excluded.'),
 },
 Janna:{
  'cast-q':spell('Janna','Q',[55,90,125,160,195],.5,'Uncharged tornado hit only. No charge bonus, knockup value or Tailwind attack/W damage.',{label:'Q · Howling Gale (uncharged)'}),
  'cast-q-max':spell('Janna','Q',[85,135,185,235,285],.8,'Fully charged tornado requires three seconds of prior preparation before the scored hit. Setup time, knockup and Tailwind attack/W damage are excluded.',{label:'Q · Howling Gale (fully charged)'}),
 },
 Leblanc:{
  'cast-q':spell('Leblanc','Q',[65,90,115,140,165],.4,'Initial Sigil hit only. The mark needs another ability to trigger; mark detonation and that trigger damage are excluded.',{label:'Q · Sigil of Malice (initial hit)'}),
  'cast-w':spell('Leblanc','W',[75,115,155,195,235],.9,'One Distortion landing against an unmarked champion. Sigil detonation, Mimic, return positioning and other targets are excluded.'),
  'cast-e':spell('Leblanc','E',[50,70,90,110,130],.4,'Initial Ethereal Chains hit on an unmarked target only. Delayed tether damage, Sigil detonation, root and Mimic are excluded.',{label:'E · Ethereal Chains (initial hit)'}),
 },
 Lucian:{
  'cast-q':spell('Lucian','Q',[90,130,170,210,250],0,'One Piercing Light hit, scaling with bonus AD. Lightslinger, Vigilance, attacks and item procs are excluded.',{profile:'physical',bonusAD:1}),
  'cast-w':spell('Lucian','W',[75,110,145,180,215],.9,'One Ardent Blaze hit. Mark triggers, Vigilance, Lightslinger, attacks and movement value are excluded.'),
 },
 Corki:{
  'cast-q':spell('Corki','Q',[60,105,150,195,240],1,'One Phosphorus Bomb magic hit, scaling with bonus AD and AP. Hextech Munitions attack damage, item procs and vision are excluded.',{bonusAD:1.25}),
  'cast-r':spell('Corki','R',[90,170,250],0,'One ordinary missile physical hit, scaling with bonus AD. Big One damage, additional missiles, attack passive and charge refunds are excluded.',{label:'R · Missile Barrage (ordinary missile)',profile:'physical',bonusAD:.85}),
 },
 Lux:{
  'cast-q':spell('Lux','Q',[80,120,160,200,240],.75,'One target hit. Illumination damage, root and subsequent attacks are excluded.'),
  'cast-e':spell('Lux','E',[65,115,165,215,265],.8,'One detonation; slow, vision and Illumination are excluded.'),
  'cast-r':spell('Lux','R',[300,400,500],1.2,'One unmarked champion hit. Existing Illumination detonation and new mark damage are excluded.'),
 },
 Veigar:{
  'cast-q':spell('Veigar','Q',[80,120,160,200,240],[.5,.55,.6,.65,.7],'One target. Enter finite Phenomenal Evil AP through Extra AP; stacks are not automatically earned.'),
  'cast-w':spell('Veigar','W',[85,140,195,250,305],[.7,.8,.9,1,1.1],'One landed meteor. Enter earned passive AP explicitly; cooldown reduction and repeated casts are excluded.'),
 },
 Malphite:{
  'cast-q':spell('Malphite','Q',[70,120,170,220,270],.6,'One hit. Armor-dependent E/W, Granite Shield, slow and movement theft are outside this objective.'),
  'cast-r':spell('Malphite','R',[200,300,400],.9,'One landing on a champion. Knockup, travel and other spell damage are excluded.'),
 },
 Ezreal:{
  'cast-q':spell('Ezreal','Q',[20,45,70,95,120],.4,'One Mystic Shot hit using total AD. Spellblade, Muramana Shock, on-hit effects, passive stacks and cooldown refunds are excluded.',{profile:'physical',totalAD:1.3}),
  'cast-w':spell('Ezreal','W',[80,135,190,245,300],.9,'Only the W detonation packet, assuming a separate trigger lands. Trigger damage and its mana cost/refund are excluded; W alone does not detonate.',{bonusAD:1}),
  'cast-e':spell('Ezreal','E',[80,130,180,230,280],.75,'One Arcane Shift bolt reaches this champion. W detonation, on-hit effects and movement value are excluded.',{bonusAD:.6}),
  'cast-r':spell('Ezreal','R',[350,550,750],1.1,'One champion struck by the ultimate. Minion/monster rules, other targets and travel time are excluded.',{bonusAD:1}),
 },
 Gragas:{
  'cast-q':spell('Gragas','Q',[80,120,160,200,240],.8,'Immediate uncharged barrel detonation; no maturation bonus.',{label:'Q · Barrel Roll (uncharged)'}),
  'cast-q-max':spell('Gragas','Q',[80,120,160,200,240],.8,'Fully matured barrel: 1.5 times uncharged damage. Requires two seconds of preparation before the scored detonation; setup time and slow are excluded.',{label:'Q · Barrel Roll (fully matured)',packets:(rank,stats)=>[{name:'Fully matured Barrel Roll',type:'magic',raw:1.5*([80,120,160,200,240][rank-1]+.8*stats.ap)}]}),
  'cast-w':spell('Gragas','W',[20,50,80,110,140],.7,'One empowered noncritical attack: normal AD physical damage plus W magic damage and 7% target maximum HP. Item on-hits, Spellblade and damage reduction are excluded.',{label:'W · Drunken Rage attack (noncritical)',profile:'mixed',packets:(rank,stats,s)=>[{name:'Delivery attack (noncritical)',type:'physical',raw:stats.ad},{name:'Drunken Rage bonus',type:'magic',raw:[20,50,80,110,140][rank-1]+.7*stats.ap+.07*s.targetHP}]}),
  'cast-e':spell('Gragas','E',[80,125,170,215,260],.6,'One champion collision. Displacement, cooldown refund and subsequent casts are excluded.'),
  'cast-r':spell('Gragas','R',[200,300,400],.8,'One explosion against a champion; displacement is not scored.'),
 },
 Chogath:{
  'cast-q':spell('Chogath','Q',[80,135,190,245,300],1,'One Rupture hit. Knockup, slow and other attacks are excluded.'),
  'cast-w':spell('Chogath','W',[80,130,180,230,280],.7,'One scream hit. Silence and follow-up attacks are excluded.'),
  'cast-r':spell('Chogath','R',[300,475,650],.5,'Champion Feast damage: 10% bonus HP, not total HP. Enter existing Feast-stack health through Extra bonus HP. No automatic stack earning, monster damage or kill prediction.',{profile:'true',bonusHP:.1}),
 },
 Ahri:{
  'cast-q':spell('Ahri','Q',[35,60,85,110,135],.5,'Both outgoing and returning orb hit the same champion. Impact times are approximated at zero; travel, hit probability and healing are excluded. True return damage receives no damage amplification.',{label:'Q · Orb (both passes land)',profile:'mixed',packets:(rank,stats)=>{const raw=[35,60,85,110,135][rank-1]+.5*stats.ap;return [{name:'Orb outward',type:'magic',raw},{name:'Orb return',type:'true',raw}]}}),
  'cast-w':spell('Ahri','W',[40,60,80,100,120],.4,'All three fox-fires hit one champion: first at full damage, next two at 40% each. Acquisition, timing and movement are excluded.',{label:'W · Fox-Fire (three hits)',packets:(rank,stats)=>{const raw=[40,60,80,100,120][rank-1]+.4*stats.ap;return [1,.4,.4].map((mult,index)=>({name:`Fox-Fire ${index+1}`,type:'magic',raw:raw*mult}))}}),
  'cast-e':spell('Ahri','E',[80,120,160,200,240],.85,'One Charm hit. Crowd control and subsequent spell hits are excluded.'),
  'cast-r':spell('Ahri','R',[75,125,175],.35,'One bolt against this champion during one dash, charging the initial 100 mana. Bolts hit different targets; recasts, takedown resets and additional dashes are excluded.',{label:'R · Spirit Rush (one dash hit)'}),
 },
 Morgana:{
  'cast-q':spell('Morgana','Q',[80,135,190,245,300],.9,'One binding hit. Root, healing and follow-up spells are excluded.'),
  'cast-r':spell('Morgana','R',[200,275,350],.8,'Initial Soul Shackles hit at 0s; second hit at 3s only when the observation window reaches 3s, assuming the tether remains intact. Movement, stun and healing are excluded.',{label:'R · Soul Shackles (tether retained)',packets:(rank,stats,s)=>{const raw=[200,275,350][rank-1]+.8*stats.ap;return [{name:'Soul Shackles initial',type:'magic',raw},...(s.duration>=3?[{name:'Soul Shackles tether follow-up',type:'magic' as const,raw,time:3}]:[])]}}),
 },
 Ziggs:{
  'cast-q':spell('Ziggs','Q',[80,130,180,230,280],[.6,.65,.7,.75,.8],'One bomb explosion on a champion. Bounces do not add damage; passive attacks are excluded.'),
  'cast-w':spell('Ziggs','W',[70,105,140,175,210],.5,'One satchel explosion against a champion. Tower execution and knockback are excluded.'),
  'cast-r':spell('Ziggs','R',[300,500,700],1,'One champion hit; center damage is full, edge damage is 65%. No other targets or travel time.',{packets:(rank,stats,s)=>[{name:`Mega Inferno Bomb (${s.center?'center':'edge'})`,type:'magic',raw:([300,500,700][rank-1]+stats.ap)*(s.center?1:.65)}]}),
 },
 Amumu:{
  'cast-q':spell('Amumu','Q',[70,95,120,145,170],.85,'One Bandage Toss against an uncursed target. Curse conversion, second charge, stun and passive damage are excluded.'),
  'cast-e':spell('Amumu','E',[65,95,125,155,185],.5,'One Tantrum cast against an uncursed target. Curse conversion, incoming-hit cooldown refunds and damage reduction are excluded.'),
  'cast-r':spell('Amumu','R',[200,300,400],.8,'One ultimate hit against an uncursed target. Curse application does not grant assumed extra true damage to this packet. Existing Curse and allied damage are excluded.'),
 },
 Karthus:{
  'cast-q':spell('Karthus','Q',[40,59,78,97,116],.35,'One non-isolated Lay Waste hit. No repeated casts, passive free-casting or item procs.',{label:'Q · Lay Waste (not isolated)'}),
  'cast-q-isolated':spell('Karthus','Q',[80,118,156,194,232],.7,'One isolated enemy is the only unit hit, doubling the non-isolated packet. Repeated casts and passive free-casting are excluded.',{label:'Q · Lay Waste (isolated)'}),
  'cast-r':spell('Karthus','R',[200,350,500],.7,'One champion hit after an uninterrupted three-second channel. Windows shorter than 3s produce no hit; initial mana is still spent. Invulnerability, shields, passive free-casting and other targets are excluded.',{packets:(rank,stats,s)=>s.duration>=3?[{name:'Requiem',type:'magic',raw:[200,350,500][rank-1]+.7*stats.ap,time:3}]:[]}),
 },
};
export const abilityModel=(alias:string,mode:string)=>abilityModels[alias]?.[mode as CastMode];
export const castModes:CastMode[]=['cast-q','cast-w','cast-e','cast-r','cast-q-max','cast-q-isolated','cast-e-empowered','cast-q-empowered','cast-w-empowered','cast-r-empowered'];

export interface PenetrationRule {slot:string;kind:'magic'|'physical';values:number[]}
export const penetrationRules:Record<string,PenetrationRule>={
 Annie:{slot:'R',kind:'magic',values:[.1,.15,.2]},
 Mordekaiser:{slot:'E',kind:'magic',values:[.05,.075,.1,.125,.15]},
 Ambessa:{slot:'R',kind:'physical',values:[.1,.2,.3]},
 Zaahen:{slot:'R',kind:'physical',values:[.1,.2,.3]},
};
export function learnedPenetration(s:Scenario){
 const rule=penetrationRules[s.champion];if(!rule)return undefined;
 const model=abilityModel(s.champion,s.mode);
 const rank=model?.slot===rule.slot?Math.min(model.rankCap,Math.max(1,Math.round(s.rank))):Math.min(rule.values.length,Math.max(0,Math.round(s.penetrationRank??0)));
 return {...rule,rank,value:rank?rule.values[rank-1]:0};
}

export const traitRules:Record<string,{slot:string;label:string;max:number}>={Taric:{slot:'W',label:'W rank (Bastion armor)',max:5},Tryndamere:{slot:'Q',label:'Q rank (Bloodlust AD)',max:5},Nilah:{slot:'Q',label:'Q rank (passive penetration)',max:5}};
export const traitRank=(s:Scenario)=>{const rule=traitRules[s.champion];if(!rule)return 0;return abilityModel(s.champion,s.mode)?.slot===rule.slot?Math.min(rule.max,Math.max(1,Math.round(s.rank))):Math.min(rule.max,Math.max(0,Math.round(s.traitRank??0)))};

export const baseCritDamage=(alias:string)=>(source.characterStats as Record<string,{critDamageMultiplier:number}>)[alias]?.critDamageMultiplier??2;
