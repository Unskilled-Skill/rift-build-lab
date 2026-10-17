import {it,expect} from 'vitest';
import fs from 'node:fs';
import {renderToString} from 'react-dom/server';
import catalog from '../public/data/catalog.json';
import type {Catalog} from '../src/types';
import type {ConnectionState,Platform} from '../src/platform/types';
import {describeStatus,planLabel} from '../src/desktop/status';
import ConnectionStrip from '../src/desktop/ConnectionStrip';
import BuildActions from '../src/BuildActions';
import {NativeContext} from '../src/platform/native-context';
import {parseChatBuilds} from '../src/chat-builds';
import {planFromChatBuild} from '../src/build-plan';
const data=catalog as unknown as Catalog;
const samples=JSON.parse(fs.readFileSync('tests/fixtures/ipc-samples.json','utf8'));
const text=(html:string)=>html.replace(/<!-- -->/g,'').replace(/<[^>]+>/g,' ').replace(/&#x27;/g,"'").replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();

it('describes every state the native core reports, with an action where one helps',()=>{
 const seen=new Set<string>();
 for(const state of samples.statuses as ConnectionState[]){const d=describeStatus(state);expect(d.title.length,state.kind).toBeGreaterThan(3);seen.add(state.kind)}
 expect([...seen].sort()).toEqual(['applied','applying','champ-select','connected','connecting','disabled','league-closed','needs-attention','paused']);
 expect(describeStatus({kind:'paused'}).actions).toEqual(['resume']);
 expect(describeStatus({kind:'champ-select',champion:'Ahri',role:'mid'})).toMatchObject({title:'Champion select · Ahri · Mid',actions:['pause']});
 expect(describeStatus({kind:'connected',phase:'InProgress'}).title).toBe('Connected · in game');
 const attention=describeStatus({kind:'needs-attention',code:'rune-capacity',message:'No rune page slot.',recovery:'Free a slot, then reapply.'});
 expect(attention).toMatchObject({tone:'warning',title:'No rune page slot.',detail:'Free a slot, then reapply.',actions:['reapply','pause']});
});
it('never presents a pending or unconfirmed import as a confirmed one',()=>{
 expect(describeStatus({kind:'applying'}).title).toMatch(/^Importing/);
 const unconfirmed=describeStatus({kind:'applied',build:'meta:Ahri:mid:opgg',verified:false});
 expect(unconfirmed.tone).toBe('warning');expect(unconfirmed.title).toMatch(/not confirmed/i);
 expect(describeStatus({kind:'applied',build:'meta:Ahri:mid:opgg',verified:true})).toMatchObject({tone:'ok',title:'Imported Ahri mid meta plan'});
 for(const state of samples.statuses as ConnectionState[])if(state.kind!=='applied'||!state.verified)expect(describeStatus(state).title).not.toMatch(/^Imported/);
 expect(planLabel('authored:Cassiopeia:cass-reference')).toBe('Cassiopeia saved build');
 expect(planLabel('weird')).toBe('selected build');
});
it('renders a compact live status region',()=>{
 const html=renderToString(<ConnectionStrip platform={{} as Platform} initial={{kind:'league-closed'}}/>);
 expect(html).toMatch(/role="status"/);expect(text(html)).toContain('League closed');
 const paused=text(renderToString(<ConnectionStrip platform={{} as Platform} initial={{kind:'paused'}}/>));
 expect(paused).toContain('Resume');
});
it('offers Apply now and Set as automatic default when the desktop app provides native actions',()=>{
 const plan=planFromChatBuild(data,parseChatBuilds(fs.readFileSync('public/data/champion-builds/Ahri.json','utf8'),data)[0],'authored');
 const native={apply:async()=>({outcome:'verified' as const,message:''}),setDefault:async()=>{}};
 const desktop=text(renderToString(<NativeContext.Provider value={native}><BuildActions data={data} plan={plan}/></NativeContext.Provider>));
 expect(desktop).toContain('Apply now');expect(desktop).toContain('Set as automatic default');expect(desktop).not.toContain('Open companion');
 const web=text(renderToString(<BuildActions data={data} plan={plan}/>));
 expect(web).not.toContain('Apply now');expect(web).toContain('Open companion');
});
