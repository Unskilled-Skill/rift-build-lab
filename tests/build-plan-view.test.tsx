import {it,expect} from 'vitest';
import fs from 'node:fs';
import {renderToString} from 'react-dom/server';
import catalog from '../public/data/catalog.json';
import type {Catalog} from '../src/types';
import {parseChatBuilds} from '../src/chat-builds';
import {buildFullMeta,parseMetaPlans} from '../src/meta-recommendations';
import {planFromChatBuild,planFromMeta,planFromWorkspace} from '../src/build-plan';
import BuildPlanView from '../src/BuildPlanView';
import PurchaseStages from '../src/PurchaseStages';
import PurchaseGuide from '../src/PurchaseGuide';
const data=catalog as unknown as Catalog;
const read=(path:string)=>fs.readFileSync(path,'utf8');
const text=(html:string)=>html.replace(/<!-- -->/g,'').replace(/<[^>]+>/g,' ').replace(/&#x27;/g,"'").replace(/&amp;/g,'&').replace(/\s+/g,' ');
const authored=planFromChatBuild(data,parseChatBuilds(read('public/data/champion-builds/Cassiopeia.json'),data).find(b=>!b.ranked)!,'authored');
const ceiling=planFromChatBuild(data,parseChatBuilds(read('public/data/ability-ceilings/Blitzcrank.json'),data)[0],'ceiling');
const index=JSON.parse(read('public/data/provider-research/index.json'));
const metaPlan=parseMetaPlans(JSON.parse(read('public/data/champion-meta-plans.json')),data).find(p=>p.champion==='Ahri')!;
const full=buildFullMeta(data,'Ahri',JSON.parse(read(`public/data/provider-research/${index.recordsDirectory}/Ahri.json`)).sources,metaPlan);
const meta=planFromMeta(data,full);

it('renders the build header, goal, purchase stages, runes and authored detail in reading order',()=>{
 const html=renderToString(<BuildPlanView data={data} plan={authored}/>),t=text(html);
 for(const part of [authored.name,authored.goal,'Purchase order','Rune page','Primary:','Stat shards',`Patch ${data.patch}`])expect(t).toContain(part);
 expect(t.indexOf('Purchase order')).toBeLessThan(t.indexOf('Rune page'));expect(t.indexOf(authored.goal)).toBeLessThan(t.indexOf('Purchase order'));
 for(const line of authored.authoredPriorities)expect(t).toContain(line.slice(0,40));
 for(const line of authored.tradeoffs)expect(t).toContain(line.slice(0,40));
 expect(html).toContain('aria-labelledby');
});
it('puts the actions bar between the header and the purchase order',()=>{
 const t=text(renderToString(<BuildPlanView data={data} plan={authored} actions={<p>ACTIONS</p>}/>));
 expect(t.indexOf(authored.goal)).toBeLessThan(t.indexOf('ACTIONS'));expect(t.indexOf('ACTIONS')).toBeLessThan(t.indexOf('Purchase order'));
 expect(t.indexOf('Final build')).toBeLessThan(t.indexOf('Purchase order'));
});
it('states unavailable stages plainly instead of inventing starting or recall items',()=>{
 const t=text(renderToString(<PurchaseStages data={data} stages={authored.stages}/>));
 expect(t).toMatch(/Starting purchase.*not available for this build/);expect(t.match(/not available for this build/g)).toHaveLength(1);expect(t).toMatch(/First recall options.*Inferred.*Tear of the Goddess/);
 const t2=text(renderToString(<BuildPlanView data={data} plan={ceiling}/>));expect(t2).toContain('Ability ceiling');expect(t2).toContain('not available for this build');
});
it('renders choose-one options as alternatives and counts repeated consumables',()=>{
 const t=text(renderToString(<PurchaseStages data={data} stages={meta.stages}/>));
 const recall=meta.stages.find(s=>s.id==='early-recall'&&s.chooseOne.length);
 if(recall){expect(t).toContain('Choose one');for(const id of recall.chooseOne)expect(t).toContain(data.items.find(i=>i.id===id)!.name)}
 const start=meta.stages.find(s=>s.id==='start')!;if(start.buy.filter(id=>id===2003).length>1)expect(t).toMatch(/Health Potion\s*×\s*2/);
 expect(t).toContain('Inferred');expect(t).toContain('Observed');
});
it('shows cumulative completed-item gold with tabular figures only where defined',()=>{
 const html=renderToString(<PurchaseStages data={data} stages={authored.stages}/>);
 const final=authored.stages.at(-1)!.cumulativeGold!;expect(text(html)).toContain(`${final.toLocaleString('en-US')}g`);
});
it('never labels a damage-calculated order as a practical buy order',()=>{
 const plan=planFromWorkspace(data,'Cassiopeia',[6657,3040,3116,3009,3157,3089],[8230,8226,8210,8236,8009,9105],[5008,5008,5001],'Planned',{order:'calculator'});
 const t=text(renderToString(<BuildPlanView data={data} plan={plan}/>));expect(t).toContain('Damage-calculated');expect(t).toMatch(/not a practical/i);
 expect(text(renderToString(<BuildPlanView data={data} plan={meta}/>))).not.toContain('Damage-calculated');
});
it('keeps the existing meta purchase guide working through the shared stage view',()=>{
 const t=text(renderToString(<PurchaseGuide data={data} build={full}/>));expect(t).toContain('Starting purchase');expect(t).toContain('First core target');expect(t).toMatch(/inferred checkpoints/i);
});
