import {calculate,legalBuild} from './engine';
import type {Catalog,Champion,Scenario} from './types';
import {purchaseTiming} from './purchase-timing';
import {targetCombatEffects} from './combat-effects';
const earned:Record<number,number>={3040:3003,3042:3004,3121:3119,2530:2526};
export function planPurchases(data:Catalog,champion:Champion,scenario:Scenario,ids:number[],options:{prioritizeStacks?:boolean;earlyKills?:boolean}={}){
 const items=ids.map(id=>data.items.find(i=>i.id===(earned[id]||id))!);
 if(!items.length||items.some(i=>!i)||!legalBuild(items,100000,6,champion.alias))throw Error('Equip one to six legal items to plan their order.');
 const s={...scenario,effects:targetCombatEffects(scenario.effects),rodStacks:0,heartsteelHP:0,gatheringMinutes:0,conquerorStacks:0,spellbladeReady:false,firstStrikeReady:false};
 const timing=purchaseTiming(data,items.map(i=>i.id),options.earlyKills);
 const priority=options.prioritizeStacks?[...timing.stackingIds]:[];
 if(options.earlyKills&&items.some(i=>i.id===6676)){
  if(!priority.length&&timing.coreIds[0]!==6676&&timing.coreIds[0]!==undefined)priority.push(timing.coreIds[0]);
  priority.push(6676);
 }
 const indices=priority.map(id=>items.findIndex(i=>i.id===id));
 const count=1<<items.length,damage=Array.from({length:count},(_,mask)=>calculate(champion,items.filter((_,n)=>mask&(1<<n)),s).damage);
 const scores=Array(count).fill(-Infinity),orders:number[][]=Array.from({length:count},()=>[]);scores[0]=0;
 // Integrate completed-item damage over gold spent: a subset's damage lasts until the next completion.
 for(let mask=0;mask<count;mask++)for(let n=0;n<items.length;n++)if(!(mask&(1<<n))){const required=indices.find(i=>!(mask&(1<<i)));if(required!==undefined&&n!==required)continue;const next=mask|(1<<n),score=scores[mask]+damage[mask]*items[n].gold.total;if(score>scores[next]){scores[next]=score;orders[next]=[...orders[mask],n]}}
 const order=orders[count-1];let spent=0,mask=0;
 const steps=order.map(n=>{spent+=items[n].gold.total;mask|=1<<n;return {id:items[n].id,spent,damage:damage[mask]}});
 let currentScore=0,currentMask=0;items.forEach((item,n)=>{currentScore+=damage[currentMask]*item.gold.total;currentMask|=1<<n});
 return {ids:order.map(n=>items[n].id),steps,averageDamage:scores[count-1]/Math.max(1,spent),currentAverageDamage:currentScore/Math.max(1,spent),normalized:ids.some(id=>!!earned[id]),timingNotes:timing.notes,constrained:indices.length>0};
}
