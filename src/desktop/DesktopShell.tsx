import {invoke} from '@tauri-apps/api/core';
import {connectWindowMemory} from './window-memory';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Settings} from 'lucide-react';
import type {AppUpdate,ConnectionState,Platform,Preferences,RevisionInfo} from '../platform/types';
import ConnectionStrip from './ConnectionStrip';
import {FirstRunView,firstRunPatch,type FirstRunChoice} from './FirstRun';
import {ImportSettingsView,type SettingsAction} from './ImportSettings';
import './desktop.css';
import './catalog.css';
type Panel='none'|'first-run'|'settings';
/** Desktop-only chrome under the top bar: connection status, first-run setup and Import settings. */
export default function DesktopShell({platform,calculationBusy=false}:{platform:Platform;calculationBusy?:boolean}){
 const [status,setStatus]=useState<ConnectionState>({kind:'connecting'});
 const [prefs,setPrefs]=useState<Preferences|null>(null),[revision,setRevision]=useState<RevisionInfo|null>(null),[appUpdate,setAppUpdate]=useState<AppUpdate>();
 const [panel,setPanel]=useState<Panel>('none'),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const memoryBusy=useRef(false);memoryBusy.current=busy||calculationBusy;
 useEffect(()=>connectWindowMemory({events:window,focused:()=>document.hasFocus()&&!document.hidden,busy:()=>memoryBusy.current,send:active=>invoke<boolean>('set_window_activity',{active})}),[]);
 useEffect(()=>{
  let live=true;
  platform.status().then(s=>{if(live)setStatus(s)}).catch(()=>{});
  platform.preferences().then(p=>{if(!live)return;setPrefs(p);if(!p.autoImport.enabled&&!p.ui?.firstRunSeen)setPanel('first-run')}).catch(()=>{});
  platform.revision().then(r=>{if(live)setRevision(r)}).catch(()=>{});
  // The native side checks for app updates at launch; ask once in case one finished before this window opened.
  platform.checkAppUpdate().then(u=>{if(live&&u.ready)setAppUpdate(u)}).catch(()=>{});
  const offUpdate=platform.onAppUpdateReady(version=>setAppUpdate(u=>({current:u?.current||'',latest:version,ready:true})));
  const offStatus=platform.onStatus(setStatus),offRevision=platform.onDataRevision(r=>{setRevision(r);setMessage('New data is installed. Close and reopen this build window to load it; the current window keeps a consistent snapshot.')});
  return()=>{live=false;offStatus();offRevision();offUpdate()};
 },[platform]);
 const run=useCallback(async(task:()=>Promise<string|void>)=>{
  setBusy(true);setMessage('');
  try{const text=await task();if(text)setMessage(text)}
  catch(e){setMessage(e instanceof Error?e.message:'The desktop app could not do that.')}
  finally{setBusy(false)}
 },[]);
 const markFirstRunSeen=async()=>{await platform.saveUiState({...(prefs?.ui||{}),firstRunSeen:true});setPrefs(await platform.preferences())};
 const enable=(choice:FirstRunChoice)=>void run(async()=>{const patch=firstRunPatch(choice);if(!patch)return 'Choose items, runes or both.';await platform.updatePreferences(patch);await markFirstRunSeen();setPanel('none')});
 const skip=()=>void run(async()=>{await markFirstRunSeen();setPanel('none')});
 const test=()=>void run(async()=>(await platform.testConnection()).message);
 const act=(action:SettingsAction)=>void run(async()=>{
  switch(action.type){
   case 'patch':setPrefs(await platform.updatePreferences(action.patch));return;
   case 'pause':await platform.pause();return 'Automatic imports paused.';
   case 'resume':await platform.resume();return 'Automatic imports resumed.';
   case 'reapply':await platform.reapply();return 'Reapplying your current selection when champion select allows it.';
   case 'backup':await platform.openBackupFolder();return;
   case 'data':{const result=await platform.checkDataUpdates();setRevision(await platform.revision());return result.message}
   case 'app-update':setAppUpdate(await platform.checkAppUpdate());return;
   case 'install-update':return (await platform.installAppUpdate())?undefined:'No downloaded update is ready yet.';
   case 'release-page':await platform.openExternal('releases');return;
   case 'clear-default':await platform.clearDefault({champion:action.champion,role:action.role});setPrefs(await platform.preferences());return 'Saved build cleared.';
  }
 });
 const install=appUpdate?.ready?<button className="quiet" onClick={()=>act({type:'install-update'})}>Update {appUpdate.latest} ready · Restart to update</button>:null;
 const toggle=<button className="quiet" aria-expanded={panel==='settings'} aria-controls="desktop-panel" onClick={()=>{setMessage('');setPanel(p=>p==='settings'?'none':'settings')}}><Settings size={14} aria-hidden="true"/>Import settings</button>;
 return <div className="desktop-shell">
  <ConnectionStrip platform={platform} state={status} extra={<>{install}{toggle}</>}/>
  {panel!=='none'&&<div id="desktop-panel">
   {panel==='first-run'&&<FirstRunView busy={busy} message={message} onEnable={enable} onSkip={skip} onTest={test}/>}
   {panel==='settings'&&prefs&&<ImportSettingsView prefs={prefs} revision={revision} status={status} busy={busy} message={message} appUpdate={appUpdate} onAction={act}/>}
  </div>}
 </div>;
}
