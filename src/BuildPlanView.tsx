import type {ReactNode} from 'react';
import {useId} from 'react';
import {ExternalLink} from 'lucide-react';
import type {Catalog} from './types';
import type {BuildPlan} from './build-plan';
import PurchaseStages,{provenanceLabels} from './PurchaseStages';
import RunePreview from './RunePreview';
import SourceDetails from './SourceDetails';
import {appPath} from './hosting';
import './build-plan.css';
const roleLabels:Record<BuildPlan['role'],string>={top:'Top',jungle:'Jungle',mid:'Mid',adc:'Bot',support:'Support',unspecified:'Any role'};
const orderNotes:Record<BuildPlan['provenance']['order'],string>={
 'source-observed':'Order follows observed provider purchases.',
 'authored':'Order follows the authored build. Adapt it to the match.',
 'inferred':'Order follows when ranked Emerald+ players buy these items (OP.GG and Lolalytics) and the source core, not a fixed buy script.',
 'calculator':'Damage-calculated order for the selected objective only. It is not a practical match order.',
};
function List({title,items,ordered}:{title:string;items:string[];ordered?:boolean}){
 if(!items.length)return null;const Tag=ordered?'ol':'ul';
 return <SourceDetails className="plan-detail" summary={title}>{()=> <Tag>{items.map((line,n)=><li key={n}>{line}</li>)}</Tag>}</SourceDetails>;
}
// Header, then the actions bar, then the order beside the rune page, then the reasoning behind disclosures.
// layout 'timeline' lays stages out as cards above a full-width rune row; hideFinal skips the final grid when the caller shows its own.
export default function BuildPlanView({data,plan,actions,children,lead,hideFinal,layout='columns'}:{data:Catalog;plan:BuildPlan;actions?:ReactNode;children?:ReactNode;lead?:ReactNode;hideFinal?:boolean;layout?:'columns'|'timeline'}){
 const heading=useId(),champion=data.champions.find(c=>c.alias===plan.champion)?.name||plan.champion;
 const final=hideFinal?undefined:plan.stages.find(s=>s.id==='final'),stages=plan.stages.filter(s=>s.id!=='final');
 return <article className={`plan-view is-${layout}`} aria-labelledby={heading}>
  <header className="plan-header">
   <p className="plan-chips"><span className="plan-chip is-category">{plan.category}</span><span className="plan-chip">{champion} · {roleLabels[plan.role]}</span><span className="plan-chip">Patch {plan.patch}</span></p>
   <h3 id={heading}>{plan.name}</h3>
   <p className="plan-goal">{plan.goal}</p>
   {plan.summary!==plan.goal&&<p className="plan-summary">{plan.summary}</p>}
   <p className="plan-meta">{plan.checkedAt&&<>Checked {plan.checkedAt} · </>}Items {provenanceLabels[plan.provenance.items].toLowerCase()} · Runes {provenanceLabels[plan.provenance.runes].toLowerCase()}{plan.sourceURL&&<> · <a href={plan.sourceURL} target="_blank" rel="noreferrer">Source<ExternalLink size={12} aria-hidden="true"/></a></>}</p>
  </header>
  {lead}
  {actions}
  <div className="plan-body">
   <section className="plan-order" aria-label="Purchase order">
    {final&&<div className="plan-final"><div className="plan-section-row"><h4 className="plan-section-title">{final.title}</h4>{final.cumulativeGold!==undefined&&<small className="plan-gold">{final.cumulativeGold.toLocaleString('en-US')}g total</small>}</div>
     <ul className="plan-final-items" aria-label="Final build items">{final.buy.map((id,n)=>{const item=data.items.find(i=>i.id===id);return <li key={`${id}-${n}`} title={item?.name}><img src={item?.iconUrl||appPath('/item-placeholder.svg')} alt="" width={44} height={44} loading="lazy"/><span>{item?.name||`Unknown item ${id}`}</span></li>})}</ul></div>}
    <div className="plan-section-row"><h4 className="plan-section-title">Purchase order</h4><span className="footnote">{orderNotes[plan.provenance.order]}</span></div>
    <PurchaseStages data={data} stages={stages} provenance={plan.provenance.order==='inferred'?undefined:plan.provenance.items}/>
   </section>
   <section className="plan-runes" aria-label="Rune page"><h4 className="plan-section-title">Rune page</h4><RunePreview data={data} runes={plan.runePage} shards={plan.shards}/></section>
  </div>
  <div className="plan-details">
   <List title="Why these items and runes" items={plan.rationale}/>
   <List title="Authored priorities" items={plan.authoredPriorities} ordered/>
   <List title="Tradeoffs" items={plan.tradeoffs}/>
   <List title="Calculator and coverage limits" items={plan.limits}/>
   {children}
  </div>
 </article>;
}
