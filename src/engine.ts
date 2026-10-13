import {itemFamilies as families} from './item-families.mjs';
import type { Champion, Item, Result, Scenario } from './types';
export const growth=(level:number)=>.7025*(level-1)+.0175*(level-1)**2;
export function mitigate(damage:number,resistance:number,percentPen=0,flatPen=0){const effective=resistance<0?resistance:Math.max(0,resistance*(1-percentPen)-flatPen);return damage*(effective>=0?100/(100+effective):2-100/(100-effective));}
export function defaultScenario(champion='Cassiopeia'):Scenario{return {champion,level:18,rank:5,eRank:5,mode:champion==='Sett'?'w':'qe',mr:50,armor:100,targetHP:2500,duration:3,poisoned:false,mana:2000,gritMode:'fraction',grit:100,center:true,extraAP:0,extraAD:0,extraHP:0,healthPercent:100,bloodmailBonus:0,rodStacks:0,heartsteelHP:0,conquerorStacks:0,combatSeconds:0,shards:[5008,5008,5001],runePage:[8230,8226,8210,8236,8009,8014],budget:18000,slots:6};}

export function legalBuild(items:Item[],budget:number,slots:number,champion:string){return items.length<=slots&&new Set(items.map(i=>i.id)).size===items.length&&items.reduce((n,i)=>n+i.gold.total,0)<=budget&&items.every(i=>i.maps['11']&&(i.shopListedBySource||[3040,3042].includes(i.id))&&(!i.requiredChampion||i.requiredChampion.toLowerCase()===champion.toLowerCase()))&&families.every(f=>items.filter(i=>f.includes(i.id)).length<=1)&&items.filter(i=>i.tags.includes('Boots')).length<=1;}
export const modeledItemIds=[3089,3135,3137,3116,4629,4633,6657,3083,2501,3748,3161,3053,3065,3071,3157,3102,3084];
const scopeNotes:Record<number,string>={3137:'Cryptbloom healing is outside this damage objective.',3116:'Rylai slow is outside this damage objective.',4629:'Cosmic movement speed is outside this damage objective.',3083:'Warmog out-of-combat healing is excluded.',2501:'Bloodmail Retribution uses your explicitly entered AD bonus; its missing-health curve is unresolved.',3748:'Titanic attacks and active are excluded: no attacks in these scenarios.',3161:'Shojin basic haste is included; Focused Will damage amplification is omitted.',3053:'Sterak AD passive is omitted: this is a stats-only estimate.',3065:'Visage healing and shielding are excluded.',3071:'Black Cleaver armor shred is omitted.',3157:'Zhonya stasis is outside this damage objective.',3102:'Banshee spell shield is outside this damage objective.',3084:'Heartsteel uses your finite earned-health input; its attack proc is excluded.'};
export function calculate(champion:Champion,items:Item[],s:Scenario):Result{
 if(!['Sett','Cassiopeia'].includes(champion.alias))throw new Error('No numerical adapter for this champion.');
 const level=Math.min(18,Math.max(1,s.level)),rank=Math.min(5,Math.max(1,s.rank)),eRank=Math.min(5,Math.max(1,s.eRank));
 const has=(id:number)=>items.some(i=>i.id===id),stat=(name:string,unit?:string)=>items.flatMap(i=>i.baseStats).filter(v=>v.name===name&&(!unit||v.unit===unit)).reduce((n,v)=>n+v.value,0);
 let ap=stat('Ability Power')+s.extraAP,bonusAD=stat('Attack Damage')+s.extraAD,haste=stat('Ability Haste'),bonusHP=stat('Health')+s.extraHP;
 const itemHP=stat('Health');if(has(3083))bonusHP+=itemHP*.12;
 if(has(3084))bonusHP+=s.heartsteelHP;
 let mana=(champion.stats.mp||0)+(champion.stats.mpperlevel||0)*growth(level)+stat('Mana');
 if(has(6657)){const stacks=Math.min(10,Math.max(0,s.rodStacks));ap+=stacks*3;bonusHP+=stacks*10;mana+=stacks*30;}
 for(const id of s.shards){if(id===5008){if(champion.alias==='Sett')bonusAD+=5.4;else ap+=9;}if(id===5001)bonusHP+=10+10*(level-1);if(id===5011)bonusHP+=65;if(id===5007)haste+=8;}
 if(s.runePage.includes(8010)){const adaptive=(1.8+(4-1.8)*(level-1)/17)*Math.min(12,Math.max(0,s.conquerorStacks));if(champion.alias==='Sett')bonusAD+=adaptive*.6;else ap+=adaptive;}
 const baseAD=(champion.stats.attackdamage||0)+(champion.stats.attackdamageperlevel||0)*growth(level);
 if(has(2501)){bonusAD+=bonusHP*.025;bonusAD=(baseAD+bonusAD)*(1+Math.min(.12,Math.max(0,s.bloodmailBonus/100)))-baseAD;}
 if(has(4633))ap+=bonusHP*.02;if(has(3089))ap*=1.3;
 const hp=(champion.stats.hp||0)+(champion.stats.hpperlevel||0)*growth(level)+bonusHP;
 const stats={hp,bonusHP,baseAD,bonusAD,ad:baseAD+bonusAD,ap,haste,mana,flatPen:stat('Magic Penetration','flat'),percentPen:stat('Magic Penetration','percent')/100};
 const limitations=items.map(i=>scopeNotes[i.id]||(!modeledItemIds.includes(i.id)?`${i.name}: passive/active effects are omitted; base stats only.`:'')).filter(Boolean);
 limitations.push('Rune effects other than shards and explicitly pre-stacked Conqueror stats are omitted. Rune-page comparisons are not fully simulated.');
 if(champion.alias==='Sett')limitations.push('W uses DamageConversion (.0025 × bonus AD), not the contradictory MaxDamage helper. Grit input is at cast time, before decay. Damage-amplifier interactions with true damage are excluded.');
 if(champion.alias==='Cassiopeia')limitations.push('Q poison damage is prorated uniformly over 3 seconds; tick rounding, travel time and cast windup are not simulated.');
 const events:Result['events']=[];let manaSpent=0,grit=0;
 const amplifier=(time:number)=>has(4633)?1+Math.min(.08,Math.floor(s.combatSeconds+time)*.02):1;
 const add=(time:number,name:string,type:Result['events'][number]['type'],raw:number,applyAmp=true)=>{if(applyAmp&&type!=='true')raw*=amplifier(time);const damage=type==='true'?raw:mitigate(raw,type==='magic'?s.mr:s.armor,type==='magic'?stats.percentPen:0,type==='magic'?stats.flatPen:0);events.push({time,name,type,raw,damage});};
 if(champion.alias==='Sett'){
  grit=Math.min(hp*.5,Math.max(0,s.gritMode==='fraction'?hp*.5*s.grit/100:s.grit));
  add(0,'Haymaker '+(s.center?'center':'edge'),s.center?'true':'physical',[80,100,120,140,160][rank-1]+(.25+.0025*bonusAD)*grit);
 }else{
  const qCost=[50,55,60,65,70][rank-1],qRaw=[65,100,135,170,205][rank-1]+.75*ap,eBase=50+4.117599964*(level-1)+.2*ap,eBonus=[20,45,70,95,120][eRank-1]+.45*ap;
  const available=Math.min(s.mana,mana),horizon=Math.max(0,s.duration),basicHaste=haste+(has(3161)?25:0),qCD=3.5/(1+basicHaste/100),eCD=.75/(1+basicHaste/100);
  const spend=(n:number)=>{if(manaSpent+n>available+1e-7)return false;manaSpent+=n;return true;};
  const poisonRaw=(start:number,duration:number)=>{let weighted=0,time=start,end=start+duration;while(time<end-1e-9){const next=Math.min(end,Math.floor(s.combatSeconds+time+1e-9)+1-s.combatSeconds);weighted+=(next-time)*amplifier(time+1e-8);time=next;}return qRaw*weighted/3;};
  if(s.mode==='q'||s.mode==='qe'){if(spend(qCost)){add(0,'Noxious Blast (observed poison)','magic',poisonRaw(0,Math.min(3,horizon)),false);if(s.mode==='qe'&&horizon>=.25&&spend(45))add(.25,'Twin Fang (poisoned)','magic',eBase+eBonus);}}
  else if(s.mode==='e'){if(spend(45))add(0,'Twin Fang '+(s.poisoned?'(poisoned)':'(unpoisoned)'),'magic',eBase+(s.poisoned?eBonus:0));}
  else if(s.mode==='sequence'){
   let nextQ=0,nextE=.25,poisonUntil=-1,iterations=0,lastQIndex=-1;
   while(Math.min(nextQ,nextE)<horizon&&iterations++<1000){if(nextQ<=nextE){const t=nextQ;if(!spend(qCost)){nextQ=Infinity;continue;}if(lastQIndex>=0){const previous=events[lastQIndex],actualDuration=Math.min(3,horizon-previous.time,t-previous.time);previous.raw=poisonRaw(previous.time,actualDuration);previous.damage=mitigate(previous.raw,s.mr,stats.percentPen,stats.flatPen);}add(t,'Noxious Blast (observed poison)','magic',poisonRaw(t,Math.min(3,horizon-t)),false);lastQIndex=events.length-1;poisonUntil=t+3;nextQ+=qCD;}else{const t=nextE;if(!spend(45))break;const poisoned=t<poisonUntil;add(t,'Twin Fang '+(poisoned?'(poisoned)':'(unpoisoned)'),'magic',eBase+(poisoned?eBonus:0));nextE+=eCD;}}
  }
  if(manaSpent===0)limitations.push('Not enough mana to begin the selected sequence.');
 }
 return {damage:events.reduce((n,e)=>n+e.damage,0),events,stats,manaSpent,grit,cost:items.reduce((n,i)=>n+i.gold.total,0),limitations:[...new Set(limitations)]};
}
