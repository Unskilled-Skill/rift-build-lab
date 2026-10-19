import type {Item,Scenario} from './types';
import type {CombatEffects} from './combat-effects';
import {NumberField} from './TestSetup';

export default function CombatPreparation({scenario:s,items,update}:{scenario:Scenario;items:Item[];update:(key:keyof Scenario,value:unknown)=>void}){
 const e=s.effects??{},has=(id:number)=>items.some(i=>i.id===id),rune=(id:number)=>s.runePage.includes(id);
 const set=(key:keyof CombatEffects,value:unknown)=>{const next={...e,[key]:value};if(value===undefined)delete next[key];update('effects',next)};
 const number=(key:keyof CombatEffects,label:string,max:number)=><NumberField key={key} label={label} value={Number(e[key]??0)} max={max} onChange={v=>set(key,v)}/>;
 const check=(key:keyof CombatEffects,label:string)=><label className="check" key={key}><input type="checkbox" checked={e[key]===true} onChange={event=>set(key,event.target.checked)}/>{label}</label>;
 return <details className="advanced combat-preparation"><summary>Rune &amp; item interactions</summary>
  <p className="footnote">Enter preparation you can actually earn. The calculator separates native damage from proc damage. Unlisted mechanics and attack timing remain partial; check the result’s coverage notes.</p>
  {(rune(8005)||rune(8112))&&<p className="footnote">Prior-hit counters are anchored at trial time zero on this target. Their setup damage is excluded. A multi-hit action counts once for Electrocute, while eligible deliveries can count separately for PTA.</p>}
  <div className="fields">
   <NumberField label="Owner health (%)" value={s.healthPercent} min={1} max={100} step={.1} onChange={v=>update('healthPercent',v)}/>
   <NumberField label="Target health before first hit (%)" value={s.targetHealthPercent??100} max={100} step={.1} onChange={v=>update('targetHealthPercent',v)}/>
   {rune(9103)&&number('bloodlineStacks','Earned Bloodline stacks',15)}
   {rune(9104)&&number('alacrityStacks','Earned Alacrity stacks',10)}
   {rune(9105)&&number('legendHasteStacks','Earned Legend Haste stacks',10)}
   {rune(8226)&&number('manaflowStacks','Earned Manaflow procs',10)}
   {rune(8345)&&number('biscuits','Biscuits consumed or sold',3)}
   {rune(8451)&&number('overgrowthUnits','Observed nearby Overgrowth deaths',100000)}
   {rune(8437)&&number('graspStacks','Previously earned Grasp procs',100000)}
   {rune(8316)&&number('jackStacks','Observed Jack purchased-stat types',10)}
   {rune(8008)&&number('lethalTempoStacks','Lethal Tempo stacks before hit',6)}
   {rune(8005)&&number('ptaHitsBefore','PTA hits already on this target',2)}
   {rune(8112)&&number('electrocuteHitsBefore','Distinct Electrocute actions already landed',2)}
   {has(3124)&&number('ragebladeStacks','Rageblade stacks before hit',4)}
   {rune(8128)&&number('darkHarvestStacks','Earned Dark Harvest souls',1000)}
   {has(6697)&&number('hubrisKills','Earned Hubris qualifying kills',1000)}
   {has(3161)&&number('shojinStacks','Shojin stacks before hit',4)}
   {has(3071)&&number('cleaverStacks','Cleaver stacks already on target',5)}
   {has(6655)&&number('ludenCharges','Ready Luden Echoes',6)}
   {has(3036)&&number('targetBonusHP','Target bonus HP (not total HP)',100000)}
   {has(3302)&&number('terminusLightStacks','Terminus Light stacks before hit',3)}
   {has(3302)&&number('terminusDarkStacks','Terminus Dark stacks before hit',3)}
   {rune(8229)&&number('cometDistance','Comet distance (game units)',750)}
   {s.champion==='Hecarim'&&number('movementSpeed','Observed movement speed after soft caps',3000)}
   {(rune(8437)||rune(8008)||rune(9923)||items.some(i=>[3153,3748,3042,3161].includes(i.id)))&&<label className="field"><span>Attack form (also used for recorded Grasp procs)</span><select value={e.attackForm??''} onChange={event=>set('attackForm',event.target.value||undefined)}><option value="">Use source attack range</option><option value="melee">Melee</option><option value="ranged">Ranged</option></select></label>}
   {rune(8224)&&<label className="field"><span>Axiom packet classification</span><select value={e.axiomMode??'auto'} onChange={event=>set('axiomMode',event.target.value)}><option value="auto">Use known source classification</option><option value="off">No Axiom amplification</option><option value="single">Confirmed single-target ultimate</option><option value="area">Confirmed area ultimate</option></select></label>}
  </div>
  <div className="fields">
   {check('runeProcsReady','Rune damage procs are ready')}
   {check('itemProcsReady','Item damage procs are ready')}
   {check('stopAtDeath','Stop scoring after target death')}
   {rune(8229)&&<label className="check"><input type="checkbox" checked={e.cometHit!==false} onChange={event=>set('cometHit',event.target.checked)}/>Comet lands on the target</label>}
   {rune(8369)&&<label className="check"><input type="checkbox" checked={s.firstStrikeReady===true} onChange={event=>update('firstStrikeReady',event.target.checked)}/>First Strike opening condition is met</label>}
   {items.some(i=>[3078,3508,3100].includes(i.id))&&<label className="check"><input type="checkbox" checked={s.spellbladeReady===true} onChange={event=>update('spellbladeReady',event.target.checked)}/>Spellblade is armed before this delivery</label>}
   {rune(8429)&&check('conditioningActive','Conditioning has activated (12+ minutes)')}
   {rune(8439)&&check('aftershockActive','Aftershock was triggered before the scored hit')}
   {rune(8242)&&check('unflinchingActive','Unflinching incoming-CC window is active')}
   {rune(9923)&&check('hailOfBladesActive','Hail of Blades attack-speed window is active')}
   {rune(8005)&&check('ptaActive','PTA amplification was activated before the hit')}
   {rune(8437)&&check('graspReady','Grasp is charged before this delivery')}
   {rune(8126)&&check('targetImpaired','Target is movement-impaired at scored impacts')}
   {rune(8143)&&check('suddenImpactArmed','Sudden Impact was armed at trial time zero')}
   {rune(8232)&&check('inRiver','Owner is in the river for Waterwalking')}
   {has(6697)&&check('hubrisActive','Earned Hubris temporary AD buff is active')}
   {has(6665)&&check('jakshoActive','Jak’Sho was activated before this cast')}
   {has(8020)&&check('abyssalInRange','Target is inside Abyssal Mask’s aura')}
   {has(3084)&&check('heartsteelReady','Heartsteel proximity charge is ready on this target')}
  </div>
  <button className="quiet" onClick={()=>update('effects',{})}>Clear preparation</button>
 </details>;
}
