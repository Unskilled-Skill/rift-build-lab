import {it,expect} from 'vitest';
import fs from 'node:fs';
import catalog from '../public/data/catalog.json';
import type {Catalog} from '../src/types';
import {buildFullMeta,parseMetaPlans} from '../src/meta-recommendations';
import {metaTestBuild} from '../src/meta-test-build';
import {toTestSave,parseChatBuilds,parseTestRecords,snapshotTestProposal} from '../src/chat-builds';
const data=catalog as unknown as Catalog;
it('loads every completed meta plan into a recoverable manual test without losing provenance',()=>{
 const plans=parseMetaPlans(JSON.parse(fs.readFileSync('public/data/champion-meta-plans.json','utf8')),data);
 const index=JSON.parse(fs.readFileSync('public/data/provider-research/index.json','utf8'));
 for(const p of plans){const sources=JSON.parse(fs.readFileSync(`public/data/provider-research/${index.recordsDirectory}/${p.champion}.json`,'utf8')).sources;const full=buildFullMeta(data,p.champion,sources,p);const b=metaTestBuild(full,data,{allies:[],enemies:[]});const saved=toTestSave(b,data);expect(saved.items,p.champion).toEqual(full.itemIds);expect(saved.requiresManualTest).toBe(true);expect(b.coverageNotes.join(' ')).toContain(full.sourceURL);expect(parseChatBuilds(JSON.stringify({version:1,patch:data.patch,builds:[b]}),data)[0].id).toBe(b.id)}
});

it('keeps the exact teams, source and proposal in a historical result after the active proposal changes',()=>{
 const plans=parseMetaPlans(JSON.parse(fs.readFileSync('public/data/champion-meta-plans.json','utf8')),data),p=plans.find(p=>p.champion==='Cassiopeia')!;
 const index=JSON.parse(fs.readFileSync('public/data/provider-research/index.json','utf8'));const sources=JSON.parse(fs.readFileSync(`public/data/provider-research/${index.recordsDirectory}/Cassiopeia.json`,'utf8')).sources;
 const build=metaTestBuild(buildFullMeta(data,p.champion,sources,p),data,{allies:['Ornn'],enemies:['Soraka'],enemyHealing:true});const save=toTestSave(build,data);
 const record={buildId:build.id,champion:build.champion,name:build.name,date:'2026-10-15T00:00:00Z',outcome:'mixed',measuredDamage:100,observations:'Historical test fixture',scenario:save.scenario,itemIds:save.items,proposal:snapshotTestProposal(build)};
 build.hypothesis='Changed later';build.coverageNotes=[];
 const result=parseTestRecords(JSON.stringify([record]),data).records[0];expect(result.proposal?.hypothesis).toContain('Soraka');expect(result.proposal?.coverageNotes.join(' ')).toContain('https://');expect(result.proposal?.hypothesis).not.toContain('Changed later');
 expect(parseTestRecords(JSON.stringify([{...record,proposal:{...record.proposal,champion:'Zed'}}]),data).rejected).toBe(1);
});
