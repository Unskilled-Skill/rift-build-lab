import {it,expect} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import catalog from '../public/data/catalog.json';
import type {Catalog} from '../src/types';
import {validRunePage} from '../src/storage';
import {FORMULA_COMPAT} from '../src/model-support';
import {buildManifest,generateMetaBundles,isManifestPath,manifestPaths} from '../scripts/desktop-data/generate';
const data=catalog as unknown as Catalog;
const files=generateMetaBundles('public/data');

it('precomputes a validated meta fallback bundle for every champion and qualified role',()=>{
 expect([...files.keys()].sort()).toEqual(data.champions.map(c=>c.alias).sort());
 const roles=JSON.parse(fs.readFileSync('public/data/provider-roles/index.json','utf8')).champions as Record<string,string[]>;
 const all=[];
 for(const [champion,file] of files){
  expect(file.champion).toBe(champion);expect(file.patch).toBe(data.patch);expect(file.dataVersion).toBe(data.version);
  expect(Object.keys(file.roles).length).toBe(1+(roles[champion]?.length||0));
  for(const [role,{planId,bundle}] of Object.entries(file.roles)){
   expect(['top','jungle','mid','adc','support']).toContain(role);expect(planId).toMatch(new RegExp(`^meta:${champion}:${role}:(opgg|lolalytics)$`));
   expect(bundle.championAlias).toBe(champion);expect(bundle.version).toBe(1);expect(bundle.runePage.name).toBe('Rift Build Lab');
   expect(validRunePage(bundle.runePage.selectedPerkIds.slice(0,6),data.trees)).toBe(true);
   for(const block of bundle.itemSet.blocks)for(const i of block.items)expect(data.items.some(item=>String(item.id)===i.id)).toBe(true);
   all.push(bundle);
  }
 }
 fs.mkdirSync('output/companion-contract',{recursive:true});fs.writeFileSync('output/companion-contract/desktop-meta-bundles.json',JSON.stringify(all));
});
it('accepts only relative paths inside the published data tree',()=>{
 for(const p of ['catalog.json','champions/Ahri.json','provider-research/versions/abc-1/Ahri.json','desktop/meta-bundles/Ahri.json','chatgpt-builds.json'])expect(isManifestPath(p),p).toBe(true);
 for(const p of ['../catalog.json','/catalog.json','champions/../x.json','champions\\Ahri.json','downloads/companion.zip','index.html','champions/','https://x/catalog.json','desktop/manifest.json'])expect(isManifestPath(p),p).toBe(false);
});
it('lists only the current provider revisions and never legacy, stale or raw files',()=>{
 const listed=manifestPaths('public/data');const research=JSON.parse(fs.readFileSync('public/data/provider-research/index.json','utf8')).recordsDirectory,roles=JSON.parse(fs.readFileSync('public/data/provider-roles/index.json','utf8')).recordsDirectory;
 expect(listed).toContain('catalog.json');expect(listed).toContain('provider-research/index.json');expect(listed).toContain(`provider-research/${research}/Ahri.json`);expect(listed).toContain('provider-roles/index.json');
 expect(listed.filter(p=>p.startsWith('provider-research/versions/')&&!p.startsWith(`provider-research/${research}/`))).toEqual([]);
 expect(listed.filter(p=>p.startsWith('provider-roles/versions/')&&!p.startsWith(`provider-roles/${roles}/`))).toEqual([]);
 expect(listed.filter(p=>/^provider-research\/[^/]+\.json$/.test(p))).toEqual(['provider-research/index.json']);
 expect(listed.every(isManifestPath)).toBe(true);expect([...listed].sort()).toEqual(listed);
});
it('builds a deterministic, content-addressed manifest with sizes, hashes and compatibility',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rbl-manifest-'));
 const write=(p:string,text:string)=>{fs.mkdirSync(path.dirname(path.join(dir,p)),{recursive:true});fs.writeFileSync(path.join(dir,p),text)};
 write('catalog.json',JSON.stringify({patch:'26.20',version:'16.20.1'}));write('champions/Ahri.json','{}');write('provider-research/index.json',JSON.stringify({checkedAt:'2026-10-17',recordsDirectory:'versions/a'}));write('provider-research/versions/a/Ahri.json','[1]');write('provider-research/versions/old/Ahri.json','[0]');write('provider-roles/index.json',JSON.stringify({checkedAt:'2026-10-15',recordsDirectory:'versions/r'}));write('notes.txt','x');
 const a=buildManifest(dir,'2026-10-17T10:00:00Z'),b=buildManifest(dir,'2026-10-18T10:00:00Z');
 expect(a.revision).toBe(b.revision);expect(a.generatedAt).not.toBe(b.generatedAt);
 expect(a).toMatchObject({schema:1,formulaCompat:FORMULA_COMPAT,patch:'26.20',dataVersion:'16.20.1',sourceCheckedAt:{providers:'2026-10-17',roles:'2026-10-15'}});
 expect(a.files.map(f=>f.path)).toEqual(['catalog.json','champions/Ahri.json','provider-research/index.json','provider-research/versions/a/Ahri.json','provider-roles/index.json']);
 expect(a.files.find(f=>f.path==='champions/Ahri.json')).toEqual({path:'champions/Ahri.json',bytes:2,sha256:'44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a'});
 write('champions/Ahri.json','{"x":1}');expect(buildManifest(dir,'2026-10-17T10:00:00Z').revision).not.toBe(a.revision);
 fs.rmSync(dir,{recursive:true,force:true});
});
it('keeps the published desktop data set within a reviewed size',()=>{
 const total=manifestPaths('public/data').reduce((n,p)=>n+fs.statSync(path.join('public/data',p)).size,0);
 console.log(`Desktop data set (before generated bundles): ${(total/1048576).toFixed(1)} MiB in ${manifestPaths('public/data').length} files`);
 expect(total).toBeLessThan(25*1048576);
});
