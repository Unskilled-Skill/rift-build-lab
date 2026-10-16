import source from './ability-sources.json';
import type {Result,Scenario} from './types';
export type CastMode='cast-q'|'cast-w'|'cast-e'|'cast-r'|'cast-q-max'|'cast-q-isolated';
type Stats=Result['stats'];
type DamageType=Result['events'][number]['type'];
export interface Packet {name:string;type:DamageType;raw:number;time?:number}
export interface AbilityModel {label:string;slot:string;rankCap:number;cost:number[];sourcePath:string;notes:string;profile:'magic'|'physical'|'true'|'mixed';packets:(rank:number,stats:Stats,s:Scenario)=>Packet[]}
type Coefficient=number|number[];
const at=(values:Coefficient,rank:number)=>typeof values==='number'?values:values[rank-1];
const records=source.records as Record<string,Record<string,{name:string;cost:number[];path:string}>>;
function spell(alias:string,slot:string,base:number[],ap:Coefficient,notes:string,options:{label?:string;profile?:AbilityModel['profile'];bonusAD?:number;totalAD?:number;bonusHP?:number;packets?:AbilityModel['packets']}={}):AbilityModel {
 const record=records[alias][slot];const type=options.profile==='physical'?'physical':options.profile==='true'?'true':'magic';
 return {label:options.label||`${slot} · ${record.name}`,slot,rankCap:base.length,cost:record.cost,sourcePath:record.path,notes,profile:options.profile||'magic',packets:options.packets||((rank,stats)=>[{name:record.name,type,raw:base[rank-1]+at(ap,rank)*stats.ap+(options.bonusAD||0)*stats.bonusAD+(options.totalAD||0)*stats.ad+(options.bonusHP||0)*stats.bonusHP}])};
}
export const abilityModels:Record<string,Partial<Record<CastMode,AbilityModel>>>={
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
export const castModes:CastMode[]=['cast-q','cast-w','cast-e','cast-r','cast-q-max','cast-q-isolated'];
