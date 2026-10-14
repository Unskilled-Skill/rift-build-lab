import {it,expect} from 'vitest';
import catalog from '../public/data/catalog.json';
import type {Catalog} from '../src/types';
import {defaultScenario} from '../src/engine';
import {parseSave} from '../src/storage';
const data=catalog as unknown as Catalog;
const parse=(scenario:unknown)=>parseSave(JSON.stringify({version:1,patch:data.patch,scenario,items:[]}),data.champions,data.items);
it('retains new objective and finite proc conditions on import',()=>{
 const scenario={...defaultScenario('Blitzcrank'),mode:'blitz-e',objectiveSlot:'E',critMode:'normal',spellbladeReady:true,gatheringMinutes:30,targetHealthPercent:29};
 expect(parse(scenario).scenario).toMatchObject({mode:'blitz-e',objectiveSlot:'E',spellbladeReady:true,gatheringMinutes:30,targetHealthPercent:29});
});
it('rejects invalid finite state and champion-specific ability modes',()=>{
 expect(()=>parse({...defaultScenario(),mode:'tahm-r'})).toThrow();
 expect(()=>parse({...defaultScenario(),gatheringMinutes:Infinity})).toThrow();
 expect(()=>parse({...defaultScenario(),objectiveSlot:'X'})).toThrow();
});
