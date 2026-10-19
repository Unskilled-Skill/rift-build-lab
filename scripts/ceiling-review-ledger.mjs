import {createHash} from 'node:crypto';
import {ceilingBuild,validateCeilings} from './ability-ceilings.mjs';

export const hashCeilingReviewValue=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const text=value=>typeof value==='string'&&value.trim().length>0&&value.length<=2000;
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;

// This ledger proves coverage and identifies the inputs that were reviewed.
// It cannot prove optimal rune choices or actual client interaction behavior.
export function validateCeilingReviewLedger(entries,catalog,resources,context,reports,kits){
 validateCeilings(entries,catalog,resources);
 if(context?.version!==1||context.patch!==catalog.patch||context.dataVersion!==catalog.version||!date(context.reviewedAt))throw new Error('Invalid ceiling review context.');
 if(context.catalogHash!==hashCeilingReviewValue(catalog)||context.resourcesHash!==hashCeilingReviewValue(resources))throw new Error('Ceiling review catalog/resource snapshot is stale.');
 const roster=catalog.champions.map(c=>c.alias).sort();
 if(!context.championKitHashes||!same(Object.keys(context.championKitHashes).sort(),roster))throw new Error('Ceiling review context must cover the exact champion roster.');
 for(const alias of roster){
  if(!kits[alias]||context.championKitHashes[alias]!==hashCeilingReviewValue(kits[alias]))throw new Error(`${alias}: champion source snapshot has changed since review.`);
 }
 if(!Array.isArray(reports)||!reports.length)throw new Error('Missing ceiling review reports.');
 const byId=new Map(entries.map(e=>[`${e.champion}/${e.key}`,e])),seen=new Set(),targets=[];
 for(const report of reports){
  if(report.patch!==catalog.patch||report.reviewedAt!==context.reviewedAt||!text(report.scope)||!Array.isArray(report.targets))throw new Error('Invalid ceiling review report.');
  for(const row of report.targets){
   const id=`${row.champion}/${row.key}`,entry=byId.get(id);
   if(!entry||seen.has(id))throw new Error(`${id}: unknown or duplicate ceiling review.`);
   seen.add(id);
   if(row.entryHash!==hashCeilingReviewValue(entry))throw new Error(`${id}: authored setup changed since review.`);
   const evidence=ceilingBuild(entry,kits[entry.champion],catalog,resources).kitEvidence;
   if(!evidence.length||row.evidenceHash!==hashCeilingReviewValue(evidence))throw new Error(`${id}: selected ability evidence changed since review.`);
   if(!Array.isArray(row.sourcePaths)||!row.sourcePaths.length||!same([...row.sourcePaths].sort(),evidence.map(e=>e.source).sort()))throw new Error(`${id}: reviewed source paths do not match the selected ability.`);
   for(const field of ['scalingSummary','runeAssessment','shardAssessment','preparationAssessment'])if(!text(row[field]))throw new Error(`${id}: missing ${field}.`);
   for(const field of ['changes','manualChecks'])if(!Array.isArray(row[field])||row[field].length>20||row[field].some(v=>!text(v)))throw new Error(`${id}: invalid ${field}.`);
   if(!['corrected','retained'].includes(row.decision)||(row.decision==='corrected')!==(row.changes.length>0))throw new Error(`${id}: inconsistent review decision.`);
   targets.push(row);
  }
 }
 if(seen.size!==entries.length)throw new Error(`Ceiling review coverage incomplete: ${seen.size}/${entries.length} targets.`);
 return {
  patch:catalog.patch,reviewedAt:context.reviewedAt,
  targetCount:entries.length,championCount:roster.length,
  correctedCount:targets.filter(r=>r.decision==='corrected').length,
  retainedCount:targets.filter(r=>r.decision==='retained').length,
  targets:targets.sort((a,b)=>a.champion.localeCompare(b.champion)||a.key.localeCompare(b.key))
 };
}
