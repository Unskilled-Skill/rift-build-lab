import {it,expect} from 'vitest';
import fs from 'node:fs';
import catalog from '../public/data/catalog.json';
import type {Catalog} from '../src/types';
import {createLeagueItemSet,createLeagueRunePage,createCompanionBundle,companionURI} from '../src/league-export';
const data=catalog as unknown as Catalog;
const setup={champion:'Cassiopeia',name:'Q into E',itemIds:[6657,3040,3116,3009,3157,3089],runePage:[8230,8226,8210,8236,8009,9105],shards:[5008,5008,5001]};
it('exports a champion-specific native item set with counted potions and buyable transformation prerequisites',()=>{
 const set=createLeagueItemSet(data,setup,[{title:'Starting purchase',itemIds:[1056,2003,2003],note:'Inferred start'},{title:'First recall options',itemIds:[],choiceIds:[3070,1052],note:'Choose a component'}]);
 expect(set.associatedChampions).toEqual([69]);expect(set.associatedMaps).toEqual([11]);expect(set.blocks[0].items.find(i=>i.id==='2003')?.count).toBe(2);expect(set.blocks.find(b=>b.type.startsWith('Final build'))?.items).toContainEqual({id:'3003',count:1});expect(JSON.stringify(set)).not.toContain('"id":"3040"');expect(set.blocks.some(b=>b.type.includes('choose'))).toBe(true);
});
it('exports exact rune trees, six runes and three shard rows, rejecting invalid pages and duplicate selections',()=>{
 const r=createLeagueRunePage(data,setup.runePage,setup.shards);expect(r.primaryStyleId).toBe(8200);expect(r.subStyleId).toBe(8000);expect(r.selectedPerkIds).toEqual([...setup.runePage,...setup.shards]);expect(r.current).toBe(true);
 expect(()=>createLeagueRunePage(data,[...setup.runePage.slice(0,5),setup.runePage[4]],setup.shards)).toThrow();expect(()=>createLeagueRunePage(data,setup.runePage,[5001,5008,5001])).toThrow();
});
it('uses a bounded Unicode-safe handoff that includes no local path, endpoint or credential',()=>{
 const b=createCompanionBundle(data,{...setup,name:'Cassiopeia — café'});const uri=companionURI(b);expect(uri.startsWith('riftbuildlab://import?data=')).toBe(true);const encoded=new URL(uri).searchParams.get('data')!;const roundtrip=JSON.parse(Buffer.from(encoded,'base64url').toString('utf8'));expect(roundtrip.buildName).toBe('Cassiopeia — café');expect(roundtrip.championId).toBe(69);expect(roundtrip.dataVersion).toBe(data.version);expect(uri.length).toBeLessThan(20000);
 for(const ids of [[999999],[],[6657,6657]])expect(()=>createLeagueItemSet(data,{...setup,itemIds:ids})).toThrow();
});
it('can export the full roster of existing authored experimental builds',()=>{
 for(const champion of data.champions){const builds=JSON.parse(fs.readFileSync(`public/data/champion-builds/${champion.alias}.json`,'utf8')).builds;for(const b of builds){const bundle=createCompanionBundle(data,{champion:b.champion,name:b.name,itemIds:b.itemIds,runePage:b.runePage,shards:b.shards});expect(bundle.itemSet.blocks.length).toBeGreaterThan(0);expect(bundle.runePage.selectedPerkIds).toHaveLength(9);expect(companionURI(bundle).length).toBeLessThan(20000)}}
});

it('exports every main-role meta plan with purchase checkpoints and shares real bundles with companion contract tests',async()=>{
 const {buildFullMeta,parseMetaPlans}=await import('../src/meta-recommendations');
 const {purchaseCheckpoints}=await import('../src/purchase-checkpoints');
 const plans=parseMetaPlans(JSON.parse(fs.readFileSync('public/data/champion-meta-plans.json','utf8')),data);
 const index=JSON.parse(fs.readFileSync('public/data/provider-research/index.json','utf8'));
 const bundles=[];
 for(const champion of data.champions){for(const b of JSON.parse(fs.readFileSync(`public/data/champion-builds/${champion.alias}.json`,'utf8')).builds)bundles.push(createCompanionBundle(data,{champion:b.champion,name:b.name,itemIds:b.itemIds,runePage:b.runePage,shards:b.shards}));}
 for(const p of plans){const sources=JSON.parse(fs.readFileSync(`public/data/provider-research/${index.recordsDirectory}/${p.champion}.json`,'utf8')).sources;const full=buildFullMeta(data,p.champion,sources,p);const bundle=createCompanionBundle(data,{champion:p.champion,name:'Meta plan',itemIds:full.itemIds,runePage:full.runePage,shards:full.shards},purchaseCheckpoints(data,full));expect(bundle.itemSet.blocks.length).toBeGreaterThan(2);expect(companionURI(bundle).length).toBeLessThan(20000);bundles.push(bundle)}
 fs.mkdirSync('output/companion-contract',{recursive:true});fs.writeFileSync('output/companion-contract/bundles.json',JSON.stringify(bundles));fs.writeFileSync('output/companion-contract/cassiopeia.riftbuild.json',JSON.stringify(bundles.find(b=>b.championAlias==='Cassiopeia')));
});
