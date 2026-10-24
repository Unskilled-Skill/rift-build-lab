import {useEffect,useState} from 'react';
import {ArrowRight,RotateCcw} from 'lucide-react';
import type {Catalog} from './types';
import type {BuildPlan} from './build-plan';
import type {MetaPlan} from './meta-recommendations';
import {adaptPlanToComp} from './build-matchup';
import type {MatchupAdvice} from './build-matchup';
import {emptyCompDraft,parseCompDraft} from './team-composition';
import type {CompDraft} from './team-composition';
import TeamPicker from './TeamPicker';
// Shares the Meta tab's saved composition draft, so a team entered in either place appears in both.
const key=(champion:string)=>`rift-meta-comp-${champion}`;
function readDraft(champion:string):CompDraft{try{const raw=localStorage.getItem(key(champion));return raw?parseCompDraft(raw):emptyCompDraft()}catch{return emptyCompDraft()}}
export default function MatchupAdapter({data,plan,plans,protectedIds,advice,onAdvice}:{data:Catalog;plan:BuildPlan;plans:MetaPlan[];protectedIds:number[];advice:MatchupAdvice|null;onAdvice:(advice:MatchupAdvice|null)=>void}){
 const [draft,setDraft]=useState<CompDraft>(()=>readDraft(plan.champion)),[error,setError]=useState('');
 useEffect(()=>{setDraft(readDraft(plan.champion));setError('')},[plan.champion]);
 const enemies=(draft.enemySlots||Array(5).fill('')) as string[];
 const save=(next:CompDraft)=>{setDraft(next);onAdvice(null);setError('');try{localStorage.setItem(key(plan.champion),JSON.stringify(next))}catch{/* Advice works without storage. */}};
 const item=(id:number)=>data.items.find(i=>i.id===id)?.name||String(id),name=(alias:string)=>data.champions.find(c=>c.alias===alias)?.name||alias;
 const adapt=()=>{
  const picked=enemies.filter(Boolean);
  if(!picked.length){setError('Choose at least one enemy champion.');return}
  try{onAdvice(adaptPlanToComp(data,plan,plans,{allies:[],enemies:picked,...(draft.priority?{priority:draft.priority}:{}),...(draft.enemyArmor?{enemyArmor:true}:{}),...(draft.enemyMR?{enemyMR:true}:{}),...(draft.enemyHealing?{enemyHealing:true}:{}),...(draft.enemyShields?{enemyShields:true}:{})},protectedIds));setError('')}
  catch(e){setError(e instanceof Error?e.message:'Advice is unavailable for this build.');onAdvice(null)}
 };
 return <details className="matchup" open={!!advice||undefined}><summary>Adapt to the enemy team{advice&&<span className="matchup-state">{advice.changes.length?`${advice.changes.length} ${advice.changes.length===1?'swap':'swaps'} applied`:'No swap needed'}</span>}</summary>
  <div className="matchup-body">
   <TeamPicker data={data} side="Enemy" slots={enemies} unavailable={[plan.champion,...enemies.filter(Boolean)]} onChange={slots=>save({...draft,enemySlots:slots,enemiesText:slots.filter(Boolean).map(name).join(', ')})}/>
   <div className="matchup-options">
    <label className="field"><span>Build priority</span><select value={draft.priority||'balanced'} onChange={e=>save({...draft,priority:e.target.value as CompDraft['priority']})}><option value="balanced">Balanced</option><option value="damage">Damage first</option><option value="survival">Survive first</option></select></label>
    {([['enemyArmor','They bought a lot of armor'],['enemyMR','They bought a lot of magic resist'],['enemyHealing','Their healing is a problem'],['enemyShields','Their shields are a problem']] as const).map(([k,label])=><label className="check" key={k}><input type="checkbox" checked={draft[k]} onChange={e=>save({...draft,[k]:e.target.checked})}/>{label}</label>)}
   </div>
   <div className="matchup-actions"><button className="secondary" onClick={adapt}>Adapt this build<ArrowRight size={16} aria-hidden="true"/></button>{advice&&<button className="quiet" onClick={()=>onAdvice(null)}><RotateCcw size={14} aria-hidden="true"/>Show without adaptation</button>}</div>
   {error&&<p className="warning" role="alert">{error}</p>}
   {advice&&<div className="matchup-advice" role="status">
    {advice.changes.length?<ul>{advice.changes.map(c=><li key={c.added}><strong>{item(c.removed)} → {item(c.added)}</strong><p>{c.reason}</p></li>)}</ul>:<p>Keep this build: none of its flexible slots has a better answer for this team.</p>}
    {advice.priorities.length>0&&<details><summary>Teamfight priorities</summary><ul>{advice.priorities.map((p,n)=><li key={n}><strong>{p.title}</strong><p>{p.reason}</p></li>)}</ul></details>}
    <p className="footnote">{advice.warnings[0]} The build above, apply and export now use the adapted items; your first core item stays.</p>
   </div>}
  </div>
 </details>;
}
