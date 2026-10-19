import {combatStatBonuses,applyCombatDefenses} from './combat-stat-effects';
import {createDamageEffects} from './combat-damage-effects';
import {effectTags} from './combat-effect-tags';
import {createProcEffects} from './combat-proc-effects';
import {championResource} from './resources';
import {abilityModel,learnedPenetration,traitRank,baseCritDamage} from './ability-models';
import {modeledItemIds} from './build-rules';
export {legalBuild,modeledItemIds} from './build-rules';
export {defaultScenario} from './scenario';
import {objectiveSupport} from './model-support';
import type { Champion, Item, Result, Scenario } from './types';
export const growth=(level:number)=>.7025*(level-1)+.0175*(level-1)**2;
export function mitigate(damage:number,resistance:number,percentPen=0,flatPen=0){const effective=resistance<0?resistance:Math.max(0,resistance*(1-percentPen)-flatPen);return damage*(effective>=0?100/(100+effective):2-100/(100-effective));}
const scopeNotes:Record<number,string>={3137:'Cryptbloom healing is outside this damage objective.',3116:'Rylai slow is outside this damage objective.',4629:'Cosmic movement speed is outside this damage objective.',3083:'Warmog out-of-combat healing is excluded.',2501:'Bloodmail Retribution uses your explicitly entered AD bonus; its missing-health curve is unresolved.',3748:'Titanic primary on-hit is modeled on explicit deliveries; active and secondary splash are excluded.',3065:'Visage healing and shielding are excluded.',3157:'Zhonya stasis is outside this damage objective.',3102:'Banshee spell shield is outside this damage objective.',3084:'Heartsteel uses finite earned HP and one explicitly charged attack proc; no future stacks are invented.'};
export function calculate(champion:Champion,items:Item[],s:Scenario):Result{
 if(!objectiveSupport(champion.alias,s.mode).supported)throw new Error('No numerical adapter for this champion objective.');
 const resource=championResource(champion.alias);const alias=champion.alias;
 const prepared=combatStatBonuses(champion,items,s);
 const level=Math.min(18,Math.max(1,s.level)),rank=Math.min(5,Math.max(1,s.rank)),eRank=Math.min(5,Math.max(1,s.eRank));
 const has=(id:number)=>items.some(i=>i.id===id);
 // Searches call this hundreds of thousands of times. Accumulate directly instead of
 // allocating flattened and filtered stat arrays for every lookup; preserve source order.
 const stat=(name:string,unit?:string)=>{let total=0;for(const item of items)for(const value of item.baseStats)if(value.name===name&&(!unit||value.unit===unit))total+=value.value;return total};
 let ap=stat('Ability Power')+s.extraAP,bonusAD=stat('Attack Damage')+s.extraAD,haste=stat('Ability Haste')+prepared.haste,bonusHP=stat('Health')+s.extraHP+prepared.bonusHP;
 bonusAD+=prepared.bonusAD;
 const itemHP=stat('Health');if(has(3083))bonusHP+=itemHP*.12;
 if(has(3084))bonusHP+=s.heartsteelHP;
 let mana=resource.kind==='mana'?(champion.stats.mp||0)+(champion.stats.mpperlevel||0)*growth(level)+stat('Mana')+prepared.bonusMana:0;
 if(has(6657)){const stacks=Math.min(10,Math.max(0,s.rodStacks));ap+=stacks*3;bonusHP+=stacks*10;if(resource.kind==='mana')mana+=stacks*30;}
 if(has(3042))bonusAD+=mana*.02;
 // Nonadaptive shard stats contribute to item conversions before choosing adaptive force.
 for(const id of s.shards){if(id===5001)bonusHP+=10+10*(level-1);if(id===5011)bonusHP+=65;if(id===5007)haste+=8;}
 const baseHP=(champion.stats.hp||0)+(champion.stats.hpperlevel||0)*growth(level);
 bonusHP=(baseHP+bonusHP)*prepared.hpMultiplier-baseHP;
 const critChance=Math.min(1,Math.max(0,stat('Critical Strike Chance','percent')/100)),critDamage=baseCritDamage(alias)+stat('Critical Strike Damage','percent')/100,bonusAS=stat('Attack Speed','percent')/100+(s.shards.includes(5005)?.1:0)+Math.min(500,Math.max(0,s.extraAS??0))/100+prepared.bonusAS;
 if(alias==='Pyke'){bonusAD+=bonusHP/14;bonusHP=0;}
 if(alias==='Aphelios')bonusAD+=4*Math.floor(Math.min(6,Math.max(0,s.abilityStacks??0)));
 if(alias==='Tryndamere'&&traitRank(s))bonusAD+=[20,35,50,65,80][traitRank(s)-1]*Math.min(1,Math.max(0,(100-s.healthPercent)/90));
 const ornnAmp=champion.alias==='Ornn'?1.1+.04*Math.floor(Math.min(5,Math.max(0,s.abilityStacks??0))):1;
 if(champion.alias==='Ornn')bonusHP*=ornnAmp;
 const baseArmor=(champion.stats.armor||0)+(champion.stats.armorperlevel||0)*growth(level),baseMR=(champion.stats.spellblock||0)+(champion.stats.spellblockperlevel||0)*growth(level);
 let bonusArmor=(stat('Armor')+Math.min(10000,Math.max(0,s.extraArmor??0)))*ornnAmp,bonusMR=(stat('Magic Resist')+Math.min(10000,Math.max(0,s.extraMR??0)))*ornnAmp;
 if(champion.alias==='Rammus'&&s.mode==='cast-w'){
  const r=Math.min(5,Math.max(1,Math.round(s.rank)))-1,multiplier=[1.3,1.375,1.45,1.525,1.6][r];
  bonusArmor=(baseArmor+bonusArmor+[27,32,37,42,47][r])*multiplier-baseArmor;bonusMR=(baseMR+bonusMR+[20,25,30,35,40][r])*multiplier-baseMR;
 }
 if(alias==='Taric'&&traitRank(s))bonusArmor+=(baseArmor+bonusArmor)*[.06,.07,.08,.09,.1][traitRank(s)-1];
 const defense=applyCombatDefenses(baseArmor,baseMR,bonusArmor,bonusMR,items,s);
 bonusArmor=defense.bonusArmor;bonusMR=defense.bonusMR;
 const armor=baseArmor+bonusArmor,mr=baseMR+bonusMR;
 if(champion.alias==='Rammus')bonusAD+=.15*(armor+mr);
 const baseAD=(champion.stats.attackdamage||0)+(champion.stats.attackdamageperlevel||0)*growth(level);
 const whisperLevel=.04+.01*(Math.min(9,level)-1)+.02*Math.max(0,Math.min(11,level)-9)+.04*Math.max(0,level-11);
 const whisper=alias==='Jhin'?1+whisperLevel+.35*critChance+.3*bonusAS:1;
 const itemAD=(value:number)=>{const result=has(2501)?(baseAD+value+bonusHP*.025)*(1+Math.min(.12,Math.max(0,s.bloodmailBonus/100)))-baseAD:value;return alias==='Jhin'?(baseAD+result)*whisper-baseAD:result;};
 const itemAP=(value:number)=>{
  const deathcap=has(3089)?1.3:1,seraph=has(3040)?.02:0,baseMana=resource.kind==='mana'?(champion.stats.mp||0)+(champion.stats.mpperlevel||0)*growth(level):0;
  const valueAP=(value+(has(4633)?bonusHP*.02:0)+(alias==='Vladimir'?bonusHP/30:0)+seraph*Math.max(0,mana-baseMana))*deathcap;
  // Ryze couples AP and maximum mana. Solve the finite linear relationship; never iterate stat bonuses.
  const denominator=alias==='Ryze'?1-seraph*.001*mana*deathcap:1;
  return valueAP/Math.max(.01,denominator);
 };
 const preferredAD=itemAD(bonusAD),preferredAP=itemAP(ap);
 const adaptiveAD=preferredAD>preferredAP*.6||(preferredAD===preferredAP*.6&&['Aphelios','Briar','DrMundo','Jhin','Nilah','Olaf','Pyke','Sivir','Taric','Tryndamere','KSante','Ornn','Rammus','Udyr','Ambessa','Zaahen','Hecarim','Rengar','Senna','Skarner','Darius','Sett','Blitzcrank','Ezreal','Lucian','Corki','Caitlyn','Ashe','MissFortune','Draven','Graves','Quinn','JarvanIV','Nocturne','Talon','Pantheon','Garen','LeeSin','Zed','Shen','Renekton','Riven','Aatrox','RekSai','Akali','Sion','Poppy','Leona','Braum','Volibear','Warwick','XinZhao','Vi','Khazix','Nasus','Thresh','Shaco','Jax','Jinx','Tristana','Vayne','Camille','Fiora','Gangplank','Illaoi','Irelia','Kaisa','Kalista','Kled','Naafiri','Qiyana','Samira','Trundle','Varus','Xayah','Yorick','Yasuo','Yone','Kayle','KogMaw','Kindred','Akshan','Belveth','Gnar','Jayce','Kayn','MasterYi','Shyvana','Smolder','Twitch','Urgot','Viego','MonkeyKing','Yunara','Zeri'].includes(champion.alias));
 const adaptive=(value:number)=>{if(adaptiveAD)bonusAD+=value*.6;else ap+=value;};
 for(const id of s.shards)if(id===5008)adaptive(9);
 adaptive(prepared.adaptiveForce);
 if(s.runePage.includes(8010))adaptive((1.8+(4-1.8)*(level-1)/17)*Math.min(12,Math.max(0,s.conquerorStacks)));
 if(s.runePage.includes(8236)){const periods=Math.floor(Math.max(0,s.gatheringMinutes??0)/10);adaptive(4*periods*(periods+1));}
 // Project once for preference above, then apply once to final rune-inclusive stats.
 ap=itemAP(ap);
 if(alias==='Vladimir')bonusHP+=1.6*(ap-(bonusHP/30)*(has(3089)?1.3:1));
 if(alias==='Ryze'){const before=mana;mana*=1+.001*ap;if(has(3042))bonusAD+=(mana-before)*.02;}
 bonusAD=itemAD(bonusAD);
 const hp=baseHP+bonusHP;
 const learned=learnedPenetration(s),terminus=has(3302)?.1*Math.floor(Math.min(3,Math.max(0,s.effects?.terminusDarkStacks??0))):0,combinePen=(item:number,passive:number)=>passive?1-(1-item)*(1-passive):item,magicPen=combinePen(combinePen(stat('Magic Penetration','percent')/100,terminus),learned?.kind==='magic'?learned.value:0),armorPen=combinePen(combinePen(combinePen(stat('Armor Penetration','percent')/100,terminus),learned?.kind==='physical'?learned.value:0),alias==='Nilah'&&traitRank(s)>0?.3*critChance:0);
 const bonusMana=resource.kind==='mana'?Math.max(0,mana-((champion.stats.mp||0)+(champion.stats.mpperlevel||0)*growth(level))):0;
 const stats={critChance,critDamage,bonusAS,bonusMana,armor,bonusArmor,mr,bonusMR,hp,bonusHP,baseAD,bonusAD,ad:baseAD+bonusAD,ap,haste,mana,flatPen:stat('Magic Penetration','flat'),percentPen:magicPen};
 const limitations=items.map(i=>scopeNotes[i.id]||(!modeledItemIds.includes(i.id)?`${i.name}: passive/active effects are omitted; base stats only.`:'')).filter(Boolean);
 const newScope:Record<number,string>={3040:'Seraph Awe adds 2% bonus maximum mana as AP before Deathcap; Lifeline shielding is outside the damage objective.',3042:'Muramana Awe and source Shock are included; actual cast-group/reset interactions remain approximate.',3031:['Sivir','Nilah'].includes(alias)?'Infinity Edge crit chance and damage are included in continuous spell scaling; attack crits and item procs are excluded.':alias==='Jhin'?'Infinity Edge crit chance contributes to Whisper AD; attack crits are excluded.':'Infinity Edge crit chance/damage interactions are omitted for this objective; AD stats are included.',3078:'Trinity Spellblade uses current-source 200% base AD on one explicitly armed on-hit delivery.',3508:'Essence Reaver Spellblade uses the official 26.1 rule only when explicitly ready; mana refund and current proc behavior require gameplay checks.',6694:'Serylda armor penetration is included; slow is excluded.',6676:'Collector execute threshold is excluded; AD, lethality and crit stats are kept separate.',3085:'Runaan secondary bolts are excluded.',3115:'Nashor adds 15 + 15% AP only on modeled on-hit deliveries with item procs enabled.',3100:'Lich Bane adds 75% base AD + 45% AP only on one explicitly armed on-hit delivery.'};
 limitations.push(...items.map(i=>newScope[i.id]).filter(Boolean));
 limitations.push(...prepared.notes,...defense.notes);
 limitations.push('Explicit preparation is a snapshot, not automatic earned stacks, attack timing, buff expiry or a complete fight simulation. HP thresholds are evaluated at each modeled native packet; damage-over-time uses finite normalized slices. Proc travel and mixed-buff ordering remain documented approximations.');
 if(champion.alias==='Blitzcrank')limitations.push('Power Fist crit scaling is unverified: this is a noncritical estimate regardless of crit mode. Only source-classified deliveries receive the shared on-hits. Static Field lightning, Sundered Sky and repeated attacks remain outside this objective.');
 if(champion.alias==='TahmKench')limitations.push('Single champion hit; passive added to Q only. Q healing, W cost refund, R ally shield, stack setup and crowd control are excluded. Enemy Devour assumes three existing stacks; setup damage is excluded. Passive base caps at 60 per official 26.8 notes, despite ambiguous exported breakpoint extrapolation.');
 if(champion.alias==='Sett')limitations.push('W uses DamageConversion (.0025 × bonus AD), not the contradictory MaxDamage helper. Grit input is at cast time, before decay. Damage-amplifier interactions with true damage are excluded.');
 if(champion.alias==='Cassiopeia')limitations.push('Q poison damage is prorated uniformly over 3 seconds; tick rounding, travel time and cast windup are not simulated.');
 if(champion.alias==='Ornn')limitations.push(`Living Forge amplifies bonus HP, armor and MR by ${Math.round((ornnAmp-1)*100)}% from the supplied earned Masterwork count (0–5). Actual Masterwork item stat allocations and external buffs are not generated automatically.`);
 if(champion.alias==='Rammus')limitations.push('Spiked Shell adds 15% of own total armor plus MR as bonus AD. W defense increases apply only to the selected W retaliation objective; Q/R assume W inactive.');
 if(abilityModel(champion.alias,s.mode)?.defenseScaling)limitations.push('Own base resistance growth and item flat defenses are included. Explicit extra armor/MR are entered before champion amplification. Unmodeled item passives and external buffs must be entered explicitly.');
 if(learned)limitations.push(`${learned.slot} passive rank ${learned.rank}: ${Math.round(learned.value*1000)/10}% learned ${learned.kind==='magic'?'magic':'armor'} penetration; combines multiplicatively with item percent penetration. Rank zero means unlearned; this does not validate a complete skill-point allocation.`);
 const conversionNotes:Record<string,string>={Aphelios:'Only entered AD/lethality skill ranks are modeled; AS rank-ups and full point-allocation legality are excluded.',Jhin:'Whisper includes level-based AD amplification, crit chance and item/shard/entered bonus attack speed. Explicit prepared AS inputs are included; buff expiry, attack timing, fourth shots and attack critical-strike reduction are excluded.',Pyke:'Bonus HP converts to AD at 14:1 before item conversions; no converted HP remains for Bloodmail or Riftmaker.',Ryze:'Arcane Mastery adds 10% maximum mana per 100 AP; bonus mana is final maximum minus base champion mana. Seraph adds 2% bonus mana before Deathcap. The AP/mana coupling is solved algebraically; client stat-order verification remains required.',Vladimir:'Crimson Pact bonuses do not feed each other. Riftmaker converts external bonus HP only: its cross-conversion with Crimson Pact-generated HP is unverified and excluded. This combination needs an in-game check.',Taric:'Bastion self armor uses supplied learned W rank (zero means unlearned), before Dazzle bonus-armor scaling.',Tryndamere:'Bloodlust missing-health AD uses supplied learned Q rank (zero means unlearned); full health gives no bonus in this source snapshot.',Nilah:'Learned Q grants 30% of crit chance as armor penetration, combined multiplicatively with item penetration. Continuous Q crit scaling uses crit chance and crit damage; no attack crit is rolled.',Rell:'Break the Mold resistance-steal ordering is not verified. These are spell-only packets against supplied impact MR; new steals and passive on-hit are excluded.'};
 if(conversionNotes[alias])limitations.push(conversionNotes[alias]);
 const events:(Result['events'][number]&{span?:number})[]=[];let manaSpent=0,castResourceSpent=0,healthSpent=0,grit=0;
 const resourceMaximum=resource.kind==='energy'?resource.baseMaximum:mana;
 const amplifier=(_time:number)=>1; // Shared damage effects are applied once, chronologically, below.
 const add=(time:number,name:string,type:Result['events'][number]['type'],raw:number,applyAmp=true,ampTime=time,span=0)=>{if(applyAmp&&type!=='true')raw*=amplifier(ampTime);const damage=type==='true'?raw:mitigate(raw,type==='magic'?s.mr:s.armor,type==='magic'?stats.percentPen:armorPen,type==='magic'?stats.flatPen:stat('Lethality')+stat('Armor Penetration','flat')+(alias==='Aphelios'?4.5*Math.floor(Math.min(6,Math.max(0,s.apheliosLethalityRanks??0))):0));events.push({time,name,type,raw,damage,...(span>0?{span}:{})});};
 const cast=abilityModel(champion.alias,s.mode);
 if(cast){
  const castRank=Math.min(cast.rankCap,Math.max(1,Math.round(s.rank))),cost=cast.cost[castRank-1];
  limitations.push(cast.notes,`Source: patch 26.20 / Data Dragon 16.20.1; ${cast.sourcePath}. Single cast on one champion. No automatic repeats or additional passive/item/rune triggers beyond the selected packets.`);
  const availableHealth=hp*Math.max(0,Math.min(100,s.healthPercent))/100;
  if(cast.healthCost&&availableHealth<1)limitations.push('Not enough living health to cast this health-cost ability.');
  else if(cast.requiresStacks&&(s.abilityStacks??0)<1)limitations.push('Requires at least one existing stack before this ability can be cast. No damage or resource cost is applied.');
  else if(resource.kind==='none'||Math.min(s.mana,resourceMaximum)>=cost){
   castResourceSpent=cost;if(resource.kind==='mana')manaSpent=cost;
   if(cast.healthCost){const nominal=cast.healthCost(castRank,stats,s);healthSpent=Math.max(0,Math.min(nominal,availableHealth-1));limitations.push(`Upfront health cost: ${healthSpent.toFixed(1)} paid, leaving at least 1 HP. On-hit/kill refunds, healing, and later health changes are excluded.`);}
   for(const packet of cast.packets(castRank,stats,s)){
    const start=packet.time??0;
    if(packet.duration&&packet.duration>0){
     const end=Math.min(s.duration,start+packet.duration);let time=start;
     // Uniform damage over time, split where the combat-time amplifier changes.
     while(time<end-1e-9){const next=Math.min(end,Math.floor(s.combatSeconds+time+1e-9)+1-s.combatSeconds);add(time,packet.name,packet.type,packet.raw*(next-time)/packet.duration,true,time+1e-8,next-time);time=next;}
    }else if(start<=s.duration)add(start,packet.name,packet.type,packet.raw);
   }
  }
  else limitations.push(`Not enough ${resource.kind} for the selected ability upfront cost.`);
  if(resource.kind==='energy')limitations.push(`Base energy cap ${resource.baseMaximum}; mana purchases do not raise energy or provide mana-to-AD conversion. Energy regeneration, refunds and temporary maximum-energy bonuses are excluded.`);
 }else if(champion.alias==='Sett'){
  grit=Math.min(hp*.5,Math.max(0,s.gritMode==='fraction'?hp*.5*s.grit/100:s.grit));
  add(0,'Haymaker '+(s.center?'center':'edge'),s.center?'true':'physical',[80,100,120,140,160][rank-1]+(.25+.0025*bonusAD)*grit);
 }else if(champion.alias==='Blitzcrank'||champion.alias==='TahmKench'){
  const cost=champion.alias==='Blitzcrank'?25:s.mode==='tahm-q'?[50,46,42,38,34][rank-1]:s.mode==='tahm-w'?[60,75,90,105,120][rank-1]:100;
  if(Math.min(s.mana,mana)>=cost){
   manaSpent=cost;
   if(champion.alias==='Blitzcrank'){
    add(0,'Power Fist (noncritical)','physical',2*stats.ad+.25*ap);
   }else if(s.mode==='tahm-q'){
    add(0,'Tongue Lash','magic',[75,120,165,210,255][rank-1]+ap);
    add(0,'An Acquired Taste (Q champion hit)','magic',5*Math.min(12,level)+.04*bonusHP+.000125*bonusHP*ap);
   }else if(s.mode==='tahm-w')add(0,'Abyssal Dive (landing)','magic',[100,135,170,205,240][rank-1]+1.5*ap);
   else add(0,'Enemy Devour (release)','magic',[100,250,400][Math.min(3,rank)-1]+(.15+.0007*ap)*Math.max(0,s.targetHP));
  }else limitations.push('Not enough mana for the selected ability upfront cost.');
 }else{
  const qCost=[50,55,60,65,70][rank-1],qRaw=[65,100,135,170,205][rank-1]+.75*ap,eBase=50+4.117599964*(level-1)+.2*ap,eBonus=[20,45,70,95,120][eRank-1]+.45*ap;
  const available=Math.min(s.mana,mana),horizon=Math.max(0,s.duration),basicHaste=haste+prepared.basicHaste+(has(3161)?25:0),qCD=3.5/(1+basicHaste/100),eCD=.75/(1+basicHaste/100);
  const spend=(n:number)=>{if(manaSpent+n>available+1e-7)return false;manaSpent+=n;return true;};
  const poisonRaw=(start:number,duration:number)=>{let weighted=0,time=start,end=start+duration;while(time<end-1e-9){const next=Math.min(end,Math.floor(s.combatSeconds+time+1e-9)+1-s.combatSeconds);weighted+=(next-time)*amplifier(time+1e-8);time=next;}return qRaw*weighted/3;};
  if(s.mode==='q'||s.mode==='qe'){if(spend(qCost)){add(0,'Noxious Blast (observed poison)','magic',poisonRaw(0,Math.min(3,horizon)),false,0,Math.min(3,horizon));if(s.mode==='qe'&&horizon>=.25&&spend(45))add(.25,'Twin Fang (poisoned)','magic',eBase+eBonus);}}
  else if(s.mode==='e'){if(spend(45))add(0,'Twin Fang '+(s.poisoned?'(poisoned)':'(unpoisoned)'),'magic',eBase+(s.poisoned?eBonus:0));}
  else if(s.mode==='sequence'){
   let nextQ=0,nextE=.25,poisonUntil=-1,iterations=0,lastQIndex=-1;
   while(Math.min(nextQ,nextE)<horizon&&iterations++<1000){if(nextQ<=nextE){const t=nextQ;if(!spend(qCost)){nextQ=Infinity;continue;}if(lastQIndex>=0){const previous=events[lastQIndex],actualDuration=Math.min(3,horizon-previous.time,t-previous.time);previous.span=actualDuration;previous.raw=poisonRaw(previous.time,actualDuration);previous.damage=mitigate(previous.raw,s.mr,stats.percentPen,stats.flatPen);}add(t,'Noxious Blast (observed poison)','magic',poisonRaw(t,Math.min(3,horizon-t)),false,t,Math.min(3,horizon-t));lastQIndex=events.length-1;poisonUntil=t+3;nextQ+=qCD;}else{const t=nextE;if(!spend(45))break;const poisoned=t<poisonUntil;add(t,'Twin Fang '+(poisoned?'(poisoned)':'(unpoisoned)'),'magic',eBase+(poisoned?eBonus:0));nextE+=eCD;}}
  }
  if(manaSpent===0)limitations.push('Not enough mana to begin the selected sequence.');
 }
 const damageEffects=createDamageEffects(champion,items,s),procs=createProcEffects(champion,items,s,stats);
 limitations.push(...damageEffects.notes,...procs.notes);
 const startHP=s.targetHP*Math.max(0,Math.min(100,s.targetHealthPercent??100))/100;
 let remainingHP=startHP,nativeDamage=0,procDamage=0;
 const resolved:Result['events']=[],groups=new Map<number,Result['events'][number]>();
 type Queued={time:number;name:string;type:'physical'|'magic'|'true';raw:number;origin:'native'|'rune'|'item';amplification?:'none'|'general';index:number;group?:number;periodic?:boolean};
 const pending:Queued[]=[];
 for(let index=0;index<events.length;index++){
  const event=events[index];
  if(event.span&&event.span>0){
   const end=event.time+event.span;
   for(let time=event.time;time<end-1e-9;){const next=Math.min(end,time+.25,Math.floor(s.combatSeconds+time+1e-8)+1-s.combatSeconds);pending.push({...event,time,raw:event.raw*(next-time)/event.span,origin:'native',index,group:index,periodic:true});time=next;}
  }else pending.push({...event,origin:'native',index,group:index});
 }
 const physicalFlat=stat('Lethality')+stat('Armor Penetration','flat')+(alias==='Aphelios'?4.5*Math.floor(Math.min(6,Math.max(0,s.apheliosLethalityRanks??0))):0);
 const ownerHP=Math.max(0,s.healthPercent-(healthSpent/hp)*100);
 let order=pending.length;
 while(pending.length){
  pending.sort((a,b)=>a.time-b.time||a.index-b.index);const event=pending.shift()!;
  if(event.time>s.duration||event.raw<=0||(s.effects?.stopAtDeath&&remainingHP<=0))continue;
  const tags=effectTags(alias,s.mode,event.name),before=100*remainingHP/s.targetHP;
  const periodic=event.periodic===true;
  const native=event.origin==='native';
  const raw=event.raw*(event.amplification==='none'?1:damageEffects.multiplier({...tags,kind:native?tags.kind:'proc',ultimate:native?tags.ultimate:false,type:event.type,time:event.time,periodic},before,ownerHP));
  const damage=event.type==='true'?raw:mitigate(raw,event.type==='magic'?s.mr:damageEffects.targetArmor(s.armor),event.type==='magic'?stats.percentPen:armorPen,event.type==='magic'?stats.flatPen:physicalFlat);
  const previous=event.group===undefined?undefined:groups.get(event.group);
  if(previous){previous.raw+=raw;previous.damage+=damage;}
  else {const result={time:event.time,name:event.name,type:event.type,raw,damage,origin:event.origin};resolved.push(result);if(event.group!==undefined)groups.set(event.group,result);}
  remainingHP=Math.max(0,remainingHP-damage);
  if(native){
   nativeDamage+=damage;
   for(const proc of procs.onHit({...tags,castId:alias==='Cassiopeia'?`${event.name}@${events[event.group??0]?.time??event.time}`:tags.kind==='attack'?`attack-${event.group}`:'selected-cast',spellEffects:tags.spellEffects,appliesOnHit:tags.appliesOnHit,periodic,time:event.time,type:event.type,raw,damage,targetHealthPercent:before}))pending.push({...proc,index:order++});
  }else procDamage+=damage;
 }
 if(procDamage>0)limitations.push('Proc damage is reported separately from the native ability. Recursive proc triggers are excluded; general damage modifiers apply once to eligible proc packets, while First Strike is not amplified a second time; this is not a complete fight simulator.');
 if(!s.effects?.stopAtDeath)limitations.push('Damage is uncapped potential over the selected action window; later native packets may exceed remaining target HP. Enable stop-at-death for a finite target trial.');
 const includedRuneIds=new Set([8010,8236,9103,9104,9105,8226,8345,8451,8437,8233,8316,8210,8232,8008,9923,8429,8242,8439,8017,8014,8299,8005,8224,8229,8214,8237,8128,8369,8992]);
 for(const id of s.runePage)if(!includedRuneIds.has(id))limitations.push(`Rune ${id}: movement, economy, healing, shielding or other conditional effects are not simulated by this damage objective.`);
 const implemented=[...new Set([...prepared.implemented,...defense.implemented,...damageEffects.implemented,...procs.implemented])];
 return {healthSpent,resource:{kind:resource.kind,maximum:resourceMaximum,spent:resource.kind==='mana'?manaSpent:castResourceSpent},damage:nativeDamage+procDamage,nativeDamage,procDamage,effectiveDamage:Math.min(startHP,nativeDamage+procDamage),events:resolved,stats,manaSpent,grit,cost:items.reduce((n,i)=>n+i.gold.total,0),effectCoverage:{implemented,omitted:[...new Set(limitations.filter(note=>/omitted|excluded|unmodeled|outside|unverified|not simulated|unresolved|approximate|unknown/i.test(note)))]},limitations:[...new Set(limitations)]};
}
