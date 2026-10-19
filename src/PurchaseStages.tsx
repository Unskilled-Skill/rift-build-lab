import type {Catalog} from './types';
import type {Provenance,PurchaseStage} from './build-plan';
import {appPath} from './hosting';
export const provenanceLabels:Record<Provenance,string>={'source-observed':'Observed','authored':'Authored','inferred':'Inferred','calculator':'Damage-calculated'};
const counted=(ids:number[])=>[...ids.reduce((m,id)=>m.set(id,(m.get(id)||0)+1),new Map<number,number>())];
function StageItem({data,id,count}:{data:Catalog;id:number;count:number}){
 const item=data.items.find(i=>i.id===id);
 return <li className="plan-item"><img className="item-icon" src={item?.iconUrl||appPath('/item-placeholder.svg')} alt="" width={36} height={36} loading="lazy" onError={e=>{if(e.currentTarget.src.endsWith('item-placeholder.svg'))e.currentTarget.style.visibility='hidden';else e.currentTarget.src=appPath('/item-placeholder.svg')}}/><span>{item?.name||`Unknown item ${id}`}{count>1&&<> ×{count}</>}</span></li>;
}
// Unavailable stages collapse into one muted note; the provenance badge only appears when it differs from the plan's own (stated once above the list).
export default function PurchaseStages({data,stages,provenance}:{data:Catalog;stages:PurchaseStage[];provenance?:Provenance}){
 const missing=stages.filter(s=>!s.available),shown=stages.filter(s=>s.available);
 return <>
  {missing.length>0&&<p className="plan-missing footnote">{missing.map(s=>s.title).join(', ')}: not available for this build. {missing[0].note}</p>}
  <ol className="plan-stages">{shown.map((stage,n)=><li key={stage.id} className="plan-stage">
   <span className="purchase-index" aria-hidden="true">{n+1}</span>
   <div className="plan-stage-body">
    <div className="plan-stage-heading"><h4>{stage.title}</h4>{stage.provenance!==provenance&&<span className={`provenance ${stage.provenance}`}>{provenanceLabels[stage.provenance]}</span>}{stage.cumulativeGold!==undefined&&<small className="plan-gold" title="Completed-item gold so far, excluding starting purchases">{stage.cumulativeGold.toLocaleString('en-US')}g <span>spent</span></small>}</div>
    {stage.buy.length>0&&<ul className="plan-items" aria-label="Buy">{counted(stage.buy).map(([id,count])=><StageItem key={id} data={data} id={id} count={count}/>)}</ul>}
    {stage.chooseOne.length>0&&<div className="plan-choice"><span>Choose one</span><ul className="plan-items" aria-label="Choose one">{stage.chooseOne.map(id=><StageItem key={id} data={data} id={id} count={1}/>)}</ul></div>}
    <p className="footnote">{stage.note}</p>
   </div>
  </li>)}</ol>
 </>;
}
