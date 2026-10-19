import {it,expect} from 'vitest';
import fs from 'node:fs';
import {hashCeilingReviewValue,validateCeilingReviewLedger} from '../scripts/ceiling-review-ledger.mjs';

const read=(path:string)=>JSON.parse(fs.readFileSync(path,'utf8'));
const catalog=read('public/data/catalog.json'),resources=read('scripts/champion-resources.json');
const entries=fs.readdirSync('scripts/ability-ceilings').filter(n=>/^group-\d+\.json$/.test(n))
 .flatMap(n=>read(`scripts/ability-ceilings/${n}`));
const context=read('scripts/ability-ceilings/reviews/context.json');
const reports=fs.readdirSync('scripts/ability-ceilings/reviews').filter(n=>/^part-[a-z]+\.json$/.test(n))
 .map(n=>read(`scripts/ability-ceilings/reviews/${n}`));
const kits:Record<string,any>=Object.fromEntries(catalog.champions.map((c:{alias:string})=>[c.alias,read(`public/data/champions/${c.alias}.json`)]));
const validate=(overrides:{entries?:any;catalog?:any;resources?:any;context?:any;reports?:any;kits?:any}={})=>validateCeilingReviewLedger(
 overrides.entries??entries,overrides.catalog??catalog,overrides.resources??resources,
 overrides.context??context,overrides.reports??reports,overrides.kits??kits
);

it('accounts for every target and champion with source-bound assessments instead of claiming numerical verification',()=>{
 const result=validate();
 expect(result.targetCount).toBe(entries.length);
 expect(result.championCount).toBe(catalog.champions.length);
 expect(result.correctedCount+result.retainedCount).toBe(entries.length);
 expect(new Set(result.targets.map(r=>r.champion)).size).toBe(catalog.champions.length);
 expect(new Set(result.targets.map(r=>`${r.champion}/${r.key}`)).size).toBe(entries.length);
});

it('rejects gaps, duplicate reviews, unknown targets and reviews of the wrong patch',()=>{
 const missing=structuredClone(reports);missing[0].targets.pop();
 expect(()=>validate({reports:missing})).toThrow(/coverage incomplete/);
 const duplicate=structuredClone(reports);duplicate[0].targets.push(duplicate[0].targets[0]);
 expect(()=>validate({reports:duplicate})).toThrow(/duplicate ceiling review/);
 const unknown=structuredClone(reports);unknown[0].targets[0].key='unreviewed-target';
 expect(()=>validate({reports:unknown})).toThrow(/unknown/);
 const wrongPatch=structuredClone(reports);wrongPatch[0].patch='previous-patch';
 expect(()=>validate({reports:wrongPatch})).toThrow(/Invalid ceiling review report/);
});

it('invalidates a review when its authored setup changes even if the changed page remains legal',()=>{
 const changed=structuredClone(entries);
 changed[0].runePlan.shardReason+=' This explanation was changed after the recorded review.';
 expect(()=>validate({entries:changed})).toThrow(/authored setup changed/);
});

it('invalidates source or catalog updates rather than silently carrying review status forward',()=>{
 const changedCatalog={...catalog,items:catalog.items.map((i:any,n:number)=>n===0?{...i,name:i.name+' changed'}:i)};
 expect(()=>validate({catalog:changedCatalog})).toThrow(/catalog\/resource snapshot is stale/);
 const changedResources={...resources,Aatrox:'Different resource'};
 expect(()=>validate({resources:changedResources})).toThrow(/catalog\/resource snapshot is stale/);
 const changedKit={...kits.Aatrox,passive:{...kits.Aatrox.passive,description:'Changed champion source'}};
 expect(()=>validate({kits:{...kits,Aatrox:changedKit}})).toThrow(/source snapshot has changed/);
});

it('requires the exact selected formula evidence even if a new kit snapshot is deliberately acknowledged',()=>{
 const row=reports[0].targets[0],alias=row.champion;
 const changedKit=structuredClone(kits[alias]);
 const spell=changedKit.allSpellRecords.find((s:{path:string})=>s.path===row.sourcePaths[0]);
 expect(spell).toBeDefined();
 spell.tooltipWithSymbolicValues+=' Changed formula evidence.';
 const changedContext={...context,championKitHashes:{...context.championKitHashes,[alias]:hashCeilingReviewValue(changedKit)}};
 expect(()=>validate({context:changedContext,kits:{...kits,[alias]:changedKit}})).toThrow(/selected ability evidence changed/);
});

it('rejects fabricated source paths and incomplete or contradictory assessments',()=>{
 const badPath=structuredClone(reports);badPath[0].targets[0].sourcePaths=['Characters/Another/Ability'];
 expect(()=>validate({reports:badPath})).toThrow(/source paths do not match/);
 const noScaling=structuredClone(reports);noScaling[0].targets[0].scalingSummary='';
 expect(()=>validate({reports:noScaling})).toThrow(/missing scalingSummary/);
 const contradiction=structuredClone(reports);
 contradiction[0].targets[0].decision='retained';contradiction[0].targets[0].changes=['This setup was corrected.'];
 expect(()=>validate({reports:contradiction})).toThrow(/inconsistent review decision/);
});
