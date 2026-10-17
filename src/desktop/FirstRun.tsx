import {useState} from 'react';
import {PlugZap,Zap} from 'lucide-react';
import type {PreferencesPatch} from '../platform/types';
export interface FirstRunChoice {items:boolean;runes:boolean;metaFallback:boolean}
/** Automatic imports start only from this explicit choice; the meta fallback only comes with it. */
export function firstRunPatch(choice:FirstRunChoice):PreferencesPatch|null{
 if(!choice.items&&!choice.runes)return null;
 return {autoImport:{enabled:true,items:choice.items,runes:choice.runes,metaFallback:choice.metaFallback}};
}
interface Props {busy:boolean;message:string;onEnable:(choice:FirstRunChoice)=>void;onSkip:()=>void;onTest:()=>void}
export function FirstRunView({busy,message,onEnable,onSkip,onTest}:Props){
 const [choice,setChoice]=useState<FirstRunChoice>({items:true,runes:true,metaFallback:false});
 const toggle=(key:keyof FirstRunChoice)=>setChoice(c=>({...c,[key]:!c[key]}));
 return <section className="desktop-panel first-run" aria-labelledby="first-run-heading">
  <h2 id="first-run-heading">Set up automatic imports</h2>
  <p>When you lock a champion in champion select, Rift Build Lab can put your chosen build into League for you. Nothing changes until you turn this on.</p>
  <ul className="first-run-facts">
   <li>Items: one item set per champion, titled Rift Build Lab. Personal item sets are kept.</li>
   <li>Runes: one editable rune page named Rift Build Lab, reused each time. Personal rune pages are never changed or deleted.</li>
   <li>Your previous League settings are saved to a local backup before every change.</li>
   <li>League is found on this computer. No Riot password, account login or API key is needed.</li>
  </ul>
  <fieldset><legend>What to import</legend>
   <label className="check"><input type="checkbox" checked={choice.items} onChange={()=>toggle('items')}/>Items (shop item set)</label>
   <label className="check"><input type="checkbox" checked={choice.runes} onChange={()=>toggle('runes')}/>Runes (Rift Build Lab rune page)</label>
   <label className="check"><input type="checkbox" checked={choice.metaFallback} onChange={()=>toggle('metaFallback')}/>Use the current meta plan for my role when I haven’t chosen a build for that champion</label>
   <p className="footnote">Without this, champions you haven’t set up show “Choose build” instead of importing anything. Experiments are never chosen automatically.</p>
  </fieldset>
  <div className="desktop-panel-actions">
   <button className="primary" disabled={busy||(!choice.items&&!choice.runes)} onClick={()=>onEnable(choice)}><Zap size={16} aria-hidden="true"/>Turn on automatic imports</button>
   <button className="secondary" disabled={busy} onClick={onTest}><PlugZap size={16} aria-hidden="true"/>Test League connection</button>
   <button className="quiet" disabled={busy} onClick={onSkip}>Not now</button>
  </div>
  {message&&<p className="footnote" role="status">{message}</p>}
  <p className="footnote">Rift Build Lab uses League’s unofficial client interface. Check your items and runes before playing. You can change all of this later in Import settings.</p>
 </section>;
}
