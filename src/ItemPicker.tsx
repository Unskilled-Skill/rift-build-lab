import {useId,useMemo,useState} from 'react';
import {Search,Plus} from 'lucide-react';
import type {Item,Scenario} from './types';
import {itemBlockReason,pickerItems} from './item-selection';
import {objectiveSupport} from './model-support';

const effectCoverage:Record<number,string>={
 3089:'AP multiplier modeled',3083:'Bonus item health modeled; healing omitted',
 3084:'Earned HP and one explicitly ready attack proc; no automatic growth',6657:'Entered stacks modeled',
 3161:'Basic haste and prepared ability amplification; no automatic stacks',
 2501:'HP conversion and entered AD bonus; missing-health curve unresolved',4633:'HP conversion and timed amplification; healing omitted',
 3042:'Mana-to-AD and Shock on eligible modeled casts; proc ordering approximate',3040:'Bonus-mana-to-AP conversion; shielding omitted',
 3115:'On-hit damage on modeled full deliveries',3100:'One explicitly armed Spellblade delivery',3078:'One explicitly armed Spellblade delivery',3508:'One explicitly armed Spellblade delivery',
 6655:'Explicit ready Echoes on isolated target',6653:'Timed amplification and ready spell burn',
 4645:'Live low-health magic/true amplification',3071:'Prepared armor shred; no automatic stacks',8020:'Explicit in-range magic vulnerability',
 3036:'Giant Slayer from entered target bonus HP',3053:'Base-AD conversion; shield omitted',6697:'Earned kills with explicitly active AD buff',6665:'Prepared bonus resistances; shield omitted',
 3094:'One ready Energized actual attack',3748:'Primary on-hit; active and splash omitted',3302:'Full on-hit and prepared Light/Dark states',
 3153:'Current-HP on-hit term; exact client ordering and floor unverified',3091:'45 magic damage on eligible on-hit deliveries',3124:'30 magic on-hit and prepared AS stacks; Phantom Hit omitted',
};
export function ItemPicker({items,selected,scenario,onAdd}:{items:Item[];selected:Item[];scenario:Scenario;onAdd:(id:number)=>void}){
 const [query,setQuery]=useState(''),[category,setCategory]=useState<'completed'|'components'|'all'>('completed');
 const searchId=useId(),helpId=useId();
 const results=useMemo(()=>pickerItems(items,category,query),[items,category,query]);
 const modeled=objectiveSupport(scenario.champion,scenario.mode).supported;
 return <div className="item-picker">
  <label htmlFor={searchId} className="item-picker-label">Add an item</label>
  <div className="item-picker-tools"><div className="item-picker-search"><Search size={16} aria-hidden="true"/><input id={searchId} type="search" autoComplete="off" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search names, stats or effects" aria-describedby={helpId}/></div>
   <select aria-label="Item category" value={category} onChange={e=>setCategory(e.target.value as typeof category)}><option value="completed">Completed items</option><option value="components">Components & other purchases</option><option value="all">All eligible source items</option></select>
  </div>
  <p id={helpId} className="item-picker-source">Source SR shop flags, with 32/66 mode variants excluded. Remaining entries may include upgrades or retained items; confirm availability in game. Earned transformations are labeled.</p>
  <p className="item-picker-count" role="status">{results.length} matching {results.length===1?'item':'items'}</p>
  <ul className="item-picker-results" aria-label="Matching items">{results.map(item=>{
   const reason=itemBlockReason(item,selected,scenario),coverage=modeled?([3078,3508].includes(item.id)&&scenario.champion==='Blitzcrank'?'Ready Spellblade modeled separately; current proc rules need a game check':effectCoverage[item.id]):undefined;
   return <li key={item.id}><button type="button" disabled={Boolean(reason)} onClick={()=>onAdd(item.id)} aria-label={`Add ${item.name}${reason?`: ${reason}`:''}`} title={reason||`Add ${item.name}`}>
    <img src={item.iconUrl} className="item-icon" width={32} height={32} alt="" loading="lazy"/>
    <span className="item-picker-info"><strong>{item.name}</strong><small>{item.gold.total.toLocaleString()}g · #{item.id}{[3040,3042,3121,2530].includes(item.id)?' · Earned transformation':''}</small><span className="item-picker-support">{modeled?(coverage?`Selected effects modeled · ${coverage}`:'Stats only · passive and active effects omitted'):'Manual test · stats and effects require in-game measurement'}</span>{reason&&<span className="item-picker-reason">{reason}</span>}</span>
    {!reason&&<Plus size={16} aria-hidden="true"/>}
   </button></li>;
  })}</ul>
  {!results.length&&<p className="item-picker-empty">No matching items. Try a shorter search or choose all eligible source items.</p>}
 </div>;
}
