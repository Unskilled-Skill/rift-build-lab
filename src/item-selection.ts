import type {Item,Kit,Scenario} from './types';
import {legalBuild} from './engine';
import {itemFamilies} from './item-families.mjs';
const earned=(id:number)=>[3040,3042].includes(id);
const starterIds=new Set([1054,1055,1056,1082,1083,1086,1120,1101,1102,1103,1105,1106,1107,3865]);
const sourceEligible=(item:Item)=>Boolean(item.name&&item.maps['11']&&(item.shopListedBySource||earned(item.id))&&!/^(66|32)\d{4}$/.test(String(item.id)));
export function pickerItems(items:Item[],category:'completed'|'components'|'all',query:string):Item[]{
 const eligible=items.filter(sourceEligible),eligibleIds=new Set(eligible.map(i=>i.id));
 const completed=(i:Item)=>!starterIds.has(i.id)&&!i.tags.includes('Consumable')&&!i.tags.includes('Trinket')&&(earned(i.id)||(i.tags.includes('Boots')&&i.id!==1001)||!i.buildsInto.some(id=>eligibleIds.has(id)));
 const search=query.trim().toLowerCase();
 return eligible.filter(i=>(category==='all'||(category==='completed'?completed(i):!completed(i)))&&`${i.name} ${i.id} ${i.tags.join(' ')} ${i.baseStats.map(s=>s.name).join(' ')} ${i.effectDescriptionText}`.toLowerCase().includes(search)).sort((a,b)=>a.name.localeCompare(b.name)||a.id-b.id);
}
export function itemBlockReason(item:Item,selected:Item[],scenario:Scenario):string|null{
 if(!sourceEligible(item))return 'Unavailable in this source-filtered item list.';
 if(legalBuild([...selected,item],scenario.budget,scenario.slots,scenario.champion))return null;
 if(selected.some(i=>i.id===item.id))return 'Already equipped.';
 if(item.requiredChampion&&item.requiredChampion.toLowerCase()!==scenario.champion.toLowerCase())return `Requires ${item.requiredChampion}.`;
 if(selected.length>=scenario.slots)return 'All item slots are occupied. Remove an item or increase the slot limit.';
 const excess=selected.reduce((n,i)=>n+i.gold.total,0)+item.gold.total-scenario.budget;
 if(excess>0)return `${excess.toLocaleString()} gold over budget. Increase the budget or remove an item.`;
 const conflict=selected.find(i=>(i.tags.includes('Boots')&&item.tags.includes('Boots'))||itemFamilies.some(f=>f.includes(i.id)&&f.includes(item.id)));
 if(conflict)return `Conflicts with ${conflict.name}: only one item in this family.`;
 return 'The equipped setup has an existing source or item conflict. Remove the conflicting item first.';
}
export function abilityObjectives(kit?:Kit):{value:string;name:string;maxRank:number}[]{
 if(!kit)return [];
 return [{value:'P',name:kit.passive.name,maxRank:0},...kit.primaryAbilities.flatMap(a=>{
  const forms=a.name.split(/\s+\/\s+/);
  return [{value:a.slot,name:a.name,maxRank:a.maxRank},...(forms.length>1?forms.map((name,index)=>({value:`${a.slot}:${index}`,name,maxRank:a.maxRank})):[])];
 }),{value:'combo',name:'Combo / sequence',maxRank:0}];
}
