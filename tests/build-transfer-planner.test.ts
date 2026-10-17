import {it,expect} from 'vitest';
import catalog from '../public/data/catalog.json';
import type {Catalog} from '../src/types';
import {defaultScenario,calculate} from '../src/engine';
import {createCompanionBundle,createLeagueItemSet} from '../src/league-export';
import {previewImport} from '../src/build-import';
import {planPurchases} from '../src/purchase-planner';
const data=catalog as unknown as Catalog;
const setup={champion:'Cassiopeia',name:'Test',itemIds:[3089,3116,3135],runePage:defaultScenario().runePage,shards:defaultScenario().shards};
it('roundtrips a companion file with its exact runes and item order',()=>{
 const p=previewImport(JSON.stringify(createCompanionBundle(data,setup)),data,'Sett');
 expect(p.save.items).toEqual(setup.itemIds);expect(p.save.scenario.champion).toBe('Cassiopeia');expect(p.save.scenario.runePage).toEqual(setup.runePage);
});
it('imports the final League block and requires a champion for unassociated sets',()=>{
 const set=createLeagueItemSet(data,setup);set.blocks.unshift({type:'Starting items',items:[{id:'1056',count:1}]});
 expect(previewImport(JSON.stringify(set),data,'Sett').save.items).toEqual(setup.itemIds);
 set.associatedChampions=[];expect(previewImport(JSON.stringify(set),data,'Sett').save.scenario.champion).toBe('Sett');
});
it('rejects unknown items, duplicates, malformed bundles and old patches without dropping data',()=>{
 const b=createCompanionBundle(data,setup);
 expect(()=>previewImport(JSON.stringify({...b,patch:'26.1'}),data,'Sett')).toThrow(/patch/i);
 b.itemSet.blocks.at(-1)!.items=[{id:'999999',count:1}];expect(()=>previewImport(JSON.stringify(b),data,'Sett')).toThrow();
 expect(()=>previewImport('{"blocks":[null]}',data,'Sett')).toThrow(/purchase block/i);expect(()=>previewImport('null',data,'Sett')).toThrow();expect(()=>previewImport('x'.repeat(100001),data,'Sett')).toThrow();
});
it('finds the exhaustive best early damage area and preserves the final set',()=>{
 const c=data.champions.find(c=>c.alias==='Cassiopeia')!,s=defaultScenario();
 const items=setup.itemIds.map(id=>data.items.find(i=>i.id===id)!);
 const score=(order:typeof items)=>{let spent=0,value=0;for(let n=0;n<order.length;n++){value+=calculate(c,order.slice(0,n),s).damage*order[n].gold.total;spent+=order[n].gold.total}return value/spent};
 const perms=<T,>(a:T[]):T[][]=>a.length?a.flatMap((x,n)=>perms(a.filter((_,i)=>i!==n)).map(p=>[x,...p])):[[]];
 const p=planPurchases(data,c,s,setup.itemIds);expect(p.averageDamage).toBeCloseTo(Math.max(...perms(items).map(score)));expect([...p.ids].sort()).toEqual([...setup.itemIds].sort());expect(p.steps).toHaveLength(3);
});
it('normalizes earned upgrades and rejects illegal planner inputs',()=>{
 const c=data.champions.find(c=>c.alias==='Cassiopeia')!;
 expect(planPurchases(data,c,defaultScenario(),[3040,3089]).ids).toContain(3003);
 expect(()=>planPurchases(data,c,defaultScenario(),[3089,3089])).toThrow();
});
