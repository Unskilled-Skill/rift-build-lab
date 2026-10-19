import {it,expect} from 'vitest';
import catalog from '../public/data/catalog.json';
import {purchaseTiming} from '../src/purchase-timing';
import {planPurchases} from '../src/purchase-planner';
import {defaultScenario} from '../src/scenario';
import {calculate} from '../src/engine';
import type {Catalog} from '../src/types';
const data=catalog as unknown as Catalog;
it('brings owned stacking items forward without changing the final inventory',()=>{
 const ids=[3089,3135,3084,6697,6657,3020];
 const timing=purchaseTiming(data,ids);
 expect(timing.stackingIds).toEqual([6657,3084,6697]);
 expect(timing.coreIds.slice(0,3)).toEqual([6657,3084,6697]);
 expect(ids).toEqual([3089,3135,3084,6697,6657,3020]);
 expect(timing.notes.join(' ')).toContain('ten minutes');
 expect(timing.notes.join(' ')).toContain('do not grant health');
});
it('makes early Collector income conditional and starts Tear preparation early',()=>{
 const normal=purchaseTiming(data,[3031,3036,6676,3042]);
 const snowball=purchaseTiming(data,[3031,3036,6676,3042],true);
 expect(normal.coreIds).toEqual([3031,3036,6676,3042]);
 expect(snowball.coreIds).toEqual([3031,6676,3036,3042]);
 expect(normal.tearEarly).toBe(true);
 expect(normal.notes.join(' ')).toContain('25 bonus gold');
 expect(normal.notes.join(' ')).toContain('assists give no Taxes gold');
});
it('constrains the damage order only when practical timing priorities are requested',()=>{
 const champion=data.champions.find(c=>c.alias==='Cassiopeia')!,s=defaultScenario(champion.alias);
 const ids=[3089,3135,6657];
 const result=planPurchases(data,champion,s,ids,{prioritizeStacks:true});
 expect(result.ids[0]).toBe(6657);
 expect(result.constrained).toBe(true);
 expect(result.steps.every(step=>Number.isFinite(step.damage))).toBe(true);
 expect(planPurchases(data,champion,s,ids).constrained).toBe(false);
});
it('retains target bonus HP and finite-target scoring while clearing earned build preparation',()=>{
 const champion=data.champions.find(c=>c.alias==='Blitzcrank')!,s={...defaultScenario(champion.alias),effects:{targetBonusHP:1500,stopAtDeath:true,hubrisActive:true,hubrisKills:10},firstStrikeReady:true,spellbladeReady:true};
 const ids=[3036,6697],result=planPurchases(data,champion,s,ids);
 const expected=calculate(champion,ids.map(id=>data.items.find(i=>i.id===id)!),{...s,effects:{targetBonusHP:1500,stopAtDeath:true},rodStacks:0,heartsteelHP:0,gatheringMinutes:0,conquerorStacks:0,spellbladeReady:false,firstStrikeReady:false});
 expect(result.steps.at(-1)!.damage).toBeCloseTo(expected.damage);
});
