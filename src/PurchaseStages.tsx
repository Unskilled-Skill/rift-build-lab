import type {Catalog} from './types';
import type {Provenance,PurchaseStage} from './build-plan';
import {appPath} from './hosting';
export const provenanceLabels:Record<Provenance,string>={'source-observed':'Observed','authored':'Authored','inferred':'Inferred','calculator':'Damage-calculated'};
const counted=(ids:number[])=>[...ids.reduce((m,id)=>m.set(id,(m.get(id)||0)+1),new Map<number,number>())];
function StageItem({data,id,count}:{data:Catalog;id:number;count:number}){
 const item=data.items.find(i=>i.id===id);
 return <li className="plan-item"><img className="item-icon" src={item?.iconUrl||appPath('/item-placeholder.svg')} alt="" width={36} height={36} loading="lazy" onError={e=>{if(e.currentTarget.src.endsWith('item-placeholder.svg'))e.currentTarget.style.visibility='hidden';else e.currentTarget.src=appPath('/item-placeholder.svg')}}/><span>{item?.name||`Unknown item ${id}`}{count>1&&<> ×{count}</>}</span></li>;
}
export default function PurchaseStages({data,stages}:{data:Catalog;stages:PurchaseStage[]}){
 return <ol className="plan-stages">{stages.map((stage,n)=><li key={stage.id} className={stage.available?'plan-stage':'plan-stage unavailable'}>
  <span className="purchase-index" aria-hidden="true">{n+1}</span>
  <div className="plan-stage-body">
   <div className="plan-stage-heading"><h4>{stage.title}</h4><span className={`provenance ${stage.provenance}`}>{provenanceLabels[stage.provenance]}</span>{stage.cumulativeGold!==undefined&&<small className="plan-gold" title="Completed-item gold so far, excluding starting purchases">{stage.cumulativeGold.toLocaleString('en-US')}g</small>}</div>
   {!stage.available?<p className="footnote">Not available for this build. {stage.note}</p>:<>
    {stage.buy.length>0&&<ul className="plan-items" aria-label="Buy">{counted(stage.buy).map(([id,count])=><StageItem key={id} data={data} id={id} count={count}/>)}</ul>}
    {stage.chooseOne.length>0&&<div className="plan-choice"><span>Choose one</span><ul className="plan-items" aria-label="Choose one">{stage.chooseOne.map(id=><StageItem key={id} data={data} id={id} count={1}/>)}</ul></div>}
    <p className="footnote">{stage.note}</p>
   </>}
  </div>
 </li>)}</ol>;
}
