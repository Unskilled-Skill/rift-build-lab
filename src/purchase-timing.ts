import type {Catalog} from './types';

// Timing priorities are a match-play heuristic, not gold or stack generation.
const stacking=[6657,3084,6697];
const tearUpgrades=[3040,3042,3121,2530,3003,3004,3119,2526];
// Items that only pay off on top of other items: earliest practical slot among completed (non-boot) items.
const later:Record<number,{slot:number;reason:string}>={
 3089:{slot:1,reason:'multiplies ability power you already own, so it follows a first AP item'},
 3135:{slot:2,reason:'only pays off once enemies buy magic resist, so it is a third-item purchase'},
 3036:{slot:2,reason:'only pays off once enemies buy armor, so it is a third-item purchase'},
 3026:{slot:2,reason:'is a late safety item; buy it once you have damage worth protecting'},
 3157:{slot:1,reason:'is a defensive answer; buy it after the first damage item unless you need it to survive'},
 3102:{slot:1,reason:'is a defensive answer; buy it after the first damage item unless you need it to survive'},
};
// Keeps the written order except where an item cannot pay off yet; returns the moved items with reasons.
export function practicalOrder(data:Catalog,ids:number[],placed:number[]=[]){
 const ap=(id:number)=>data.items.find(i=>i.id===id)?.tags.includes('SpellDamage')&&id!==3089;
 const hasAP=ids.some(ap)||placed.some(ap);
 const ready=(id:number,slot:number,order:number[])=>{const rule=later[id];if(!rule)return true;if(slot<rule.slot)return false;return id!==3089||!hasAP||order.some(ap)};
 const left=[...ids],order:number[]=[...placed];
 while(left.length){const i=left.findIndex(id=>ready(id,order.length,order));order.push(...left.splice(i<0?0:i,1))}
 const result=order.slice(placed.length);
 const moved=result.filter((id,n)=>n>ids.indexOf(id)&&later[id]).map(id=>({id,reason:later[id].reason}));
 return {order:result,moved};
}
// Typical completed-item slot for this champion (or across all champions) from ranked Emerald+ purchase data.
export function observedSlot(data:Catalog,id:number,champion?:string):{slot:number;scope:'champion'|'all'}|undefined{
 const own=champion?data.itemTiming?.champions[champion]?.[id]:undefined;
 if(own&&own.matches>=1000)return {slot:own.slot,scope:'champion'};
 const all=data.itemTiming?.global[id];
 return all&&all.matches>=1000?{slot:all.slot,scope:'all'}:undefined;
}
// Sorts by when real players buy each item; items without data keep their written position.
export function observedOrder(data:Catalog,ids:number[],champion?:string,offset=0){
 const scored=ids.map((id,n)=>({id,n,slot:observedSlot(data,id,champion)?.slot??offset+n+1}));
 return scored.sort((a,b)=>a.slot-b.slot||a.n-b.n).map(e=>e.id);
}
export function purchaseTiming(data:Catalog,ids:number[],earlyKills=false,champion?:string){
 const core=ids.filter(id=>!data.items.find(i=>i.id===id)?.tags.includes('Boots'));
 const prefix=stacking.filter(id=>core.includes(id));
 const written=core.filter(id=>!prefix.includes(id));
 const practical=practicalOrder(data,observedOrder(data,written,champion,prefix.length),prefix),rest=practical.order;
 const observed=rest.filter(id=>observedSlot(data,id,champion));
 if(earlyKills&&rest.includes(6676)){
  const at=rest.indexOf(6676);rest.splice(at,1);rest.splice(at===0||prefix.length?0:Math.min(1,rest.length),0,6676);
 }
 const name=(id:number)=>data.items.find(i=>i.id===id)?.name||String(id);
 const notes:string[]=practical.moved.map(m=>`${name(m.id)} ${m.reason}.`);
 if(observed.length&&data.itemTiming)notes.unshift(`Typical buy slot in ranked Emerald+ games (OP.GG and Lolalytics, patch ${data.itemTiming.patch}): ${observed.map(id=>{const o=observedSlot(data,id,champion)!;return `${name(id)} ${o.slot.toFixed(1)}${o.scope==='all'?' (all champions)':''}`}).join(' · ')}.`);
 if(ids.includes(6657))notes.push('Rod of Ages needs ten minutes after purchase for ten stacks and its level reward. Prioritize its completion when it belongs in the build; buying it late delays those benefits.');
 if(ids.includes(3084))notes.push('Heartsteel benefits from earlier purchase only if you can repeatedly reach champions for valid procs. Extra minutes alone do not grant health; do not sacrifice a necessary lane item for unreachable stacks.');
 if(ids.includes(6697))notes.push('Hubris benefits from being owned for qualifying takedowns. Its AD buff is temporary and must be active when measured; early purchase does not guarantee kills or permanent active AD.');
 if(ids.includes(6676))notes.push('Collector grants 25 bonus gold per champion kill: four eligible kills add 100 gold. Earlier purchase can help an AD/crit snowball, but assists give no Taxes gold, kills are uncertain, and delaying a stronger core can reduce your chance of securing them.');
 if(ids.some(id=>tearUpgrades.includes(id)))notes.push('Buy Tear of the Goddess on an early suitable recall so you can start earning mana charges before finishing its upgrade. The transformed item is not an immediate purchase.');
 if(prefix.length>1)notes.push('Several stacking items compete for the same early gold. This suggested order favors Rod’s fixed clock, then Heartsteel contact opportunities, then Hubris takedowns; adjust for lane access and the first mandatory power spike.');
 return {coreIds:[...prefix,...rest],stackingIds:prefix,movedIds:practical.moved.map(m=>m.id),observed:observed.length>0,reordered:rest.some((id,n)=>written[n]!==id),tearEarly:ids.some(id=>tearUpgrades.includes(id)),notes};
}
