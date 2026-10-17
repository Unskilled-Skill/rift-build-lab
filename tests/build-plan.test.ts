import {it,expect} from 'vitest';
import fs from 'node:fs';
import catalog from '../public/data/catalog.json';
import type {Catalog} from '../src/types';
import type {ChatBuild} from '../src/chat-builds';
import type {MetaPlan} from '../src/meta-recommendations';
import {parseChatBuilds} from '../src/chat-builds';
import {buildFullMeta,parseMetaPlans} from '../src/meta-recommendations';
import {purchaseCheckpoints} from '../src/purchase-checkpoints';
import {parseRoleIndex,parseRoleSources,roleMetaPlan} from '../src/provider-role-selection';
import {validRunePage} from '../src/storage';
import {legalBuild} from '../src/engine';
import {createLeagueItemSet,createLeagueItemSetFromPlan,createBundleFromPlan} from '../src/league-export';
import {type BuildPlan,BuildPlanError,planFromChatBuild,planFromMeta,planFromWorkspace,normalizeRole} from '../src/build-plan';
const data=catalog as unknown as Catalog;
const read=(path:string)=>fs.readFileSync(path,'utf8');
const item=(id:number)=>data.items.find(i=>i.id===id)!;
const authored=data.champions.flatMap(c=>parseChatBuilds(read(`public/data/champion-builds/${c.alias}.json`),data));
const ceilings=data.champions.flatMap(c=>parseChatBuilds(read(`public/data/ability-ceilings/${c.alias}.json`),data));
const experiments=parseChatBuilds(read('public/data/chatgpt-builds.json'),data);
const references=parseChatBuilds(read('public/data/meta-baselines.json'),data);
function metaPlans(){
 const plans=parseMetaPlans(JSON.parse(read('public/data/champion-meta-plans.json')),data);
 const index=JSON.parse(read('public/data/provider-research/index.json'));
 const out:BuildPlan[]=[];
 for(const p of plans){const sources=JSON.parse(read(`public/data/provider-research/${index.recordsDirectory}/${p.champion}.json`)).sources;const full=buildFullMeta(data,p.champion,sources,p);out.push(planFromMeta(data,full))}
 const roles=parseRoleIndex(JSON.parse(read('public/data/provider-roles/index.json')),data);
 for(const [champion,list] of Object.entries(roles.champions)){const entries=parseRoleSources(JSON.parse(read(`public/data/provider-roles/${roles.recordsDirectory}/${champion}.json`)),data,champion);for(const role of list){const p=roleMetaPlan(plans.find(p=>p.champion===champion) as MetaPlan,role);out.push(planFromMeta(data,buildFullMeta(data,champion,entries.find(e=>e.role===role)!.sources,p)))}}
 return out;
}
const all=():BuildPlan[]=>[...authored.map(b=>planFromChatBuild(data,b,'authored')),...ceilings.map(b=>planFromChatBuild(data,b,'ceiling')),...experiments.map(b=>planFromChatBuild(data,b,'experiment')),...references.map(b=>planFromChatBuild(data,b,'meta-reference')),...metaPlans()];
const plans=all();

it('converts every authored, ceiling, experiment, reference and qualified meta build',()=>{
 expect(authored).toHaveLength(692);expect(ceilings.length).toBeGreaterThanOrEqual(173);
 expect(plans.length).toBe(authored.length+ceilings.length+experiments.length+references.length+metaPlans().length);
 expect(new Set(plans.map(p=>p.id)).size).toBe(plans.length);
});
it('keeps legal runes, shards and one to six legal final items in every plan',()=>{
 for(const p of plans){expect(validRunePage(p.runePage,data.trees),p.id).toBe(true);expect(p.shards,p.id).toHaveLength(3);expect(p.finalItemIds.length).toBeGreaterThan(0);expect(p.finalItemIds.length).toBeLessThanOrEqual(6);expect(legalBuild(p.finalItemIds.map(item),100000,6,p.champion),p.id).toBe(true)}
});
it('never lists one item as both a purchase and a choose-one alternative, and ends with the final inventory',()=>{
 for(const p of plans){for(const s of p.stages)expect(s.buy.filter(id=>s.chooseOne.includes(id)),`${p.id} ${s.id}`).toEqual([]);const last=p.stages.at(-1)!;expect(last.id).toBe('final');expect(last.buy).toEqual(p.finalItemIds);expect(p.stages.filter(s=>s.id==='final')).toHaveLength(1)}
});
it('keeps an available starting purchase within 500 gold',()=>{
 for(const p of plans){const s=p.stages.find(s=>s.id==='start');if(!s?.available)continue;expect(s.buy.reduce((n,id)=>n+item(id).gold.total,0),p.id).toBeLessThanOrEqual(500);for(const id of s.chooseOne)expect(item(id).gold.total).toBeLessThanOrEqual(500)}
});
it('marks unknown starting and recall stages unavailable for authored builds instead of inventing them',()=>{
 for(const p of plans.filter(p=>p.collection!=='meta')){for(const id of ['start','early-recall'] as const){const s=p.stages.find(s=>s.id===id)!;expect(s.available,p.id).toBe(false);expect(s.buy).toEqual([]);expect(s.chooseOne).toEqual([])}}
 const meta=plans.filter(p=>p.collection==='meta');expect(meta.length).toBeGreaterThanOrEqual(173);for(const p of meta)expect(p.stages.find(s=>s.id==='start')!.available,p.id).toBe(true);
});
it('labels provenance honestly: authored order for authored builds, inferred stages for meta plans, never calculator by default',()=>{
 for(const p of plans){expect(p.provenance.order).not.toBe('calculator');for(const s of p.stages)expect(s.provenance).not.toBe('calculator')}
 const meta=plans.find(p=>p.collection==='meta')!;expect(meta.stages.find(s=>s.id==='start')!.provenance).toBe('inferred');expect(meta.provenance.items).toBe('source-observed');
 const own=plans.find(p=>p.collection==='authored')!;expect(own.provenance).toEqual({items:'authored',runes:'authored',order:'authored'});
});
it('exports plans with only Summoner’s Rift shop items and buyable prerequisites for earned upgrades',()=>{
 const earned=[3040,3042,3121,2530,3869,3870,3871,3876,3877];
 for(const p of plans){const set=createLeagueItemSetFromPlan(data,p);const ids=set.blocks.flatMap(b=>b.items.map(i=>Number(i.id)));for(const id of ids){expect(item(id).maps['11'],`${p.id} ${id}`).toBe(true);expect(item(id).shopListedBySource).toBe(true);expect(earned).not.toContain(id)}expect(set.associatedChampions).toEqual([data.champions.find(c=>c.alias===p.champion)!.id]);expect(set.blocks.length).toBeLessThanOrEqual(16)}
});
it('exports plan stages in order, skips unavailable stages and keeps choose-one alternatives in their own block',()=>{
 const meta=plans.find(p=>p.collection==='meta'&&p.stages.some(s=>s.id==='early-recall'&&s.chooseOne.length))!;const set=createLeagueItemSetFromPlan(data,meta);
 const titles=set.blocks.map(b=>b.type);expect(titles[0]).toBe('Starting purchase (inferred)');expect(titles).toContain('First recall options — choose one option');expect(titles.at(-1)).toBe('Final build — buy prerequisites; earn upgrades');
 const own=plans.find(p=>p.collection==='authored')!;expect(createLeagueItemSetFromPlan(data,own).blocks.map(b=>b.type).some(t=>/Starting|recall/i.test(t))).toBe(false);
});
it('produces the same item set as the existing meta export for the same checkpoints',async()=>{
 const p=parseMetaPlans(JSON.parse(read('public/data/champion-meta-plans.json')),data).find(p=>p.champion==='Ahri')!;const index=JSON.parse(read('public/data/provider-research/index.json'));
 const full=buildFullMeta(data,'Ahri',JSON.parse(read(`public/data/provider-research/${index.recordsDirectory}/Ahri.json`)).sources,p);const plan=planFromMeta(data,full);
 const legacy=createLeagueItemSet(data,{champion:'Ahri',name:plan.name,itemIds:full.itemIds},purchaseCheckpoints(data,full));expect(createLeagueItemSetFromPlan(data,plan)).toEqual(legacy);
 const bundle=createBundleFromPlan(data,plan);expect(bundle.championAlias).toBe('Ahri');expect(bundle.runePage.selectedPerkIds).toEqual([...plan.runePage,...plan.shards]);
});
it('preserves authored buy-order prose verbatim and never derives item IDs from it',()=>{
 for(const b of authored.slice(0,40)){const p=planFromChatBuild(data,b,'authored');expect(p.authoredPriorities).toEqual(b.buyOrder);expect(p.finalItemIds).toEqual(b.itemIds)}
});
it('maps earned first-core items to their buyable prerequisite with an earn note',()=>{
 const b=authored.find(b=>b.itemIds.find(id=>!item(id).tags.includes('Boots'))===3040)??authored.find(b=>b.itemIds.includes(3040))!;
 const s=planFromChatBuild(data,{...b,itemIds:[3040,...b.itemIds.filter(id=>id!==3040)]},'authored').stages.find(s=>s.id==='first-core')!;expect(s.buy).toEqual([3003]);expect(s.note).toMatch(/earn/i);
});
it('is stable for the same input and reports cumulative completed-item gold',()=>{
 const b=authored[0];const a=planFromChatBuild(data,b,'authored'),c=planFromChatBuild(data,structuredClone(b),'authored');expect(a).toEqual(c);expect(a.id).toBe(`authored:${b.champion}:${b.id}`);
 const fin=a.stages.at(-1)!;expect(fin.cumulativeGold).toBeGreaterThan(0);const steps=a.stages.filter(s=>s.cumulativeGold!==undefined).map(s=>s.cumulativeGold!);expect([...steps].sort((x,y)=>x-y)).toEqual(steps);
});
it('normalizes provider and client role names and rejects unknown champions or illegal setups',()=>{
 expect(['top','jungle','mid','middle','bot','bottom','adc','support','utility','','ARAM'].map(normalizeRole)).toEqual(['top','jungle','mid','mid','adc','adc','adc','support','support','unspecified','unspecified']);
 const b:ChatBuild=authored[0];
 expect(()=>planFromChatBuild(data,{...b,champion:'Nobody'},'authored')).toThrow(BuildPlanError);
 expect(()=>planFromChatBuild(data,{...b,runePage:[1,2,3,4,5,6]},'authored')).toThrow(BuildPlanError);
 expect(()=>planFromWorkspace(data,'Cassiopeia',[999999],b.runePage,b.shards,'x')).toThrow(BuildPlanError);
});
it('builds a test-bench plan from the current workspace without claiming a practical order',()=>{
 const p=planFromWorkspace(data,'Cassiopeia',[6657,3040,3116,3009,3157,3089],[8230,8226,8210,8236,8009,9105],[5008,5008,5001],'Working setup');
 expect(p.collection).toBe('workspace');expect(p.role).toBe('unspecified');expect(p.stages.map(s=>s.id)).toEqual(['final']);expect(p.provenance.order).toBe('authored');
 expect(planFromWorkspace(data,'Cassiopeia',[6657,3040,3116,3009,3157,3089],[8230,8226,8210,8236,8009,9105],[5008,5008,5001],'Planned',{order:'calculator'}).provenance.order).toBe('calculator');
});
it('filters plans by collection and role without reordering them',async()=>{
 const {filterPlans}=await import('../src/build-plan');
 const refs=plans.filter(p=>p.collection==='meta-reference');
 expect(filterPlans(plans,{collection:'meta-reference'})).toEqual(refs);
 const mid=filterPlans(plans,{collection:'meta-reference',role:'mid'});expect(mid.length).toBeGreaterThan(0);expect(mid.every(p=>p.role==='mid'&&p.collection==='meta-reference')).toBe(true);
 expect(filterPlans(plans,{})).toEqual(plans);expect(filterPlans(plans,{role:'all'})).toEqual(plans);
 expect(new Set(refs.map(p=>p.role))).toContain('adc');
});
