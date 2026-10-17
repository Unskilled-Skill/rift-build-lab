import type {Catalog} from './types';
import type {FullMetaBuild} from './meta-recommendations';
import {metaStages} from './build-plan';
import PurchaseStages from './PurchaseStages';
import './build-plan.css';
export default function PurchaseGuide({data,build}:{data:Catalog;build:FullMetaBuild}){return <section className="purchase-guide" aria-label="Purchase checkpoints"><p className="footnote">These are inferred checkpoints around a source core, not observed starting items or a fixed buy script.</p><PurchaseStages data={data} stages={metaStages(data,build).filter(s=>s.id!=='final')}/></section>}
