import {it,expect} from 'vitest';
import catalog from '../public/data/catalog.json';
import type {Catalog} from '../src/types';
import {defaultScenario} from '../src/engine';
import {parseWorkspaceDraft,providerBaseline,comparisonScenario,comparisonReady} from '../src/workspace-draft';
const data=catalog as unknown as Catalog;
it('restores a validated active champion, section and scenario',()=>{
 const save={version:1,patch:'26.20',scenario:defaultScenario('Sett'),items:[3084],notes:'Keep my test'};
 const draft=parseWorkspaceDraft(JSON.stringify({version:1,save,tab:'Test bench'}),data);
 expect(draft.save.scenario.champion).toBe('Sett');expect(draft.save.items).toEqual([3084]);expect(draft.tab).toBe('Test bench');
});
it('rejects corrupted workspace and illegal items instead of applying them',()=>{
 expect(()=>parseWorkspaceDraft('{broken',data)).toThrow();
 expect(()=>parseWorkspaceDraft(JSON.stringify({version:1,save:{version:1,patch:'26.20',scenario:defaultScenario(),items:[-1]},tab:'Test bench'}),data)).toThrow();
});
it('retains an explicitly selected partial model independently of the full-build manual flag',()=>{
 const save={version:1,patch:'26.20',scenario:defaultScenario('Blitzcrank'),items:[],requiresManualTest:true};
 const draft=parseWorkspaceDraft(JSON.stringify({version:1,save,tab:'Test bench',manualOnly:false}),data);
 expect(draft.manualOnly).toBe(false);
 expect(()=>parseWorkspaceDraft(JSON.stringify({version:1,save,tab:'Test bench',manualOnly:'no'}),data)).toThrow();
});
it('provider baselines retain observed cores and their provenance without invented late items',()=>{
 const baseline=providerBaseline({champion:'Cassiopeia',provider:'opgg',role:'mid',status:'available',sourceURL:'https://op.gg/open-source/opgg-mcp',checkedAt:'2026-10-14',sourcePatch:'16.20',selection:'Core',observedCoreItemIds:[6657,3040],observedRunePage:defaultScenario().runePage,coreBuildMatches:100,limits:'Observed core'},data);
 expect(baseline.ids).toEqual([6657,3040]);expect(baseline.source?.matches).toBe(100);expect(baseline.source?.kind).toBe('observed-core');
});
it('comparison shares target and cast conditions while preserving the baseline rune page',()=>{
 const scenario={...defaultScenario(),mr:150,duration:10};
 const base={ids:[],names:[],runePage:[8010,8009,9104,8014,8226,8210],shards:[5008,5008,5001]};
 const next=comparisonScenario(scenario,base);
 expect(next.mr).toBe(150);expect(next.duration).toBe(10);expect(next.runePage).toEqual(base.runePage);expect(scenario.runePage).not.toEqual(base.runePage);
});
it('withholds relative ranking until both setups fit the shared constraints and item count',()=>{
 const scenario=defaultScenario('Sett');const b={ids:[3084],names:['Heartsteel']};
 expect(comparisonReady(scenario,[],b,data)).toBe(false);
 expect(comparisonReady(scenario,[3083],b,data)).toBe(true);
 expect(comparisonReady({...scenario,budget:1000},[3083],b,data)).toBe(false);
 expect(comparisonReady({...scenario,runePage:[8010,8010,8010,8010,8010,8010]},[3083],b,data)).toBe(false);
 expect(comparisonReady(scenario,[3083],{...b,runePage:[]},data)).toBe(false);
});
