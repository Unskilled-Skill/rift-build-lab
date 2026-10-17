import {it,expect} from 'vitest';
import fs from 'node:fs';
import catalog from '../public/data/catalog.json';
import resources from '../scripts/champion-resources.json';
import meta from '../public/data/meta-baselines.json';
import {parseChatBuilds,toTestSave} from '../src/chat-builds';
import type {Catalog} from '../src/types';
import {validateMeta} from '../scripts/meta-baselines.mjs';
const data=catalog as unknown as Catalog;
it('every champion retains ceiling coverage and every published target loads a legal manual setup',()=>{
 for(const c of data.champions){
  const builds=parseChatBuilds(fs.readFileSync(`public/data/ability-ceilings/${c.alias}.json`,'utf8'),data);
  expect(builds.length).toBeGreaterThanOrEqual(1);
  for(const build of builds){
   expect(build.champion).toBe(c.alias);
   expect(build.ceiling?.verification).toBe('candidate');
   expect(toTestSave(build,data).requiresManualTest).toBe(true);
   expect(toTestSave(build,data).scenario.objectiveSlot?.split(':')[0]).toBe(build.ceiling?.targetSlot);
  }
 }
});
it('30 source references retain legal observed runes and exact item provenance',()=>{const raw=JSON.parse(fs.readFileSync('scripts/meta-baselines.json','utf8'));expect(validateMeta(raw,data,resources)).toHaveLength(30);const builds=parseChatBuilds(JSON.stringify(meta),data);expect(builds).toHaveLength(30);for(const b of builds){const e=raw.find((e:any)=>e.champion===b.champion);expect(b.runePage).toEqual(e.observedRunePage);expect(b.requiresManualTest).toBe(true);expect(b.meta?.inferredItemIds).toEqual(e.inferredItemIds)}const invalid=structuredClone(raw);invalid[0].inferredItemIds=[invalid[0].itemIds[0]];expect(()=>validateMeta(invalid,data,resources)).toThrow(/provenance/)});
it('source metadata rejects unsafe links and false observed item classifications',()=>{for(const change of [{sourceURL:'javascript:alert(1)'},{inferredItemIds:[6657]}]){const bad=structuredClone(meta);Object.assign(bad.builds[0].meta,change);expect(()=>parseChatBuilds(JSON.stringify(bad),data)).toThrow()}});
it('rank six manual benchmarks survive imports only for Jayce and Udyr',()=>{for(const alias of ['Jayce','Udyr']){const b=parseChatBuilds(fs.readFileSync(`public/data/ability-ceilings/${alias}.json`,'utf8'),data)[0];expect(toTestSave(b,data).scenario.rank).toBe(6);expect(()=>toTestSave({...b,conditions:{...b.conditions,rank:7}},data)).toThrow(/rank/)}const b=parseChatBuilds(fs.readFileSync('public/data/ability-ceilings/Ahri.json','utf8'),data)[0];expect(()=>toTestSave({...b,conditions:{...b.conditions,rank:6}},data)).toThrow(/rank/)});
it('secondary provider checks preserve their selection and reject unsafe source URLs',()=>{const builds=parseChatBuilds(JSON.stringify(meta),data);expect(builds.filter(b=>b.meta?.crosschecks)).toHaveLength(3);for(const b of builds.filter(b=>b.meta?.crosschecks)){expect(b.meta!.crosschecks!.find(c=>c.provider==='lolalytics')?.selection).toBe('Highest Win Build')}const bad=structuredClone(meta);bad.builds[0].meta.crosschecks![0].sourceURL='https://evil.example/';expect(()=>parseChatBuilds(JSON.stringify(bad),data)).toThrow(/crosscheck/)});
