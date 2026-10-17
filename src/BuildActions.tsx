import {useState} from 'react';
import type {ReactNode} from 'react';
import {ArrowRight,Download,ExternalLink,Pin,Zap} from 'lucide-react';
import type {Catalog} from './types';
import type {BuildPlan,PlanRole} from './build-plan';
import type {PurchaseCheckpoint} from './purchase-checkpoints';
import type {ApplyResult,NativeBuildActions} from './platform/types';
import {createLeagueItemSetFromPlan,createBundleFromPlan,companionURI,downloadLeagueJSON} from './league-export';
import {appPath} from './hosting';
const roleNames:Record<PlanRole,string>={top:'Top',jungle:'Jungle',mid:'Mid',adc:'Bot',support:'Support',unspecified:'Any role'};
const assignable=['top','jungle','mid','adc','support'] as const;
export function outcomeText(result:ApplyResult):string{
 const lead={
  'verified':'Applied and confirmed in League.',
  'applied-unverified':'Sent to League, but the result was not confirmed by read-back. Check League before playing.',
  'rolled-back':'Not applied. Your previous League settings were restored.',
  'partial':'PARTIAL APPLY: some League settings may have changed. Check League before playing.',
  'rejected':'League rejected the change. Nothing was applied.',
 }[result.outcome];
 return `${lead} ${result.message}`.trim();
}
interface Props {
 data:Catalog;plan:BuildPlan|null;
 checkpoints?:PurchaseCheckpoint[];           // override the plan's stages (test bench keeps per-item blocks)
 onTest?:()=>void;testLabel?:string;testState?:ReactNode;
 native?:NativeBuildActions;                  // desktop only; absent on the website
 disabledReason?:string;
}
export default function BuildActions({data,plan,checkpoints,onTest,testLabel='Load into test bench',testState,native,disabledReason}:Props){
 const [message,setMessage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [items,setItems]=useState(true),[runes,setRunes]=useState(true),[defaultRole,setDefaultRole]=useState<typeof assignable[number]>('mid');
 const champion=plan?data.champions.find(c=>c.alias===plan.champion)?.name||plan.champion:'';
 const filename=`rift-build-lab-${(plan?.champion||'build').toLowerCase()}`;
 const run=(action:()=>void)=>{try{action();setError('')}catch(e){setError(e instanceof Error?e.message:'Could not export this build.');setMessage('')}};
 const exportItems=()=>run(()=>{downloadLeagueJSON(createLeagueItemSetFromPlan(data,plan!,checkpoints),`${filename}-items.json`);setMessage('Item set downloaded. Import this file in the League client’s Collection → Items section.')});
 const exportBundle=()=>run(()=>{downloadLeagueJSON(createBundleFromPlan(data,plan!,checkpoints),`${filename}.riftbuild.json`);setMessage('Items + runes file downloaded. Open the Windows companion and choose Load a build file to preview it.')});
 const openCompanion=()=>run(()=>{window.location.href=companionURI(createBundleFromPlan(data,plan!,checkpoints));setMessage('Companion handoff requested. Review the local preview and click Apply there. If nothing opens, install the companion below or use the items + runes file.')});
 const nativeRun=async(action:()=>Promise<string>)=>{setBusy(true);setMessage('');setError('');try{setMessage(await action())}catch(e){setError(e instanceof Error?e.message:'The desktop app could not complete this action.')}finally{setBusy(false)}};
 const apply=()=>void nativeRun(async()=>outcomeText(await native!.apply(createBundleFromPlan(data,plan!,checkpoints),{items,runes})));
 const role=plan&&plan.role!=='unspecified'?plan.role:defaultRole;
 const setDefault=()=>void nativeRun(async()=>{await native!.setDefault({champion:plan!.champion,role},createBundleFromPlan(data,plan!,checkpoints),plan!.id);return `Automatic default saved for ${champion} · ${roleNames[role]}. It applies the next time you lock this champion in that role.`});
 const off=!plan||busy;
 return <section className="build-actions" aria-label="Use this build">
  {plan?<p className="build-actions-target">{champion} · {roleNames[plan.role]} · {native?`${[items&&'items',runes&&'runes'].filter(Boolean).join(' + ')||'nothing selected'}`:'items + runes'}</p>:disabledReason&&<p className="footnote">{disabledReason}</p>}
  {plan?.provenance.order==='calculator'&&<p className="footnote warning">Damage-calculated order for the selected objective. It is not a practical match buy order.</p>}
  {onTest&&<div className="authored-actions">{testState&&<div className="build-state">{testState}</div>}<button className="primary" disabled={!plan} onClick={onTest}>{testLabel}<ArrowRight size={16} aria-hidden="true"/></button></div>}
  {native&&<div className="native-actions">
   <div className="native-targets"><label className="check"><input type="checkbox" checked={items} onChange={e=>setItems(e.target.checked)}/>Include items</label><label className="check"><input type="checkbox" checked={runes} onChange={e=>setRunes(e.target.checked)}/>Include runes</label>{plan?.role==='unspecified'&&<label className="field"><span>Default role</span><select aria-label="Role for the automatic default" value={defaultRole} onChange={e=>setDefaultRole(e.target.value as typeof defaultRole)}>{assignable.map(r=><option key={r} value={r}>{roleNames[r]}</option>)}</select></label>}</div>
   <div className="league-import-actions"><button className="primary" disabled={off||(!items&&!runes)} onClick={apply}><Zap size={16} aria-hidden="true"/>{busy?'Applying…':'Apply now'}</button><button className="secondary" disabled={off} onClick={setDefault}><Pin size={16} aria-hidden="true"/>Set as automatic default</button></div>
  </div>}
  <div className="league-import league-import-actions"><button className="secondary" disabled={!plan} onClick={exportItems}><Download size={16} aria-hidden="true"/>Download League item set</button>{!native&&<button className="secondary" disabled={!plan} onClick={openCompanion}><ExternalLink size={16} aria-hidden="true"/>Open companion</button>}</div>
  <details className="league-import"><summary>League import options</summary>
   <p>For items alone, download the item-set JSON, then open Collection → Items in League and use the import control. Choose the set in the shop for this champion.</p>
   {!native&&<><p>To apply items and runes together on Windows:</p><ol><li><a href={appPath('/downloads/rift-build-lab-companion-windows.zip')} download>Download the Windows companion</a>, extract the ZIP, then run <strong>Install.cmd</strong> once to enable website links for your Windows user.</li><li>Open League of Legends and sign in, then choose <strong>Open companion</strong> above.</li><li>Review the local preview and click <strong>Apply to League Client</strong>. You can select items, runes, or both.</li></ol></>}
   <button className="quiet" disabled={!plan} onClick={exportBundle}><Download size={16} aria-hidden="true"/>Download items + runes file</button>
   {!native&&<p className="footnote">If website links do not open, run RiftBuildLabCompanion.exe and load the items + runes file. No API key is needed. Previous settings are backed up locally; the companion manages one item set per champion and one rune page named Rift Build Lab.</p>}
   <p className="footnote">{native?'The desktop app':'Personal-test Windows companion · live client apply has not yet been verified. It'} uses an unsupported League Client interface. Verify your settings in League before playing. <a href="https://developer.riotgames.com/docs/lol#league-client-api" target="_blank" rel="noreferrer">Riot’s client API guidance</a>.</p>
   <p className="footnote">Items export in the displayed purchase order; choose-one options export as separate blocks. Earned upgrades export their buyable prerequisite. An item-set file alone does not select runes.</p>
  </details>
  {message&&<p role="status" className="footnote">{message}</p>}{error&&<p role="alert" className="warning">{error}</p>}
 </section>;
}
