import {it,expect,vi,beforeEach} from 'vitest';
import fs from 'node:fs';
import * as guards from '../src/platform/guards';
import {PlatformError} from '../src/platform/types';

const samples=JSON.parse(fs.readFileSync('tests/fixtures/ipc-samples.json','utf8'));
const invoke=vi.fn();
const handlers=new Map<string,(event:{payload:unknown})=>void>();
const unlisten=vi.fn();
vi.mock('@tauri-apps/api/core',()=>({invoke:(...args:unknown[])=>invoke(...args)}));
vi.mock('@tauri-apps/api/event',()=>({listen:async(name:string,handler:(event:{payload:unknown})=>void)=>{handlers.set(name,handler);return unlisten}}));
beforeEach(()=>{invoke.mockReset();handlers.clear();unlisten.mockReset()});

it('accepts every payload the native core actually produces',()=>{
 for(const s of samples.statuses)expect(guards.isConnectionState(s),JSON.stringify(s)).toBe(true);
 for(const s of samples.applyResults)expect(guards.isApplyResult(s),JSON.stringify(s)).toBe(true);
 for(const s of samples.preferences)expect(guards.isPreferences(s)).toBe(true);
 for(const s of samples.dataUpdates)expect(guards.isDataUpdateResult(s)).toBe(true);
 for(const s of samples.revisions)expect(guards.isRevisionInfo(s)).toBe(true);
 for(const s of samples.connections)expect(guards.isTestConnection(s)).toBe(true);
 for(const s of samples.appUpdates)expect(guards.isAppUpdate(s)).toBe(true);
 for(const s of samples.openBuilds)expect(guards.isOpenBuild(s)).toBe(true);
 for(const s of samples.errors)expect(guards.isIpcError(s)).toBe(true);
});
it('rejects unknown kinds, missing fields and wrong types',()=>{
 for(const bad of [null,'connected',{kind:'teleporting'},{kind:'connected'},{kind:'applied',build:'x'},{kind:'champ-select',role:'middle'},{kind:'needs-attention',code:'oops',message:'m',recovery:'r'},{kind:'connected',phase:7}])
  expect(guards.isConnectionState(bad),JSON.stringify(bad)).toBe(false);
 for(const bad of [{outcome:'success',message:'m'},{outcome:'verified'},{outcome:'verified',message:'m',backupPath:3}])expect(guards.isApplyResult(bad)).toBe(false);
 const prefs=structuredClone(samples.preferences[1]);delete prefs.autoImport.runes;expect(guards.isPreferences(prefs)).toBe(false);
 expect(guards.isPreferences({...samples.preferences[0],schema:2})).toBe(false);
 expect(guards.isDataUpdateResult({...samples.dataUpdates[0],status:'maybe'})).toBe(false);
 expect(guards.isOpenBuild({champion:'../x'})).toBe(false);
 expect(guards.isOpenBuild({champion:'Ahri',planId:'meta Ahri'})).toBe(false);
});
it('calls each native command with the argument shape the Rust side expects',async()=>{
 const {desktopPlatform:p}=await import('../src/platform/desktop');
 expect(p.kind).toBe('desktop');expect(Object.values(p.capabilities).every(Boolean)).toBe(true);
 const respond=(value:unknown)=>invoke.mockResolvedValueOnce(value);
 respond(samples.statuses[3]);expect(await p.status()).toEqual({kind:'connected',phase:'Lobby'});
 respond(samples.applyResults[0]);await p.apply({championAlias:'Ahri'} as never,{items:true,runes:false});
 respond(null);await p.setDefault({champion:'Ahri',role:'mid'},{championAlias:'Ahri'} as never,'meta:Ahri:mid:opgg');
 respond(samples.preferences[0]);await p.updatePreferences({autoImport:{enabled:true}});
 respond(null);await p.openExternal({kind:'source',url:'https://op.gg/x'});
 respond(null);await p.openExternal('releases');
 respond(null);await p.saveUiState({tab:'Builds'});
 respond(samples.openBuilds[0]);expect(await p.takePendingOpen()).toEqual({champion:'Ahri',planId:'meta:Ahri:mid:opgg'});
 respond(null);expect(await p.takePendingOpen()).toBeNull();
 expect(invoke.mock.calls).toEqual([
  ['get_status'],
  ['apply_build',{request:{bundle:{championAlias:'Ahri'},items:true,runes:false}}],
  ['set_default_build',{request:{champion:'Ahri',role:'mid',planId:'meta:Ahri:mid:opgg',bundle:{championAlias:'Ahri'}}}],
  ['update_preferences',{patch:{autoImport:{enabled:true}}}],
  ['open_external',{link:{kind:'source',url:'https://op.gg/x'}}],
  ['open_external',{link:{kind:'releases'}}],
  ['ui_state_saved',{state:{tab:'Builds'}}],
  ['take_pending_open'],
  ['take_pending_open'],
 ]);
});
it('turns native errors and malformed responses into typed platform errors',async()=>{
 const {desktopPlatform:p}=await import('../src/platform/desktop');
 invoke.mockRejectedValueOnce(samples.errors[0]);
 const error=await p.apply({} as never,{items:true,runes:true}).catch(e=>e);
 expect(error).toBeInstanceOf(PlatformError);expect(error).toMatchObject({code:'rune-capacity',recovery:expect.stringContaining('rune page')});
 invoke.mockRejectedValueOnce('invalid args `request` for command `apply_build`: unknown field');
 expect(await p.apply({} as never,{items:true,runes:true}).catch(e=>e)).toMatchObject({name:'PlatformError',code:'internal'});
 invoke.mockResolvedValueOnce({outcome:'success',message:'all good'});
 expect(await p.apply({} as never,{items:true,runes:true}).catch(e=>e)).toMatchObject({code:'internal'});
 invoke.mockResolvedValueOnce({kind:'teleporting'});
 expect(await p.status().catch(e=>e)).toMatchObject({code:'internal'});
});
it('delivers only valid events and unsubscribes cleanly',async()=>{
 const {desktopPlatform:p}=await import('../src/platform/desktop');
 const seen:unknown[]=[];const off=p.onStatus(s=>seen.push(s));
 await vi.waitFor(()=>expect(handlers.has('status-changed')).toBe(true));
 handlers.get('status-changed')!({payload:samples.statuses[7]});
 handlers.get('status-changed')!({payload:{kind:'hacked'}});
 expect(seen).toEqual([samples.statuses[7]]);
 const opened:unknown[]=[];p.onOpenBuild(b=>opened.push(b));const persist=vi.fn();p.onPersistUiState(persist);
 await vi.waitFor(()=>expect(handlers.has('persist-ui-state')).toBe(true));
 handlers.get('open-build')!({payload:samples.openBuilds[1]});handlers.get('open-build')!({payload:{champion:'../../x'}});handlers.get('persist-ui-state')!({payload:null});
 expect(opened).toEqual([samples.openBuilds[1]]);expect(persist).toHaveBeenCalledOnce();
 off();expect(unlisten).toHaveBeenCalledOnce();
});
