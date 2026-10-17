import {useEffect,useState} from 'react';
import {AlertTriangle,CheckCircle2,Pause,Play,PlugZap,PowerOff,RotateCcw,Swords} from 'lucide-react';
import type {ConnectionState,Platform} from '../platform/types';
import {describeStatus,type StatusAction} from './status';
import './desktop.css';
const icons={muted:PowerOff,active:PlugZap,ok:CheckCircle2,warning:AlertTriangle};
const labels:Record<StatusAction,string>={pause:'Pause',resume:'Resume',reapply:'Reapply'};
const actionIcons={pause:Pause,resume:Play,reapply:RotateCcw};
/** Desktop-only: League connection and automatic-import state, with the actions that help. */
export default function ConnectionStrip({platform,initial={kind:'connecting'}}:{platform:Platform;initial?:ConnectionState}){
 const [state,setState]=useState<ConnectionState>(initial),[error,setError]=useState('');
 useEffect(()=>{let live=true;platform.status().then(s=>{if(live)setState(s)}).catch(()=>{});const off=platform.onStatus(s=>{setState(s);setError('')});return()=>{live=false;off()}},[platform]);
 const view=describeStatus(state),Icon=state.kind==='champ-select'?Swords:icons[view.tone];
 const run=(action:StatusAction)=>{setError('');(action==='pause'?platform.pause():action==='resume'?platform.resume():platform.reapply()).catch(e=>setError(e instanceof Error?e.message:'The desktop app could not do that.'))};
 return <div className={`connection-strip tone-${view.tone}`} role="status" aria-live="polite">
  <Icon size={16} aria-hidden="true"/>
  <span className="connection-text"><strong>{view.title}</strong>{view.detail&&<small>{view.detail}</small>}{error&&<small className="warning">{error}</small>}</span>
  <span className="connection-actions">{view.actions.map(action=>{const ActionIcon=actionIcons[action];return <button key={action} className="quiet" onClick={()=>run(action)}><ActionIcon size={14} aria-hidden="true"/>{labels[action]}</button>})}</span>
 </div>;
}
