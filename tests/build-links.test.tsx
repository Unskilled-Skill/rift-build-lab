import {it,expect,vi} from 'vitest';
import fs from 'node:fs';
import {renderToString} from 'react-dom/server';
import catalog from '../public/data/catalog.json';
import type {Catalog} from '../src/types';
import type {Platform,Preferences} from '../src/platform/types';
import {desktopLink,mergeUi,restoreUi,routeForPlan} from '../src/platform/build-links';
import {parseChatBuilds} from '../src/chat-builds';
import {planFromChatBuild,planFromWorkspace} from '../src/build-plan';
import BuildActions from '../src/BuildActions';
const data=catalog as unknown as Catalog;

it('routes a linked plan to the tab, collection and build that show it',()=>{
 expect(routeForPlan('authored:Ahri:ahri-reference-orb')).toEqual({tab:'Builds',collection:'four',buildId:'ahri-reference-orb'});
 expect(routeForPlan('ceiling:Ahri:ahri-ceiling-q')).toEqual({tab:'Builds',collection:'ceilings',buildId:'ahri-ceiling-q'});
 expect(routeForPlan('experiment:Sett:sett-w')).toEqual({tab:'Builds',collection:'earlier',buildId:'sett-w'});
 expect(routeForPlan('meta-reference:Ahri:ahri-meta-mid')).toEqual({tab:'Builds',collection:'meta',buildId:'ahri-meta-mid'});
 expect(routeForPlan('meta:Ahri:mid:opgg')).toEqual({tab:'Meta & teams'});
 for(const id of [undefined,'workspace:Ahri:1-2-3','nonsense','authored:Ahri:'])expect(routeForPlan(id)).toEqual({tab:'Builds'});
});
it('restores only a known tab and champion from saved window state',()=>{
 expect(restoreUi({tab:'Test bench',champion:'Ahri',firstRunSeen:true},data.champions)).toEqual({tab:'Test bench',champion:'Ahri'});
 expect(restoreUi({tab:'Admin',champion:'Nobody'},data.champions)).toEqual({});
 expect(restoreUi(undefined,data.champions)).toEqual({});
 expect(restoreUi({tab:7,champion:['Ahri']},data.champions)).toEqual({});
});
it('merges window state with what is already saved',async()=>{
 const saved:Record<string,unknown>[]=[];
 const platform={preferences:async()=>({ui:{firstRunSeen:true,tab:'Items'}}) as unknown as Preferences,saveUiState:vi.fn(async(s:Record<string,unknown>)=>{saved.push(s)})} as unknown as Platform;
 await mergeUi(platform,{tab:'Builds',champion:'Ahri'});
 expect(saved).toEqual([{firstRunSeen:true,tab:'Builds',champion:'Ahri'}]);
});
it('links saved builds to the desktop app but never unsaved test-bench setups',()=>{
 const b=parseChatBuilds(fs.readFileSync('public/data/champion-builds/Ahri.json','utf8'),data)[0];
 const plan=planFromChatBuild(data,b,'authored');
 expect(desktopLink(plan)).toBe(`riftbuildlab-desktop://open?champion=Ahri&plan=authored:Ahri:${b.id}`);
 expect(desktopLink(planFromWorkspace(data,'Cassiopeia',[6657,3040,3116,3009,3157,3089],[8230,8226,8210,8236,8009,9105],[5008,5008,5001],'x'))).toBeNull();
 expect(desktopLink({...plan,id:'authored:Ahri:bad id'})).toBeNull();
});
it('offers the optional desktop app on the website without claiming it is required',()=>{
 const b=parseChatBuilds(fs.readFileSync('public/data/champion-builds/Ahri.json','utf8'),data)[0];
 const html=renderToString(<BuildActions data={data} plan={planFromChatBuild(data,b,'authored')}/>);
 expect(html).toContain('href="https://github.com/Unskilled-Skill/rift-build-lab/releases"');
 expect(html).toContain(`href="riftbuildlab-desktop://open?champion=Ahri&amp;plan=authored:Ahri:${b.id}"`);
 expect(html).toMatch(/Windows desktop app \(optional\)/);expect(html).toMatch(/Windows 10 or 11/);
 const native={apply:async()=>({outcome:'verified' as const,message:''}),setDefault:async()=>{}};
 const desktop=renderToString(<BuildActions data={data} plan={planFromChatBuild(data,b,'authored')} native={native}/>);
 expect(desktop).not.toContain('riftbuildlab-desktop://');expect(desktop).not.toContain('Windows desktop app (optional)');
});
