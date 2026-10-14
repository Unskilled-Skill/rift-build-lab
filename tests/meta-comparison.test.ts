import {it,expect} from 'vitest';
import catalog from '../public/data/catalog.json';
import type {Catalog} from '../src/types';
import {compareMetaItems} from '../src/meta-comparison';
const data=catalog as unknown as Catalog;
it('compares actual costs and only listed item stats, with passive effects explicitly outside the comparison',()=>{
 const r=compareMetaItems(data,[3089],[3165]);expect(r.originalCost).toBe(3500);expect(r.adaptedCost).toBe(2850);expect(r.costDelta).toBe(-650);expect(r.stats.find(s=>s.name==='Ability Power')?.delta).toBeLessThan(0);expect(r.removed).toEqual([3089]);expect(r.added).toEqual([3165]);
 expect(compareMetaItems(data,[3089],[3089]).stats.every(s=>s.delta===0)).toBe(true);
});
