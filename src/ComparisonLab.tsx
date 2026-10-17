import {useMemo,useState} from 'react';
import {ArrowDown,ArrowUp,ArrowRight,Pin} from 'lucide-react';
import {comparisonScenario,comparisonReady} from './workspace-draft';
import type {Baseline} from './workspace-draft';
import {compareAtTarget,defenseSweep,progressionRows} from './comparison-lab';
import type {DefenseAxis,TargetComparison} from './comparison-lab';
import {NumberField} from './TestSetup';
import {championResource} from './resources';
import {abilityModel} from './ability-models';
import type {Catalog,Champion,Item,Scenario} from './types';
const n=(value:number)=>value.toLocaleString(undefined,{maximumFractionDigits:1});
const signed=(value:number)=>`${value>0?'+':''}${n(value)}`;
const axes:Record<DefenseAxis,string>={mr:'Magic resist',armor:'Armor',targetHP:'Maximum HP'};
interface Props {data:Catalog;champion:Champion;scenario:Scenario;ids:number[];baseline:Baseline|null;supported:boolean;onPin:()=>void;onClear:()=>void;onLoad:()=>void;onOrder:(ids:number[],baseline:boolean)=>void;onTarget:(axis:DefenseAxis,value:number)=>void}
export default function ComparisonLab({data,champion,scenario,ids,baseline,supported,onPin,onClear,onLoad,onOrder,onTarget}:Props){
 const [view,setView]=useState('compare'),[axis,setAxis]=useState<DefenseAxis>('mr'),[min,setMin]=useState(0),[max,setMax]=useState(300),[earned,setEarned]=useState(false);
 const items=(values:number[])=>values.map(id=>data.items.find(i=>i.id===id)!);
 const experiment=items(ids),reference=items(baseline?.ids||[]),baseScenario=baseline?comparisonScenario(scenario,baseline):scenario;
 const analysis=useMemo(()=>{
  if(!baseline||!supported)return null;
  let pair:TargetComparison|null=null;
  try{
   pair=compareAtTarget(champion,experiment,reference,scenario,baseScenario);
   const budgets=[...new Set([3000,6000,9000,12000,15000,scenario.budget].filter(v=>v<=scenario.budget))];
   return {pair,progress:view==='progression'?progressionRows(champion,experiment,reference,scenario,baseScenario,budgets,earned,data.items):[],sweep:view==='defenses'?defenseSweep(champion,experiment,reference,scenario,baseScenario,axis,min,max):[],error:''};
  }catch(e){return {error:e instanceof Error?e.message:'Comparison could not be calculated.',pair,progress:[],sweep:[]};}
 },[champion,scenario,ids,baseline,supported,view,axis,min,max,earned,data]);
 const ready=!!baseline&&comparisonReady(scenario,ids,baseline,data);
 const resourceKind=championResource(champion.alias).kind;
 const chooseAxis=(value:DefenseAxis)=>{setAxis(value);setMin(value==='targetHP'?1000:0);setMax(value==='targetHP'?5000:300)};
 return <section className="comparison-lab" id="comparison-lab" tabIndex={-1} aria-label="Build comparison lab">
  <header className="lab-heading"><div><h2>Put the builds side by side.</h2><p>One objective, shared conditions. Find where the experiment earns its place.</p></div><button className="secondary" onClick={onPin} disabled={!ids.length}><Pin size={16} aria-hidden="true"/>{baseline?'Replace baseline':'Pin current build'}</button></header>
  {!baseline?<div className="lab-empty"><h3>Start with a reference build.</h3><p>Load a meta plan or another build, pin it here, then load an experiment for the same champion. The pinned items and rune page stay available while you test alternatives.</p></div>:<>
   <div className="lab-baseline"><div><strong>{baseline.source?`${baseline.source.provider} observed core`:'Pinned baseline'}</strong><p>{baseline.names.join(' · ')||'No items'}</p>{baseline.source&&<small>{baseline.source.role.toUpperCase()} · patch {baseline.source.patch} · checked {baseline.source.checkedAt} · {n(baseline.source.matches)} core matches. This is an observed core, not full-build statistics.</small>}</div><div className="lab-baseline-actions"><button className="quiet" onClick={onLoad}>Load baseline</button><button className="quiet" onClick={onClear}>Clear baseline</button></div></div>
   {!supported?<p className="lab-empty">This objective needs manual testing. Choose a supported partial objective above to use numerical comparisons, or record baseline and experiment measurements in the game-test form.</p>:<>
    <nav className="lab-views" aria-label="Comparison views">{[['compare','Head to head'],['progression','Purchase progression'],['defenses','Enemy defenses']].map(([value,label])=><button key={value} aria-pressed={view===value} className={view===value?'selected':''} onClick={()=>setView(value)}>{label}</button>)}</nav>
    <p className="lab-context">Level {scenario.level} · {scenario.duration}s window · {n(scenario.budget)}g cap · {scenario.mr} MR / {scenario.armor} armor / {n(scenario.targetHP)} HP{abilityModel(champion.alias,scenario.mode)?.targetHealth?` · ${n(scenario.targetHealthPercent??100)}% starting HP`:''}{abilityModel(champion.alias,scenario.mode)?.stackInput?` · ${n(scenario.abilityStacks??0)} earned Q stacks`:''}. Each build keeps its rune page; rune procs are only partially modeled.</p>
    {analysis?.error&&<p role="alert" className="warning">{analysis.error}</p>}{analysis?.pair&&<>
     {view==='compare'&&<>
      <div className="lab-totals"><div><span>Experiment</span><strong>{n(analysis.pair.experiment.damage)}</strong><small>{n(analysis.pair.experiment.cost)}g · {ids.length} items</small></div><div><span>Baseline</span><strong>{n(analysis.pair.baseline.damage)}</strong><small>{n(analysis.pair.baseline.cost)}g · {baseline.ids.length} items</small></div><div><span>{ready?'Modeled difference':'Reference difference'}</span><strong>{signed(analysis.pair.delta)}</strong><small>{analysis.pair.percent===null?'Zero baseline; no percentage':`${signed(analysis.pair.percent)}%`}</small></div></div>
      <p className={ready?'footnote':'warning'}>{ready?'Both inventories fit the shared budget, slots and item count.':'Item counts, budget/slot limits or rune-page validity differ. Treat this as a reference comparison.'} {analysis.pair.spendingGap===0?'Actual item spending matches.':`Experiment spending is ${signed(analysis.pair.spendingGap)}g versus the baseline; this is not equal spending.`}</p>
      <div className="table-scroll lab-table" role="region" aria-label="Build stat comparison" tabIndex={0}><table><thead><tr><th>Included stat</th><th>Experiment</th><th>Baseline</th></tr></thead><tbody>{([['AP','ap'],['Bonus AD','bonusAD'],['Maximum HP','hp'],['Ability haste','haste']] as const).map(([label,key])=><tr key={key}><th scope="row">{label}</th><td>{n(analysis.pair!.experiment.stats[key])}</td><td>{n(analysis.pair!.baseline.stats[key])}</td></tr>)}{resourceKind!=='none'&&<><tr><th scope="row">{resourceKind==='energy'?'Maximum energy':'Maximum mana'}</th><td>{n(analysis.pair.experiment.resource?.maximum??analysis.pair.experiment.stats.mana)}</td><td>{n(analysis.pair.baseline.resource?.maximum??analysis.pair.baseline.stats.mana)}</td></tr><tr><th scope="row">{resourceKind==='energy'?'Energy used':'Mana used'}</th><td>{n(analysis.pair.experiment.resource?.spent??analysis.pair.experiment.manaSpent)}</td><td>{n(analysis.pair.baseline.resource?.spent??analysis.pair.baseline.manaSpent)}</td></tr></>}</tbody></table></div>
     </>}
     {view==='progression'&&<>
      <h3>Compare the route to full build.</h3><p className="lab-explanation">Each row has the same gold cap, slot limit, level and ability ranks for both routes. Buy the next item in order only when affordable; remaining gold buys no components. This tests item spikes, not lane strength or match time.</p>
      <details className="lab-order"><summary>Edit assumed purchase order</summary><p className="footnote">Final inventory order is not a verified purchase recommendation. Move boots and core items to match the route you want to test. Order is saved with your working setup and baseline.</p><div className="lab-orders"><PurchaseOrder title="Experiment order" items={experiment} onChange={values=>onOrder(values,false)}/><PurchaseOrder title="Baseline order" items={reference} onChange={values=>onOrder(values,true)}/></div></details>
      <label className="lab-check"><input type="checkbox" checked={earned} onChange={e=>setEarned(e.target.checked)}/>Use supplied transformations and earned stacks at every checkpoint</label>
      <p className="footnote">{earned?'Uses your finite Rod, Heartsteel and Gathering Storm inputs at all budgets. This does not predict when those values can be earned.':'Unstacked purchase view: transformed items use their purchasable prerequisites; Rod stacks, earned Heartsteel HP and Gathering Storm time are zero. Other supplied combat conditions remain shared.'}</p>
      <div className="table-scroll lab-table" role="region" aria-label="Purchase progression comparison" tabIndex={0}><table><thead><tr><th>Gold cap</th><th>Experiment</th><th>Baseline</th><th>Damage difference</th></tr></thead><tbody>{analysis.progress.map(row=><tr key={row.budget}><th scope="row">{n(row.budget)}g</th><td><strong>{n(row.experiment.damage)} damage</strong><small>{row.experimentIds.length} items · {n(row.experiment.cost)}g spent · {n(row.experimentUnspent)}g left</small><small>{row.experimentIds.map(id=>data.items.find(i=>i.id===id)?.name).join(' · ')||'No completed purchases yet'}</small></td><td><strong>{n(row.baseline.damage)} damage</strong><small>{row.baselineIds.length} items · {n(row.baseline.cost)}g spent · {n(row.baselineUnspent)}g left</small><small>{row.baselineIds.map(id=>data.items.find(i=>i.id===id)?.name).join(' · ')||'No completed purchases yet'}</small></td><td>{signed(row.delta)}</td></tr>)}</tbody></table></div>
     </>}
     {view==='defenses'&&<>
      <h3>Where does the damage change?</h3><p className="lab-explanation">Vary one target stat; keep the other defenses, casts, items and rune pages fixed. These are sampled estimates, not exact breakpoints or kill predictions.</p>
      <div className="lab-range"><label className="field"><span>Target stat to sweep</span><select value={axis} onChange={e=>chooseAxis(e.target.value as DefenseAxis)}>{Object.entries(axes).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><NumberField label="Sweep from" value={min} min={axis==='targetHP'?1:-1000} max={axis==='targetHP'?100000:10000} onChange={setMin}/><NumberField label="Sweep to" value={max} min={axis==='targetHP'?1:-1000} max={axis==='targetHP'?100000:10000} onChange={setMax}/></div>
      {!!analysis.sweep.length&&<><DamageChart rows={analysis.sweep} label={axes[axis]}/>
      <p className="footnote">{analysis.sweep.every(r=>Math.abs(r.delta)<.0001)?'The two estimates match throughout this range.':`Experiment leads at ${analysis.sweep.filter(r=>r.delta>.0001).length} of ${analysis.sweep.length} sampled targets; ties and losses are shown below.`} Flat curves can be correct for true damage or abilities without target-HP scaling.</p>
      <div className="table-scroll lab-table" role="region" aria-label="Enemy defense sweep values" tabIndex={0}><table><thead><tr><th>{axes[axis]}</th><th>Experiment</th><th>Baseline</th><th>Difference</th><th>Test target</th></tr></thead><tbody>{analysis.sweep.map((row,i)=><tr key={i}><th scope="row">{n(row.value)}</th><td>{n(row.experiment.damage)}</td><td>{n(row.baseline.damage)}</td><td>{signed(row.delta)}</td><td><button className="quiet" aria-label={`Use ${n(row.value)} ${axes[axis]}`} onClick={()=>onTarget(axis,row.value)}>Use target<ArrowRight size={14} aria-hidden="true"/></button></td></tr>)}</tbody></table></div></>}
     </>}
     <details className="lab-coverage"><summary>What these comparisons omit</summary><p>Partial single-ability models only. Damage differences do not measure healing, shields, movement, safety, access or win rate. Equal gold caps do not guarantee equal spending. The baseline shares cast-time conditions and uses its own runes; actual stack generation and most item/rune procs are unmodeled.</p><ul>{[...new Set([...analysis.pair.experiment.limitations,...analysis.pair.baseline.limitations])].map(note=><li key={note}>{note}</li>)}</ul></details>
    </>}
   </>}
  </>}
 </section>;
}
function PurchaseOrder({title,items,onChange}:{title:string;items:Item[];onChange:(ids:number[])=>void}){
 const move=(index:number,direction:number)=>{const values=items.map(i=>i.id);[values[index],values[index+direction]]=[values[index+direction],values[index]];onChange(values)};
 return <div><h4>{title}</h4><ol>{items.map((item,index)=><li key={item.id}><span>{item.name}<small>{n(item.gold.total)}g</small></span><button className="icon-button" disabled={index===0} aria-label={`Move ${item.name} earlier in ${title.toLowerCase()}`} onClick={()=>move(index,-1)}><ArrowUp size={15} aria-hidden="true"/></button><button className="icon-button" disabled={index===items.length-1} aria-label={`Move ${item.name} later in ${title.toLowerCase()}`} onClick={()=>move(index,1)}><ArrowDown size={15} aria-hidden="true"/></button></li>)}</ol>{!items.length&&<p>No items equipped.</p>}</div>;
}
function DamageChart({rows,label}:{rows:({value:number}&TargetComparison)[];label:string}){
 const top=Math.max(1,...rows.flatMap(r=>[r.experiment.damage,r.baseline.damage]));
 const points=(side:'experiment'|'baseline')=>rows.map((row,index)=>`${50+index*560/Math.max(1,rows.length-1)},${210-row[side].damage/top*180}`).join(' ');
 return <figure className="lab-chart"><svg viewBox="0 0 650 260" role="img" aria-label={`Modeled damage across ${label}. Experiment is solid green; baseline is dashed. Exact values are in the following table.`}><line x1="50" y1="210" x2="610" y2="210" className="chart-axis"/><line x1="50" y1="30" x2="50" y2="210" className="chart-axis"/><text x="42" y="34" textAnchor="end">{n(top)}</text><text x="42" y="214" textAnchor="end">0</text><polyline points={points('baseline')} className="chart-baseline"/><polyline points={points('experiment')} className="chart-experiment"/><text x="50" y="240">{n(rows[0]?.value||0)}</text><text x="610" y="240" textAnchor="end">{n(rows.at(-1)?.value||0)}</text><text x="330" y="252" textAnchor="middle">{label}</text></svg><figcaption><span className="chart-key experiment-key">Experiment</span><span className="chart-key baseline-key">Baseline</span><span>Damage after defenses</span></figcaption></figure>;
}
