import {itemFamilies as families} from './item-families.mjs';
import type {Item} from './types';
export function legalBuild(items:Item[],budget:number,slots:number,champion:string){
 if(items.length>slots)return false;
 let cost=0,boots=0;
 for(let index=0;index<items.length;index++){
  const item=items[index];cost+=item.gold.total;
  if(!item.maps['11']||(!item.shopListedBySource&&item.id!==3040&&item.id!==3042&&item.id!==3121&&item.id!==2530)||item.requiredChampion&&item.requiredChampion.toLowerCase()!==champion.toLowerCase())return false;
  if(item.tags.includes('Boots')&&++boots>1)return false;
  for(let prior=0;prior<index;prior++)if(items[prior].id===item.id)return false;
 }
 if(!(cost<=budget))return false;
 // At most six items: scan families without allocating a filtered array per family.
 for(const family of families){let count=0;for(const item of items)if(family.includes(item.id)&&++count>1)return false;}
 return true;
}

// Includes stats-only candidates; effect coverage is always reported separately.
export const modeledItemIds=[3089,3135,3137,3116,4629,4633,6657,3083,2501,3748,3161,3053,3065,3071,3157,3102,3084,3040,3042,3031,3078,3508,6694,6676,3085,3115,3100,6653,6655,3094,6697,6665,4645,8020,3036,3302];
