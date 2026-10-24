import {it,expect} from 'vitest';
import fs from 'node:fs';
import {renderToString} from 'react-dom/server';
import catalog from '../public/data/catalog.json';
import type {Catalog} from '../src/types';
import {parseChatBuilds} from '../src/chat-builds';
import {buildFullMeta,parseMetaPlans} from '../src/meta-recommendations';
import {planFromChatBuild,planFromMeta,planFromWorkspace} from '../src/build-plan';
import {createLeagueItemSet,createLeagueItemSetFromPlan,createBundleFromPlan,createCompanionBundle,workspaceCheckpoints} from '../src/league-export';
import BuildActions,{outcomeText} from '../src/BuildActions';
import type {NativeBuildActions} from '../src/platform/types';
const data=catalog as unknown as Catalog;
const read=(path:string)=>fs.readFileSync(path,'utf8');
const text=(html:string)=>html.replace(/<!-- -->/g,'').replace(/<[^>]+>/g,' ').replace(/&#x27;/g,"'").replace(/&amp;/g,'&').replace(/\s+/g,' ');
const authored=planFromChatBuild(data,parseChatBuilds(read('public/data/champion-builds/Cassiopeia.json'),data).find(b=>!b.ranked)!,'authored');
const index=JSON.parse(read('public/data/provider-research/index.json'));
const full=buildFullMeta(data,'Ahri',JSON.parse(read(`public/data/provider-research/${index.recordsDirectory}/Ahri.json`)).sources,parseMetaPlans(JSON.parse(read('public/data/champion-meta-plans.json')),data).find(p=>p.champion==='Ahri')!);
const meta=planFromMeta(data,full);
const native:NativeBuildActions={apply:async()=>({outcome:'verified',message:'ok'}),setDefault:async()=>{}};
const bench={ids:[6657,3040,3116,3009,3157,3089],runes:[8230,8226,8210,8236,8009,9105],shards:[5008,5008,5001]};

it('offers test bench and export actions on the website without native controls',()=>{
 const t=text(renderToString(<BuildActions data={data} plan={authored} onTest={()=>{}}/>));
 for(const label of ['Load into test bench','Download League item set','Download items + runes file','Open companion'])expect(t).toContain(label);
 for(const label of ['Apply now','Set as automatic default','Include items'])expect(t).not.toContain(label);
 expect(t).toContain('Cassiopeia');expect(t).toContain('Any role');
});
it('adds Apply now, automatic default and independent item/rune targets only when native actions exist',()=>{
 const t=text(renderToString(<BuildActions data={data} plan={meta} native={native}/>));
 for(const label of ['Apply now','Set as automatic default','Include items','Include runes','Mid'])expect(t).toContain(label);
 expect(renderToString(<BuildActions data={data} plan={authored} native={native}/>)).toMatch(/aria-label="Role for the automatic default"/);
 expect(renderToString(<BuildActions data={data} plan={meta} native={native}/>)).not.toMatch(/Role for the automatic default/);
});
it('disables actions with a stated reason when no legal plan exists',()=>{
 const t=text(renderToString(<BuildActions data={data} plan={null} disabledReason="Equip one to six legal items first."/>));expect(t).toContain('Equip one to six legal items first.');
 expect(renderToString(<BuildActions data={data} plan={null} disabledReason="x"/>)).toMatch(/disabled=""/);
});
it('describes every native outcome without calling a partial or unconfirmed write a success',()=>{
 expect(outcomeText({outcome:'verified',message:'m'})).toMatch(/confirmed/i);
 for(const outcome of ['applied-unverified','rolled-back','partial','rejected'] as const)expect(outcomeText({outcome,message:'m'})).not.toMatch(/^Applied and confirmed/);
 expect(outcomeText({outcome:'partial',message:'m'})).toMatch(/partial/i);expect(outcomeText({outcome:'applied-unverified',message:'m'})).toMatch(/not confirmed/i);
});
it('exports plan stages in stage order with choose-one alternatives as separate blocks',()=>{
 const set=createLeagueItemSetFromPlan(data,meta),expected=meta.stages.filter(s=>s.available&&s.id!=='final').flatMap(s=>[s.buy.length?s.title:null,s.chooseOne.length?`${s.title} — choose one option`:null]).filter(Boolean).map(t=>t==='Starting purchase'?'Starting purchase (inferred)':t);
 expect(set.blocks.map(b=>b.type)).toEqual([...expected,'Final build — buy prerequisites; earn upgrades']);
 expect(createBundleFromPlan(data,meta)).toEqual(createCompanionBundle(data,{champion:'Ahri',name:meta.name,itemIds:full.itemIds,runePage:full.runePage,shards:full.shards},meta.stages.filter(s=>s.available&&s.id!=='final').map(s=>({title:s.title,itemIds:s.buy,choiceIds:s.chooseOne.length?s.chooseOne:undefined,note:s.note}))));
});
it('keeps the test-bench export identical to the previous per-purchase output',()=>{
 const plan=planFromWorkspace(data,'Cassiopeia',bench.ids,bench.runes,bench.shards,'Working setup');
 const legacy=createLeagueItemSet(data,{champion:'Cassiopeia',name:'Working setup',itemIds:bench.ids},bench.ids.map((id,n)=>({title:`Purchase ${n+1}`,itemIds:[id],note:'Current equipped order'})));
 expect(createLeagueItemSetFromPlan(data,plan,workspaceCheckpoints(plan))).toEqual(legacy);
 expect(legacy.blocks.map(b=>[b.type,b.items.map(i=>i.id).join(',')])).toMatchInlineSnapshot(`
   [
     [
       "Purchase 1",
       "6657",
     ],
     [
       "Purchase 2",
       "3003",
     ],
     [
       "Purchase 3",
       "3116",
     ],
     [
       "Purchase 4",
       "3009",
     ],
     [
       "Purchase 5",
       "3157",
     ],
     [
       "Purchase 6",
       "3089",
     ],
     [
       "Final build — buy prerequisites; earn upgrades",
       "6657,3003,3116,3009,3157,3089",
     ],
   ]
 `);
});
