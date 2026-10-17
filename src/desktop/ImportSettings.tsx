import {Download,FolderOpen,Pause,Play,RefreshCw,RotateCcw,X} from 'lucide-react';
import type {AssignedRole,ConnectionState,Preferences,PreferencesPatch,RevisionInfo} from '../platform/types';
import {planLabel} from './status';
export type SettingsAction=
 |{type:'patch';patch:PreferencesPatch}|{type:'pause'}|{type:'resume'}|{type:'reapply'}
 |{type:'backup'}|{type:'data'}|{type:'app-update'}|{type:'release-page'}
 |{type:'clear-default';champion:string;role:AssignedRole};
const roleNames:Record<string,string>={top:'Top',jungle:'Jungle',mid:'Mid',adc:'Bot',support:'Support'};
const split=(key:string)=>{const [champion,role]=key.split('|');return {champion,role:role as AssignedRole}};
interface Props {prefs:Preferences;revision:RevisionInfo|null;status:ConnectionState;busy:boolean;message:string;appUpdate?:{latest?:string;releaseUrl?:string;current:string};onAction:(action:SettingsAction)=>void}
export function ImportSettingsView({prefs,revision,status,busy,message,appUpdate,onAction}:Props){
 const a=prefs.autoImport,b=prefs.background,patch=(p:PreferencesPatch)=>onAction({type:'patch',patch:p});
 const defaults=Object.entries(prefs.defaults),review=Object.entries(prefs.needsReview||{});
 const paused=status.kind==='paused';
 return <section className="desktop-panel import-settings" aria-labelledby="import-settings-heading">
  <h2 id="import-settings-heading">Import settings</h2>
  <fieldset><legend>Automatic imports</legend>
   <label className="check"><input type="checkbox" checked={a.enabled} disabled={busy||(!a.items&&!a.runes)} onChange={()=>patch({autoImport:{enabled:!a.enabled}})}/>Automatic imports in champion select</label>
   <label className="check"><input type="checkbox" checked={a.items} disabled={busy||(a.enabled&&!a.runes)} onChange={()=>patch({autoImport:{items:!a.items}})}/>Items</label>
   <label className="check"><input type="checkbox" checked={a.runes} disabled={busy||(a.enabled&&!a.items)} onChange={()=>patch({autoImport:{runes:!a.runes}})}/>Runes</label>
   <label className="check"><input type="checkbox" checked={a.metaFallback} disabled={busy||!a.enabled} onChange={()=>patch({autoImport:{metaFallback:!a.metaFallback}})}/>Use the current meta plan for my role when no build is saved</label>
   <div className="desktop-panel-actions">
    {a.enabled&&(paused?<button className="secondary" disabled={busy} onClick={()=>onAction({type:'resume'})}><Play size={14} aria-hidden="true"/>Resume</button>:<button className="secondary" disabled={busy} onClick={()=>onAction({type:'pause'})}><Pause size={14} aria-hidden="true"/>Pause</button>)}
    <button className="secondary" disabled={busy} onClick={()=>onAction({type:'reapply'})}><RotateCcw size={14} aria-hidden="true"/>Reapply current selection</button>
    <button className="quiet" disabled={busy} onClick={()=>onAction({type:'backup'})}><FolderOpen size={14} aria-hidden="true"/>Open backup folder</button>
   </div>
   <p className="footnote">{prefs.lastApplied?`Last import: ${planLabel(prefs.lastApplied.planId)} · ${prefs.lastApplied.outcome==='verified'?'confirmed':prefs.lastApplied.outcome==='applied-unverified'?'not confirmed':prefs.lastApplied.outcome} · ${prefs.lastApplied.at.slice(0,16).replace('T',' ')}`:'Nothing imported yet.'}</p>
   {prefs.lastFailure&&<p className="footnote warning">Last problem: {prefs.lastFailure.message}</p>}
  </fieldset>
  <fieldset><legend>Saved builds per champion and role</legend>
   {!defaults.length&&!review.length&&<p className="footnote">No saved builds yet. Use “Set as automatic default” on any build page.</p>}
   <ul className="default-list">
    {defaults.map(([key,d])=>{const {champion,role}=split(key);return <li key={key}><span>{champion} · {roleNames[role]} · {planLabel(d.planId)}</span><button className="quiet" disabled={busy} aria-label={`Clear ${champion} ${roleNames[role]}`} onClick={()=>onAction({type:'clear-default',champion,role})}><X size={12} aria-hidden="true"/>Clear</button></li>})}
    {review.map(([key,d])=>{const {champion,role}=split(key);return <li key={key} className="needs-review"><span>{champion} · {roleNames[role]} · needs review (saved for patch {d.patch}; choose it again for the current data)</span><button className="quiet" disabled={busy} aria-label={`Clear ${champion} ${roleNames[role]}`} onClick={()=>onAction({type:'clear-default',champion,role})}><X size={12} aria-hidden="true"/>Clear</button></li>})}
   </ul>
  </fieldset>
  <fieldset><legend>Build data</legend>
   {revision?<p className="footnote">{revision.bundled?'Bundled with the app':'Downloaded update'} · Patch {revision.patch} · Provider data checked {revision.sourceCheckedAt.providers} · roles checked {revision.sourceCheckedAt.roles} · revision {revision.revision.slice(0,12)}</p>:<p className="footnote">Loading data details…</p>}
   <button className="secondary" disabled={busy} onClick={()=>onAction({type:'data'})}><RefreshCw size={14} aria-hidden="true"/>Check for data updates</button>
   <p className="footnote">New provider data arrives without reinstalling. New damage formulas or patches need an app update.</p>
  </fieldset>
  <fieldset><legend>Background</legend>
   <label className="check"><input type="checkbox" checked={b.trayOnClose} disabled={busy} onChange={()=>patch({background:{trayOnClose:!b.trayOnClose}})}/>Keep running in the tray when the window closes</label>
   <label className="check"><input type="checkbox" checked={b.startWithWindows} disabled={busy} onChange={()=>patch({background:{startWithWindows:!b.startWithWindows}})}/>Start with Windows</label>
   <p className="footnote">In the tray, only the small background process runs; the window is rebuilt when you open it. Quit from the tray menu stops imports.</p>
  </fieldset>
  <fieldset><legend>App version</legend>
   <p className="footnote">{appUpdate?appUpdate.releaseUrl?`Version ${appUpdate.latest} is available (you have ${appUpdate.current}).`:`You have the latest version (${appUpdate.current}).`:'Updates are downloaded from the official GitHub releases page; the app never replaces itself silently.'}</p>
   <div className="desktop-panel-actions">
    <button className="secondary" disabled={busy} onClick={()=>onAction({type:'app-update'})}><RefreshCw size={14} aria-hidden="true"/>Check for app update</button>
    {appUpdate?.releaseUrl&&<button className="primary" disabled={busy} onClick={()=>onAction({type:'release-page'})}><Download size={14} aria-hidden="true"/>Open release page</button>}
   </div>
  </fieldset>
  {message&&<p className="footnote" role="status">{message}</p>}
 </section>;
}
