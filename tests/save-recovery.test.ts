import {it,expect} from 'vitest';
import catalog from '../public/data/catalog.json';
import type {Catalog} from '../src/types';
import {defaultScenario} from '../src/engine';
import {partitionSavedHistory} from '../src/storage';
const data=catalog as unknown as Catalog;
it('retains valid saves when a stricter family guard rejects another, without losing the rejected payload',()=>{
 const valid={version:1,patch:'26.20',scenario:defaultScenario('Sett'),items:[],notes:'Keep this experiment'};
 const oldInvalid={...valid,items:[3071,3036],notes:'Previously accepted conflicting penetration'};
 const split=partitionSavedHistory([oldInvalid,valid],data);
 expect(split.valid).toHaveLength(1);expect(split.valid[0].notes).toBe(valid.notes);expect(split.rejected).toEqual([oldInvalid]);
 const next=[{...valid,notes:'New save'},...split.valid,...split.rejected];
 expect(partitionSavedHistory(next,data).valid).toHaveLength(2);expect(partitionSavedHistory(next,data).rejected).toEqual([oldInvalid]);
});
