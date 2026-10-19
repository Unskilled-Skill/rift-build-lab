import type {Catalog} from './types';

// Timing priorities are a match-play heuristic, not gold or stack generation.
const stacking=[6657,3084,6697];
const tearUpgrades=[3040,3042,3121,2530,3003,3004,3119,2526];
export function purchaseTiming(data:Catalog,ids:number[],earlyKills=false){
 const core=ids.filter(id=>!data.items.find(i=>i.id===id)?.tags.includes('Boots'));
 const prefix=stacking.filter(id=>core.includes(id));
 const rest=core.filter(id=>!prefix.includes(id));
 if(earlyKills&&rest.includes(6676)){
  const at=rest.indexOf(6676);rest.splice(at,1);rest.splice(at===0||prefix.length?0:Math.min(1,rest.length),0,6676);
 }
 const notes:string[]=[];
 if(ids.includes(6657))notes.push('Rod of Ages needs ten minutes after purchase for ten stacks and its level reward. Prioritize its completion when it belongs in the build; buying it late delays those benefits.');
 if(ids.includes(3084))notes.push('Heartsteel benefits from earlier purchase only if you can repeatedly reach champions for valid procs. Extra minutes alone do not grant health; do not sacrifice a necessary lane item for unreachable stacks.');
 if(ids.includes(6697))notes.push('Hubris benefits from being owned for qualifying takedowns. Its AD buff is temporary and must be active when measured; early purchase does not guarantee kills or permanent active AD.');
 if(ids.includes(6676))notes.push('Collector grants 25 bonus gold per champion kill: four eligible kills add 100 gold. Earlier purchase can help an AD/crit snowball, but assists give no Taxes gold, kills are uncertain, and delaying a stronger core can reduce your chance of securing them.');
 if(ids.some(id=>tearUpgrades.includes(id)))notes.push('Buy Tear of the Goddess on an early suitable recall so you can start earning mana charges before finishing its upgrade. The transformed item is not an immediate purchase.');
 if(prefix.length>1)notes.push('Several stacking items compete for the same early gold. This suggested order favors Rod’s fixed clock, then Heartsteel contact opportunities, then Hubris takedowns; adjust for lane access and the first mandatory power spike.');
 return {coreIds:[...prefix,...rest],stackingIds:prefix,tearEarly:ids.some(id=>tearUpgrades.includes(id)),notes};
}
