import {it,expect} from 'vitest';
import fs from 'node:fs';
import catalog from '../public/data/catalog.json';
import type {Catalog} from '../src/types';
import {buildFullMeta,parseMetaPlans} from '../src/meta-recommendations';
import {metaTestBuild} from '../src/meta-test-build';
import {toTestSave,parseChatBuilds} from '../src/chat-builds';
const data=catalog as unknown as Catalog;
it('loads every completed meta plan into a recoverable manual test without losing provenance',()=>{
 const plans=parseMetaPlans(JSON.parse(fs.readFileSync('public/data/champion-meta-plans.json','utf8')),data);
 const index=JSON.parse(fs.readFileSync('public/data/provider-research/index.json','utf8'));
 for(const p of plans){const sources=JSON.parse(fs.readFileSync(`public/data/provider-research/${index.recordsDirectory}/${p.champion}.json`,'utf8')).sources;const full=buildFullMeta(data,p.champion,sources,p);const b=metaTestBuild(full,data,{allies:[],enemies:[]});const saved=toTestSave(b,data);expect(saved.items,p.champion).toEqual(full.itemIds);expect(saved.requiresManualTest).toBe(true);expect(b.coverageNotes.join(' ')).toContain(full.sourceURL);expect(parseChatBuilds(JSON.stringify({version:1,patch:data.patch,builds:[b]}),data)[0].id).toBe(b.id)}
});
