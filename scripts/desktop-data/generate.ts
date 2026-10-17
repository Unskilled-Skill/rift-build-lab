// Desktop data publication (plan §2.6). Bundled with `vite build --ssr` and run by node during `npm run build`:
//   generate.js meta <dataDir>      precomputes meta fallback bundles into <dataDir>/desktop/meta-bundles
//   generate.js manifest <dataDir>  writes <dataDir>/desktop/manifest.json over the published data tree
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import type {Catalog} from '../../src/types';
import type {CompanionBundle} from '../../src/league-export';
import {createBundleFromPlan} from '../../src/league-export';
import {buildFullMeta,parseMetaPlans} from '../../src/meta-recommendations';
import {parseRoleIndex,parseRoleSources,roleMetaPlan} from '../../src/provider-role-selection';
import {planFromMeta} from '../../src/build-plan';
import {FORMULA_COMPAT} from '../../src/model-support';
export interface MetaBundleFile {version:1;patch:string;dataVersion:string;champion:string;roles:Record<string,{planId:string;bundle:CompanionBundle}>}
export interface ManifestFile {path:string;bytes:number;sha256:string}
export interface Manifest {schema:1;formulaCompat:number;revision:string;patch:string;dataVersion:string;generatedAt:string;sourceCheckedAt:{providers:string;roles:string};files:ManifestFile[]}
const allowed=['catalog.json','chatgpt-builds.json','champion-meta-plans.json','meta-baselines.json','champions/','champion-builds/','ability-ceilings/','interaction-audit/','provider-research/','provider-roles/','desktop/meta-bundles/'];
const json=(file:string)=>JSON.parse(fs.readFileSync(file,'utf8'));
export function isManifestPath(p:string):boolean{
 return /^[A-Za-z0-9._/-]+$/.test(p)&&!p.endsWith('/')&&!p.split('/').some(part=>part===''||part==='.'||part==='..')&&allowed.some(a=>a.endsWith('/')?p.startsWith(a):p===a);
}
export function generateMetaBundles(dataDir:string):Map<string,MetaBundleFile>{
 const data=json(path.join(dataDir,'catalog.json')) as Catalog;
 const plans=parseMetaPlans(json(path.join(dataDir,'champion-meta-plans.json')),data);
 const research=json(path.join(dataDir,'provider-research/index.json'));
 const roleIndex=parseRoleIndex(json(path.join(dataDir,'provider-roles/index.json')),data);
 const out=new Map<string,MetaBundleFile>();
 for(const plan of plans){
  const file:MetaBundleFile={version:1,patch:data.patch,dataVersion:data.version,champion:plan.champion,roles:{}};
  const add=(full:ReturnType<typeof buildFullMeta>)=>{const p=planFromMeta(data,full);if(p.role==='unspecified'||file.roles[p.role])throw new Error(`${plan.champion}: duplicate or unknown meta role ${full.role}.`);file.roles[p.role]={planId:p.id,bundle:createBundleFromPlan(data,p)}};
  add(buildFullMeta(data,plan.champion,json(path.join(dataDir,`provider-research/${research.recordsDirectory}/${plan.champion}.json`)).sources,plan));
  const alternates=roleIndex.champions[plan.champion]||[];
  if(alternates.length){const entries=parseRoleSources(json(path.join(dataDir,`provider-roles/${roleIndex.recordsDirectory}/${plan.champion}.json`)),data,plan.champion);for(const role of alternates)add(buildFullMeta(data,plan.champion,entries.find(e=>e.role===role)!.sources,roleMetaPlan(plan,role)))}
  out.set(plan.champion,file);
 }
 if(out.size!==data.champions.length)throw new Error(`Meta fallback bundles cover ${out.size} of ${data.champions.length} champions.`);
 return out;
}
function walk(root:string,dir=root):string[]{
 if(!fs.existsSync(dir))return [];
 return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(root,path.join(dir,e.name)):[path.relative(root,path.join(dir,e.name)).split(path.sep).join('/')]);
}
// Provider observations ship only from the revision their index names; legacy top-level and stale version folders are excluded.
export function manifestPaths(dataDir:string):string[]{
 const current=(name:string)=>{const file=path.join(dataDir,name,'index.json');return fs.existsSync(file)?`${name}/${json(file).recordsDirectory}/`:null};
 const research=current('provider-research'),roles=current('provider-roles');
 return walk(dataDir).filter(p=>{
  if(!isManifestPath(p)||!p.endsWith('.json'))return false;
  for(const [name,dir] of [['provider-research',research],['provider-roles',roles]] as const)if(p.startsWith(`${name}/`))return p===`${name}/index.json`||(!!dir&&p.startsWith(dir));
  return true;
 }).sort();
}
export function buildManifest(dataDir:string,generatedAt=new Date().toISOString()):Manifest{
 const files=manifestPaths(dataDir).map(p=>{const bytes=fs.readFileSync(path.join(dataDir,p));return {path:p,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')}});
 const catalog=json(path.join(dataDir,'catalog.json')),checked=(name:string)=>{try{return String(json(path.join(dataDir,name,'index.json')).checkedAt||'')}catch{return ''}};
 const revision=crypto.createHash('sha256').update(files.map(f=>`${f.path}:${f.sha256}`).join('\n')).digest('hex');
 return {schema:1,formulaCompat:FORMULA_COMPAT,revision,patch:catalog.patch,dataVersion:catalog.version,generatedAt,sourceCheckedAt:{providers:checked('provider-research'),roles:checked('provider-roles')},files};
}
function main([command,dataDir]:string[]){
 if(!dataDir||!['meta','manifest'].includes(command))throw new Error('Usage: generate.js meta|manifest <dataDir>');
 const desktop=path.join(dataDir,'desktop');
 if(command==='meta'){const dir=path.join(desktop,'meta-bundles');fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir,{recursive:true});const files=generateMetaBundles(dataDir);for(const [champion,file] of files)fs.writeFileSync(path.join(dir,`${champion}.json`),JSON.stringify(file));console.log(`Wrote meta fallback bundles for ${files.size} champions.`);return}
 const manifest=buildManifest(dataDir);fs.mkdirSync(desktop,{recursive:true});fs.writeFileSync(path.join(desktop,'manifest.json'),JSON.stringify(manifest,null,1));
 console.log(`Desktop manifest ${manifest.revision.slice(0,12)}: ${manifest.files.length} files, ${(manifest.files.reduce((n,f)=>n+f.bytes,0)/1048576).toFixed(1)} MiB.`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main(process.argv.slice(2));
