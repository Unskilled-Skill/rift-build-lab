import type {Catalog} from './types';
export function compareMetaItems(data:Catalog,original:number[],adapted:number[]){
 const item=(id:number)=>{const item=data.items.find(i=>i.id===id);if(!item)throw Error('Unknown comparison item.');return item};
 const cost=(ids:number[])=>ids.reduce((n,id)=>n+item(id).gold.total,0);
 const totals=(ids:number[])=>{const map=new Map<string,{name:string;unit:string;value:number}>();for(const id of ids)for(const s of item(id).baseStats){const key=`${s.name}|${s.unit}`;map.set(key,{name:s.name,unit:s.unit,value:(map.get(key)?.value||0)+s.value})}return map};
 const a=totals(original),b=totals(adapted),originalCost=cost(original),adaptedCost=cost(adapted);
 return {originalCost,adaptedCost,costDelta:adaptedCost-originalCost,removed:original.filter(id=>!adapted.includes(id)),added:adapted.filter(id=>!original.includes(id)),stats:[...new Set([...a.keys(),...b.keys()])].map(key=>({name:(a.get(key)||b.get(key))!.name,unit:(a.get(key)||b.get(key))!.unit,delta:(b.get(key)?.value||0)-(a.get(key)?.value||0)}))};
}
