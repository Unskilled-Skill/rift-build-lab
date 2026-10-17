import {expect,it} from 'vitest';
import catalog from '../public/data/catalog.json';
import {legalBuild} from '../src/engine';
import {itemFamilies} from '../src/item-families.mjs';
import type {Item} from '../src/types';
// Preserve the pre-optimization rules as an independent differential oracle.
function reference(items:Item[],budget:number,slots:number,champion:string){
 return items.length<=slots&&new Set(items.map(i=>i.id)).size===items.length&&items.reduce((n,i)=>n+i.gold.total,0)<=budget&&items.every(i=>i.maps['11']&&(i.shopListedBySource||[3040,3042,3121,2530].includes(i.id))&&(!i.requiredChampion||i.requiredChampion.toLowerCase()===champion.toLowerCase()))&&itemFamilies.every(f=>items.filter(i=>f.includes(i.id)).length<=1)&&items.filter(i=>i.tags.includes('Boots')).length<=1;
}
it('preserves source, family, duplicate, budget, slot, and champion restrictions',()=>{
 const source=catalog.items as Item[];let seed=37;
 const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed};
 for(let n=0;n<3000;n++){
  const items=Array.from({length:random()%8},()=>source[random()%source.length]);
  const budget=random()%20000,slots=random()%7,champion=catalog.champions[random()%catalog.champions.length].alias;
  expect(legalBuild(items,budget,slots,champion)).toBe(reference(items,budget,slots,champion));
 }
});
