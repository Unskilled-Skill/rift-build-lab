import {Pin,X} from 'lucide-react';
import type {Catalog,Scenario} from './types';
import {visibleSlotCount} from './workflow';
export function NumberField({label,value,min=0,max=100000,step=1,onChange}:{label:string;value:number;min?:number;max?:number;step?:number;onChange:(v:number)=>void}){
 return <label className="field"><span>{label}</span><input autoComplete="off" type="number" value={value} min={min} max={max} step={step} onChange={e=>{const n=e.target.valueAsNumber;if(Number.isFinite(n))onChange(Math.max(min,Math.min(max,step===1?Math.round(n):n)))}}/></label>;
}
interface Props{data:Catalog;scenario:Scenario;ids:number[];legal:boolean;onAdd:(id:number)=>void;onRemove:(id:number)=>void;update:(key:keyof Scenario,value:unknown)=>void;onPin?:()=>void}
export function BuildItems({data,scenario,ids,legal,onAdd,onRemove,update,onPin}:Props){
 const selected=ids.map(id=>data.items.find(i=>i.id===id)!).filter(Boolean);
 return <section className="build-editor" aria-label="Equipped items"><div className="panel-heading"><h3>Equipped items</h3><span>{selected.reduce((n,i)=>n+i.gold.total,0).toLocaleString()} gold</span></div>
  <div className="slots">{Array.from({length:visibleSlotCount(scenario.slots,ids)},(_,n)=>selected[n]?<button key={selected[n].id} className={`item-slot filled ${n>=scenario.slots?'over-cap':''}`} aria-label={`Remove ${selected[n].name}`} title={`Remove ${selected[n].name}`} onClick={()=>onRemove(selected[n].id)}><img className="item-icon" src={selected[n].iconUrl} width={40} height={40} alt="" loading="lazy"/><span>{selected[n].name}</span><X size={12} aria-hidden="true"/></button>:<div className="item-slot" key={`empty-${n}`}><span>{n+1}</span><small>Empty</small></div>)}</div>
  <label className="field"><span>Add an item</span><select autoComplete="off" value="" onChange={e=>onAdd(Number(e.target.value))}><option value="">Choose an item…</option>{data.items.filter(i=>i.maps['11']&&i.shopListedBySource&&i.name&&!ids.includes(i.id)).sort((a,b)=>a.name.localeCompare(b.name)).map(i=><option key={i.id} value={i.id}>{i.name} · {i.gold.total.toLocaleString()}g · #{i.id}</option>)}</select></label>
  <div className="build-controls"><NumberField label="Gold budget" value={scenario.budget} max={100000} onChange={v=>update('budget',v)}/><NumberField label="Item slots" value={scenario.slots} min={1} max={6} onChange={v=>update('slots',v)}/>{onPin&&<button className="quiet" onClick={onPin}><Pin size={16} aria-hidden="true"/>Pin comparison</button>}</div>
  {!legal&&<p className="warning" role="alert">This setup exceeds its budget or slot limit, or has conflicting items. All equipped items remain visible; remove items or adjust the limits before saving.</p>}
 </section>;
}
export function ManualTestSetup(props:Props){const {scenario,update}=props;return <section className="manual-setup" id="test-setup"><div className="panel-heading"><h2>Check your setup</h2><span>Manual game test</span></div><p className="muted">These conditions are saved with your result. Damage and survival must be measured in game.</p><div className="manual-setup-grid"><div className="fields">
 <NumberField label="Champion level" value={scenario.level} min={1} max={18} onChange={v=>update('level',v)}/><NumberField label="Main ability rank" value={scenario.rank} min={1} max={5} onChange={v=>update('rank',v)}/>
 <NumberField label="Test duration (sec)" value={scenario.duration} min={.25} max={60} step={.25} onChange={v=>update('duration',v)}/><NumberField label="Target maximum HP" value={scenario.targetHP} min={1} max={100000} onChange={v=>update('targetHP',v)}/>
 <NumberField label="Target armor" value={scenario.armor} min={-1000} max={10000} onChange={v=>update('armor',v)}/><NumberField label="Target magic resist" value={scenario.mr} min={-1000} max={10000} onChange={v=>update('mr',v)}/>
 <NumberField label="Available resource" value={scenario.mana} max={100000} onChange={v=>update('mana',v)}/><NumberField label="Heartsteel earned HP" value={scenario.heartsteelHP} max={10000} onChange={v=>update('heartsteelHP',v)}/>
 </div><BuildItems {...props}/></div><p className="footnote">Record other ranks, forms, stacks and external buffs in your observation. “Available resource” is a manual record; it does not simulate energy, fury or recovery.</p></section>}
