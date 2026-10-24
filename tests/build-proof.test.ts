import {it,expect} from 'vitest';
import fs from 'node:fs';
import catalog from '../public/data/catalog.json';
import timing from '../public/data/item-timing.json';
import type {Catalog} from '../src/types';
import {parseChampionBuilds} from '../src/chat-builds';
import {planFromChatBuild} from '../src/build-plan';
import {buildProof,proofSummary} from '../src/build-proof';
const data={...(catalog as unknown as Catalog),itemTiming:timing as never};
const builds=(alias:string)=>parseChampionBuilds(fs.readFileSync(`public/data/champion-builds/${alias}.json`,'utf8'),data,alias);
it('marks every ranked Reference as proven',()=>{
 for(const c of data.champions)expect(planFromChatBuild(data,builds(c.alias)[0],'authored').proof?.level,c.alias).toBe('proven');
});
it('grades a build by its ranked core items, unseen items and keystone',()=>{
 const ranked=builds('Ahri')[0],ids=ranked.itemIds;
 expect(buildProof(data,'Ahri',ids,ranked.runePage)!.level).toBe('proven');
 const offKeystone=[8010,9111,9104,8017,8233,8237];
 const p=buildProof(data,'Ahri',ids,offKeystone)!;
 expect(p.keystone).toBe(false);expect(p.level).toBe('adapted');expect(p.seen).toBe(p.total);expect(proofSummary(data,'Ahri',p)).toMatch(/usually take (Deathfire Touch|Electrocute)/);
 expect(buildProof(data,'Ahri',[3071,3053,6333,3742,3065,3047],offKeystone)!.level).toBe('experimental');
});
it('says nothing when no ranked data is loaded',()=>{
 expect(buildProof(catalog as unknown as Catalog,'Ahri',[6655],[8112])).toBeUndefined();
 expect(planFromChatBuild(catalog as unknown as Catalog,builds('Ahri')[1],'authored').proof).toBeUndefined();
});
