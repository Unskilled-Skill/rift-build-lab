import type { Champion, Item, Result, Scenario } from './types';
import {createAttackEffects} from './combat-attack-effects';

export interface ProcHit {
 castId?:string|number;time:number;type:'magic'|'physical'|'true';raw:number;damage:number;
 kind:'ability'|'attack'|'on-hit';periodic?:boolean;aoe?:boolean;spellEffects?:boolean;appliesOnHit?:boolean;onHitMultiplier?:number;targetHealthPercent:number;
}
export interface ProcPacket {time:number;name:string;type:ProcHit['type'];raw:number;origin:'rune'|'item';amplification?:'none'|'general';currentHPRatio?:number;activatesPTA?:boolean;excludePTA?:boolean}

// Rune coefficients: public/data/catalog.json, patch 26.20, effectValuesRaw and
// calculationRaw (Summoner's Rift, not gameModeOverrides). No catalog is bundled.
// Item ratios: 16.20 game/items.cdtb.bin.json, Items/<id> mDataValues and
// mItemCalculations; compact provenance lives in scripts/combat-source-evidence.json.
export function createProcEffects(champion:Champion,items:Item[],s:Scenario,stats:Result['stats']) {
 const notes:string[]=[],implemented:string[]=[];
 const attacks=createAttackEffects(champion,items,s,stats);
 notes.push(...attacks.notes);implemented.push(...attacks.implemented);
 const attackActions=new Set<string|number>();
 const e=s.effects??{},runes=new Set(s.runePage),ids=new Set(items.map(i=>i.id));
 const ready=e.runeProcsReady===true,itemReady=e.itemProcsReady===true;
 const clamp=(n:number|undefined,min:number,max:number,fallback=0)=>Number.isFinite(n)?Math.min(max,Math.max(min,n!)):fallback;
 const level=clamp(s.level,1,18,1),lerp=(a:number,b:number)=>a+(b-a)*(level-1)/17;
 const horizon=clamp(s.duration,0,60),ap=clamp(stats.ap,0,1e7),ad=clamp(stats.bonusAD,0,1e7);
 // Same adaptive-force preference as the stat engine; ties follow the damage
 // kind of the triggering native packet, avoiding an invented default attack.
 const adaptive=(hit:ProcHit):'physical'|'magic'=>ad>ap*.6?'physical':ad<ap*.6?'magic':hit.type==='physical'?'physical':'magic';
 let cometAt=-Infinity,scorchAt=-Infinity,harvestAt=-Infinity,aerySent=false;
 let souls=clamp(e.darkHarvestStacks,0,1000),strikeStart:number|undefined;
 let hailStart=-Infinity,hailLast=-Infinity,hailCount=0,spellbladeUsed=false,energizedUsed=false;
 let liandryEnd=-Infinity,deathfireEnd=-Infinity,deathfireStart=-Infinity;
 let heartsteelUsed=false;const shockCasts=new Set<string|number>();
 let ludenAt=-Infinity,ludenCharges=Math.floor(clamp(e.ludenCharges,0,6));
 if(runes.has(8229)) {implemented.push('Arcane Comet');notes.push('Arcane Comet requires ready rune procs and the comet-hit option. Range amplification uses the entered distance (0–750); arrival is treated as immediate at the hit timestamp. Cooldown refunds and projectile travel are omitted.');}
 if(runes.has(8214)) {implemented.push('Summon Aery');notes.push('Aery damage is counted once when rune procs are ready. Return travel, repeat launches and ally shields are not simulated.');}
 if(runes.has(8237))implemented.push('Scorch');
 if(runes.has(8128)) {implemented.push('Dark Harvest');notes.push('Dark Harvest uses the entered earned souls and actual below-50% hit state; takedown cooldown resets are excluded.');}
 if(runes.has(8369)) {implemented.push('First Strike');notes.push('First Strike requires its explicit ready opening condition. The first native hit opens one three-second window; separate true packets equal 7% of native post-mitigation damage. Item/rune proc damage, gold and subsequent combat resets are excluded.');}
 if(runes.has(9923)) {implemented.push('Hail of Blades damage');notes.push('Hail of Blades true damage applies to the first three actual attacks when rune procs are ready. No attacks, reset extensions or attack-speed timing are generated here.');}
 if(runes.has(8992)) {implemented.push('Deathfire Touch');notes.push('Deathfire Touch refreshes one burn: single-target 4s, area 2s, periodic 1s. Unclassified ability packets conservatively use 1s. Half-second damage packets approximate burn ticks; amplification starts after three continuous seconds.');}
 if(ids.has(6653)) {implemented.push('Liandry Torment');notes.push('Liandry Torment uses 2% target maximum HP per second for three seconds after an actual ability hit, refreshing one burn. One-second integrated packets and partial refresh tails approximate tick timing; item readiness must be enabled.');}
 if(ids.has(3094)) {implemented.push('Rapid Firecannon');notes.push('Rapid Firecannon contributes one ready Energized attack for 40 magic damage when item readiness is enabled. Movement, range and subsequent Energized charge generation are excluded.');}
 if(ids.has(3078)||ids.has(3508)||ids.has(3100)) {implemented.push('Spellblade');notes.push('Explicitly ready Spellblade is consumed by one actual attack/on-hit delivery only. Its 1.5s cooldown does not invent a later cast or re-arming. Current 26.20 source: Trinity 200% base AD; Essence Reaver 125% base AD + 50 × crit chance; Lich Bane 75% base AD + 45% AP. Mana refund and Lich Bane attack-speed timing are excluded.');}
 if(ids.has(3115)){implemented.push("Nashor's Tooth");notes.push("Nashor's Tooth adds 15 + 15% AP magic damage to each explicitly modelled full on-hit delivery with item readiness enabled. Reduced-effectiveness or additional phantom deliveries must be modelled separately; no extra attacks are invented.");}
 if(ids.has(6655)){implemented.push("Luden's Echo");notes.push("Luden's Echo uses the entered 0–6 ready Echoes: 75 + 5% AP for the first, 20% per repeat, at most twice base damage on the isolated target. After firing, the 12s cooldown restores six Echoes for a later actual ability hit. No nearby targets or missile travel are simulated; zero initial charges grant no opening proc.");}
 const ranged=e.attackForm?e.attackForm==='ranged':(champion.stats.attackrange??125)>300;
 if(champion.alias==='Urgot'&&s.mode==='cast-w')notes.push('Purge uses its source 50% on-hit effectiveness for Nashor, Titanic, Terminus, Spellblade and attack Shock. Heartsteel and Energized eligibility on this special attack remain unverified and are excluded; one shot does not generate further attacks.');
 if(ids.has(3748)){implemented.push('Titanic Hydra Cleave');notes.push('Titanic primary-target on-hit uses 1% max HP, halved for ranged. Splash, active Crescent and attack-reset timing are excluded.');}
 if(ids.has(3084)){implemented.push('Heartsteel Colossal Consumption');notes.push('Heartsteel adds one explicitly ready proximity proc: 70 + 6% current maximum HP. Same-hit gained HP, repeated target charges and later health growth are not generated.');}
 if(ids.has(3042)){implemented.push('Muramana Shock');notes.push('Muramana Shock: 1.2% max mana on actual attacks, 3% ranged / 4% melee on ability hits. A selected cast triggers Shock once; distinct modeled casts/attacks have separate identities. No fresh cast is inferred from a damage-over-time tick; mixed proc ordering remains approximate.');}
 if(ids.has(3302)){implemented.push('Terminus Juxtaposition on-hit');notes.push('Terminus adds 30 + 10% bonus AD + 10% AP on full on-hit deliveries. Supplied Light/Dark states do not generate new attacks or stacks.');}
 // Only native damage enters this callback. Returned packets must never be fed
 // back into it: First Strike, burns and on-hits cannot recursively proc each other.
 function onHit(hit:ProcHit):ProcPacket[] {
  const out:ProcPacket[]=[];
  if(!Number.isFinite(hit.time)||hit.time<0||hit.time>horizon||!Number.isFinite(hit.raw)||hit.raw<=0||!Number.isFinite(hit.damage)||hit.damage<=0)return out;
  const emit=(time:number,name:string,type:ProcHit['type'],raw:number,origin:ProcPacket['origin'])=>{
   if(time<=horizon+1e-9&&time>=0&&Number.isFinite(raw)&&raw>0)out.push({time:Math.min(time,horizon),name,type,raw,origin,...(name==='First Strike'?{amplification:'none' as const}:{})});
  };
  const spell=hit.spellEffects??(hit.kind==='ability'),attack=hit.kind==='attack',delivery=hit.appliesOnHit??(attack||hit.kind==='on-hit');
  const action=hit.castId??(attack?`attack@${hit.time}`:'selected-cast'),freshAttack=attack&&!attackActions.has(action);
  if(attack)attackActions.add(action);
  out.push(...attacks.onHit(hit));
  const onHit=clamp(hit.onHitMultiplier,0,1,1);
  if(ready&&runes.has(8229)&&spell&&hit.time>=cometAt&&e.cometHit!==false){
   emit(hit.time,'Arcane Comet',adaptive(hit),(lerp(15,100)+.05*ap+.1*ad)*(1+clamp(e.cometDistance,0,750)/750),'rune');
   cometAt=hit.time+lerp(20,8);
  }
  if(ready&&runes.has(8214)&&!aerySent&&(spell||attack)){
   emit(hit.time,'Summon Aery',adaptive(hit),lerp(10,50)+.05*ap+.1*ad,'rune');aerySent=true;
  }
  if(ready&&runes.has(8237)&&spell&&hit.time>=scorchAt){
   emit(hit.time+1,'Scorch','magic',lerp(20,40),'rune');scorchAt=hit.time+10;
  }
  if(ready&&runes.has(8128)&&hit.targetHealthPercent<50&&hit.time>=harvestAt){
   emit(hit.time,'Dark Harvest',adaptive(hit),30+11*souls+.1*ad+.05*ap,'rune');souls++;harvestAt=hit.time+35;
  }
  if(runes.has(8369)&&s.firstStrikeReady&&(spell||attack||hit.kind==='on-hit')){
   strikeStart??=hit.time;
   if(hit.time<strikeStart+3)emit(hit.time,'First Strike','true',hit.damage*.07,'rune');
  }
  if(ready&&runes.has(9923)&&freshAttack){
   if(hailCount===0){hailStart=hit.time;hailCount=1;}
   else if(hit.time-hailLast<=3&&hailCount<3)hailCount++;
   else if(hit.time>=hailStart+10){hailStart=hit.time;hailCount=1;}
   else {hailCount=3;hailLast=hit.time;return finish();}
   hailLast=hit.time;emit(hit.time,'Hail of Blades','true',lerp(2,20)+.12*ad+.1*ap,'rune');
  }
  return finish();
  function finish(){
   if(itemReady&&delivery&&ids.has(3748))emit(hit.time,'Titanic Hydra primary Cleave','physical',stats.hp*.01*(ranged?.5:1)*onHit,'item');
   if(itemReady&&delivery&&ids.has(3302))emit(hit.time,'Terminus Juxtaposition','magic',(30+.1*ad+.1*ap)*onHit,'item');
   if(itemReady&&attack&&onHit===1&&ids.has(3084)&&e.heartsteelReady&&!heartsteelUsed){emit(hit.time,'Heartsteel Colossal Consumption','physical',70+.06*stats.hp,'item');heartsteelUsed=true;}
   if(itemReady&&ids.has(3042)&&(spell||attack)&&!shockCasts.has(hit.castId??'selected-cast')){
    emit(hit.time,'Muramana Shock','physical',stats.mana*(spell?(ranged?.03:.04):.012*onHit),'item');shockCasts.add(hit.castId??'selected-cast');
   }
   if(itemReady&&ids.has(3094)&&attack&&onHit===1&&!energizedUsed){emit(hit.time,'Rapid Firecannon Energized','magic',40,'item');energizedUsed=true;}
   if(itemReady&&ids.has(3115)&&delivery)emit(hit.time,"Nashor's Tooth Icathian Bite",'magic',(15+.15*ap)*onHit,'item');
   if(s.spellbladeReady&&delivery&&!spellbladeUsed){
    if(ids.has(3078))emit(hit.time,'Trinity Force Spellblade','physical',2*stats.baseAD*onHit,'item');
    else if(ids.has(3508))emit(hit.time,'Essence Reaver Spellblade','physical',(1.25*stats.baseAD+50*clamp(stats.critChance,0,1))*onHit,'item');
    else if(ids.has(3100))emit(hit.time,'Lich Bane Spellblade','magic',(.75*stats.baseAD+.45*ap)*onHit,'item');
    spellbladeUsed=true;
   }
   if(itemReady&&ids.has(6655)&&spell&&ludenCharges>0&&hit.time>=ludenAt){
    emit(hit.time,`Luden's Echo (${ludenCharges} isolated Echoes)`,'magic',(75+.05*ap)*(1+.2*(ludenCharges-1)),'item');
    ludenAt=hit.time+12;ludenCharges=6;
   }
   // Refresh tails are disjoint. A DoT tick cannot add a second independent burn
   // on top of a queued burn, and revisiting the same timestamp adds no damage.
   if(itemReady&&ids.has(6653)&&spell){
    const from=Math.max(hit.time,liandryEnd),until=Math.min(horizon,hit.time+3);
    for(let t=from;t<until-1e-9;t=Math.min(t+1,until)){
     const end=Math.min(t+1,until);emit(end,'Liandry Torment','magic',clamp(s.targetHP,0,1e8)*.02*(end-t),'item');
    }
    liandryEnd=Math.max(liandryEnd,hit.time+3);
   }
   if(ready&&runes.has(8992)&&spell){
    if(hit.time>deathfireEnd){deathfireStart=hit.time;deathfireEnd=hit.time;}
    const duration=hit.periodic?1:hit.aoe===true?2:hit.aoe===false?4:1;
    const from=Math.max(hit.time,deathfireEnd),until=Math.min(horizon,hit.time+duration);
    for(let t=from;t<until-1e-9;){
     // Split at the ramp boundary as well as at normalized half-second ticks.
     let end=Math.min(t+.5,until);
     if(t<deathfireStart+3&&end>deathfireStart+3)end=deathfireStart+3;
     emit(end,'Deathfire Touch','magic',(lerp(3,12)+.025*ap+.07*ad)*(end-t)*(t>=deathfireStart+3?1.75:1),'rune');t=end;
    }
    deathfireEnd=Math.max(deathfireEnd,hit.time+duration);
   }
   return out;
  }
 }
 return {onHit,notes,implemented};
}
