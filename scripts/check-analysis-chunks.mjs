import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const deferred=['src/engine.ts','src/PurchasePlanner.tsx','src/ComparisonLab.tsx'];
export function assertAnalysisChunks(manifest){
 const initial=new Set();
 const visit=key=>{if(initial.has(key))return;initial.add(key);for(const imported of manifest[key]?.imports||[])visit(imported)};
 for(const [key,value] of Object.entries(manifest))if(value.isEntry)visit(key);
 if(!initial.size)throw Error('No initial application entry in the chunk manifest.');
 for(const key of deferred){
  if(!manifest[key]?.isDynamicEntry)throw Error(`Expected a deferred analysis chunk: ${key}`);
  if(initial.has(key))throw Error(`Analysis code loaded by the initial application: ${key}`);
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=process.argv[2]||'dist';assertAnalysisChunks(JSON.parse(fs.readFileSync(path.join(root,'.vite/manifest.json'),'utf8')));
 console.log('Calculator, purchase planner and comparison UI are deferred from the initial application.');
}
