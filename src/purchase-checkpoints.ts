import type {Catalog} from './types';
import type {FullMetaBuild} from './meta-recommendations';
import {purchaseTiming} from './purchase-timing';
export interface PurchaseCheckpoint {title:string;itemIds:number[];choiceIds?:number[];note:string}
const transforms:Record<number,number>={3040:3003,3042:3004,3121:3119,2530:2526};
export function purchaseCheckpoints(data:Catalog,build:FullMetaBuild):PurchaseCheckpoint[]{
 const item=(id:number)=>data.items.find(i=>i.id===id)!;const isBoot=(id:number)=>item(id).tags.includes('Boots');
 const sum=(stat:string)=>build.itemIds.reduce((n,id)=>n+item(id).baseStats.filter(s=>s.name===stat).reduce((n,s)=>n+s.value,0),0);
 const starter=sum('Attack Damage')>sum('Ability Power')*.6?1055:sum('Ability Power')>=100?1056:1054;
 const steps:PurchaseCheckpoint[]=[build.role==='support'?{title:'Starting purchase',itemIds:[3865,2003,2003],note:'World Atlas plus two potions uses 500g. Complete the support quest in game; its final upgrade is not a starting purchase.'}:build.role==='jungle'?{title:'Starting purchase',itemIds:[2003],choiceIds:[1101,1102,1103],note:'Choose one jungle companion, plus a potion (500g). The pet choice depends on clear, mobility and durability needs; this is not a source-verified starting-item recommendation.'}:{title:'Starting purchase',itemIds:[starter,...(starter===1056?[2003,2003]:[2003])],choiceIds:starter!==1054?[1054]:undefined,note:'Inferred lane start from this item branch, within 500g. Shield is an alternative for difficult poke lanes; review the lane and champion resource before choosing. These are alternatives, not extra simultaneous purchases.'}];
 const timing=purchaseTiming(data,build.itemIds,false,build.champion);
 const first=timing.stackingIds[0]||build.observedCoreItemIds.find(id=>!isBoot(id)&&![3869,3870,3871,3876,3877].includes(id))||build.itemIds.find(id=>!isBoot(id))!;
 const target=transforms[first]||first;
 const components=data.items.filter(i=>i.maps['11']&&i.shopListedBySource&&i.buildsInto.includes(target)&&i.gold.total>=250&&i.gold.total<=1300).sort((a,b)=>b.gold.total-a.gold.total).slice(0,3).map(i=>i.id);
 if(timing.tearEarly&&!components.includes(3070))components.unshift(3070);
 steps.push({title:'First recall options',itemIds:[],choiceIds:components,note:components.length?'Choose a component toward the first core that fits your available gold. This is a menu of recall options; it does not mean buying every component listed.':'Recall with a useful component toward the first core, sustain or movement. The source does not provide a validated recall script.'});
 steps.push({title:'First core target',itemIds:[target],note:timing.stackingIds.length?`Inferred timing priority ahead of later completions. ${timing.notes.join(' ')}`:transforms[first]?'Buy the prerequisite item and earn its transformation through the required stacks. The finished upgrade in the six-item plan is conditional.':'Finish this source-core target when the lane and objective timing permit; core ordering is source-informed rather than an exact recall schedule.'});
 steps.push({title:'Boots window',itemIds:build.itemIds.filter(isBoot),note:'Buy basic or completed boots earlier when movement, lane access or defensive needs justify it. Their inventory position is not a requirement to buy them fourth.'});
 const answers=build.reasons.filter(r=>r.kind==='composition-swap').map(r=>r.itemId);
 if(answers.length)steps.push({title:'Matchup purchase window',itemIds:answers,note:'Buy a relevant counter-component when the problem becomes meaningful; do not automatically wait until the last slot. Compare that delay against reaching your next core spike.'});
 steps.push({title:'After the core',itemIds:timing.coreIds.filter(id=>id!==first&&!answers.includes(id)),note:`Complete the remaining plan as the match develops. ${timing.notes.join(' ')} Recheck enemy purchases and threats at each major buy. Extra role-quest inventory and level rewards remain outside this six-slot model.`});
 return steps;
}
