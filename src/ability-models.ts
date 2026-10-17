import source from './ability-sources.json';
import type {Result,Scenario} from './types';
export type CastMode='cast-q'|'cast-w'|'cast-e'|'cast-r'|'cast-q-max'|'cast-q-isolated'|'cast-e-empowered'|'cast-q-empowered'|'cast-w-empowered'|'cast-r-empowered';
type Stats=Result['stats'];
type DamageType=Result['events'][number]['type'];
export interface Packet {name:string;type:DamageType;raw:number;time?:number}
export interface AbilityModel {label:string;slot:string;rankCap:number;cost:number[];sourcePath:string;notes:string;targetHealth?:boolean;profile:'magic'|'physical'|'true'|'mixed';packets:(rank:number,stats:Stats,s:Scenario)=>Packet[]}
type Coefficient=number|number[];
const at=(values:Coefficient,rank:number)=>typeof values==='number'?values:values[rank-1];
const records=source.records as Record<string,Record<string,{name:string;cost:number[];path:string}>>;
const currentHP=(s:Scenario)=>s.targetHP*Math.min(100,Math.max(0,s.targetHealthPercent??100))/100;
function spell(alias:string,slot:string,base:number[],ap:Coefficient,notes:string,options:{label?:string;profile?:AbilityModel['profile'];targetHealth?:boolean;bonusAD?:Coefficient;totalAD?:Coefficient;bonusHP?:number;packets?:AbilityModel['packets']}={}):AbilityModel {
 const record=records[alias][slot];const type=options.profile==='physical'?'physical':options.profile==='true'?'true':'magic';
 return {label:options.label||`${slot} · ${record.name}`,slot,rankCap:base.length,cost:record.cost,sourcePath:record.path,notes,targetHealth:options.targetHealth,profile:options.profile||'magic',packets:options.packets||((rank,stats)=>[{name:record.name,type,raw:base[rank-1]+at(ap,rank)*stats.ap+at(options.bonusAD??0,rank)*stats.bonusAD+at(options.totalAD??0,rank)*stats.ad+(options.bonusHP||0)*stats.bonusHP}])};
}
export const abilityModels:Record<string,Partial<Record<CastMode,AbilityModel>>>={
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
