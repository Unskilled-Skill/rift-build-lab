import type {AbilityModel} from './ability-models';
import type {Scenario} from './types';
import {NumberField} from './TestSetup';
import {championResource} from './resources';
export default function AbilityInputs({model,scenario:s,update}:{model:AbilityModel;scenario:Scenario;update:(key:keyof Scenario,value:unknown)=>void}){
 const resource=championResource(s.champion);
 return <>
  <NumberField label="Champion level" value={s.level} min={1} max={18} onChange={v=>update('level',v)}/>
  <NumberField label={`${model.slot} rank`} value={Math.min(model.rankCap,s.rank)} min={1} max={model.rankCap} onChange={v=>update('rank',v)}/>
  <NumberField label="Observation window (sec)" value={s.duration} min={.25} max={60} step={.25} onChange={v=>update('duration',v)}/>
  {resource.kind==='mana'&&<NumberField label="Mana available (capped at max)" value={s.mana} max={100000} onChange={v=>update('mana',v)}/>}
  {resource.kind==='energy'&&<NumberField label={`Energy available (base cap ${resource.baseMaximum})`} value={Math.min(resource.baseMaximum,s.mana)} max={resource.baseMaximum} onChange={v=>update('mana',v)}/>}
  <NumberField label="Enemy magic resist" value={s.mr} min={-1000} max={10000} onChange={v=>update('mr',v)}/>
  <NumberField label="Enemy armor" value={s.armor} min={-1000} max={10000} onChange={v=>update('armor',v)}/>
  <NumberField label="Target maximum HP" value={s.targetHP} min={1} max={100000} onChange={v=>update('targetHP',v)}/>
  {model.targetHealth&&<NumberField label="Target starting HP (%)" value={s.targetHealthPercent??100} min={0} max={100} onChange={v=>update('targetHealthPercent',v)}/>}
  {s.champion==='Ziggs'&&model.slot==='R'&&<label className="check"><input type="checkbox" checked={s.center} onChange={e=>update('center',e.target.checked)}/>Mega Inferno Bomb center hit (unchecked: 65% edge damage)</label>}
 </>;
}
