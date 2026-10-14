import {it,expect} from 'vitest';
import fs from 'node:fs';
import catalog from '../public/data/catalog.json';
import type {Catalog} from '../src/types';
import type {MetaPlan} from '../src/meta-recommendations';
import {metaTestBuild} from '../src/meta-test-build';
import {parseChatBuilds,toTestSave} from '../src/chat-builds';
import {buildFullMeta} from '../src/meta-recommendations';
import {parseRoleIndex,parseRoleSources,roleMetaPlan} from '../src/provider-role-selection';
const data=catalog as unknown as Catalog;
const plans=JSON.parse(fs.readFileSync('public/data/champion-meta-plans.json','utf8')).plans as MetaPlan[];
it('completes every published alternate role for each provider without importing an old support quest into a solo lane',()=>{
 const idx=parseRoleIndex(JSON.parse(fs.readFileSync('public/data/provider-roles/index.json','utf8')),data);
 for(const [champion,roles]of Object.entries(idx.champions)){const entries=parseRoleSources(JSON.parse(fs.readFileSync(`public/data/provider-roles/${idx.recordsDirectory}/${champion}.json`,'utf8')),data,champion);for(const role of roles){const p=roleMetaPlan(plans.find(p=>p.champion===champion)!,role),sources=entries.find(e=>e.role===role)!.sources;for(const provider of ['opgg','lolalytics'] as const){const b=buildFullMeta(data,champion,sources,p,provider);expect(b.sourceProvider).toBe(provider);expect(b.role).toBe(role);expect(b.itemIds).toHaveLength(6);const proposal=metaTestBuild(b,data);expect(parseChatBuilds(JSON.stringify({version:1,patch:data.patch,builds:[proposal]}),data)[0].id).toBe(proposal.id);expect(toTestSave(proposal,data).items).toEqual(b.itemIds);expect(b.itemIds.some(id=>[3869,3870,3871,3876,3877].includes(id))).toBe(role==='support')}}}
});
it('does not silently fall back to a different requested provider and refuses unreviewed role completions',()=>{
 const p=plans.find(p=>p.champion==='Ahri')!;expect(()=>roleMetaPlan(p,'jungle')).toThrow(/reviewed/i);expect(()=>buildFullMeta(data,'Ahri',[],p,'lolalytics')).toThrow();
 expect(()=>parseRoleIndex({version:1,patch:data.patch,recordsDirectory:'../../x',champions:{}},data)).toThrow();
});
