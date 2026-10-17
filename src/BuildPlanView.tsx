import type {ReactNode} from 'react';
import {useId} from 'react';
import {ExternalLink} from 'lucide-react';
import type {Catalog} from './types';
import type {BuildPlan} from './build-plan';
import PurchaseStages,{provenanceLabels} from './PurchaseStages';
import RunePreview from './RunePreview';
import './build-plan.css';
const roleLabels:Record<BuildPlan['role'],string>={top:'Top',jungle:'Jungle',mid:'Mid',adc:'Bot',support:'Support',unspecified:'Any role'};
const orderNotes:Record<BuildPlan['provenance']['order'],string>={
 'source-observed':'Order follows observed provider purchases.',
 'authored':'Order follows the authored build. Adapt it to the match.',
 'inferred':'Stages are inferred from the source core and reviewed rules, not an observed buy script.',
 'calculator':'Damage-calculated order for the selected objective only. It is not a practical match order.',
};
function List({title,items,ordered}:{title:string;items:string[];ordered?:boolean}){
 if(!items.length)return null;const Tag=ordered?'ol':'ul';
 return <details className="plan-detail"><summary>{title}</summary><Tag>{items.map((line,n)=><li key={n}>{line}</li>)}</Tag></details>;
}
export default function BuildPlanView({data,plan,actions}:{data:Catalog;plan:BuildPlan;actions?:ReactNode}){
 const heading=useId(),champion=data.champions.find(c=>c.alias===plan.champion)?.name||plan.champion;
 return <article className="plan-view" aria-labelledby={heading}>
  <header className="plan-header">
   <p className="eyebrow">{champion} · {roleLabels[plan.role]} · {plan.category}</p>
   <h3 id={heading}>{plan.name}</h3>
   <p className="plan-meta">Patch {plan.patch}{plan.checkedAt&&<> · Checked {plan.checkedAt}</>} · Items {provenanceLabels[plan.provenance.items].toLowerCase()} · Runes {provenanceLabels[plan.provenance.runes].toLowerCase()}{plan.sourceURL&&<> · <a href={plan.sourceURL} target="_blank" rel="noreferrer">Source<ExternalLink size={12} aria-hidden="true"/></a></>}</p>
   <p className="plan-goal">{plan.goal}</p>
   {plan.summary!==plan.goal&&<p className="plan-summary">{plan.summary}</p>}
  </header>
  <section aria-label="Purchase order"><h4 className="plan-section-title">Purchase order</h4><p className="footnote">{orderNotes[plan.provenance.order]}</p><PurchaseStages data={data} stages={plan.stages}/></section>
  <section aria-label="Rune page"><h4 className="plan-section-title">Rune page</h4><RunePreview data={data} runes={plan.runePage} shards={plan.shards}/></section>
  {actions}
  <List title="Why these items and runes" items={plan.rationale}/>
  <List title="Authored priorities" items={plan.authoredPriorities} ordered/>
  <List title="Tradeoffs" items={plan.tradeoffs}/>
  <List title="Calculator and coverage limits" items={plan.limits}/>
 </article>;
}
