import {it,expect} from 'vitest';
import catalog from '../public/data/catalog.json';
import type {Catalog} from '../src/types';
import type {FullMetaBuild} from '../src/meta-recommendations';
import {purchaseCheckpoints} from '../src/purchase-checkpoints';
const data=catalog as unknown as Catalog;
const build=(role:string,ids:number[])=>({champion:'Ahri',role,itemIds:ids,observedCoreItemIds:ids.filter(id=>id!==3020),reasons:[]} as unknown as FullMetaBuild);
it('separates a legal support start, earned transformations and core checkpoints',()=>{
 const support=purchaseCheckpoints(data,build('support',[6620,3158,3870,6617,3222,3107]));expect(support[0].itemIds).toContain(3865);expect(support.find(s=>s.title==='Boots window')?.itemIds).toContain(3158);
 const mage=purchaseCheckpoints(data,build('mid',[3040,3020,3116,3089,3135,3157]));expect(mage.some(s=>s.note.includes('earn'))).toBe(true);expect(mage[0].itemIds).not.toContain(3040);
});
it('offers a jungle pet choice and never treats final inventory as the recall script',()=>{const steps=purchaseCheckpoints(data,build('jungle',[3118,3020,4645,3089,3135,3157]));expect(steps[0].choiceIds).toEqual([1101,1102,1103]);expect(steps.map(s=>s.title)).toContain('First recall options');expect(steps.every(s=>s.itemIds.every(id=>data.items.some(i=>i.id===id)))).toBe(true)});
