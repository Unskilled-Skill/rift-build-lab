// Allocation/CPU microbenchmark, not a WebView2 working-set measurement.
// Bundle with vite --ssr, run in a fresh node process; do not force GC or set heap flags.
import fs from 'node:fs';
import v8 from 'node:v8';
import {searchBuilds} from '../../src/search';
import {defaultScenario,modeledItemIds} from '../../src/engine';
import type {Catalog} from '../../src/types';
const data=JSON.parse(fs.readFileSync('public/data/catalog.json','utf8')) as Catalog;
const pool=data.items.filter(i=>modeledItemIds.includes(i.id));
let peakHeap=0,peakUsed=0;const sample=()=>{const heap=v8.getHeapStatistics();peakHeap=Math.max(peakHeap,heap.total_heap_size);peakUsed=Math.max(peakUsed,heap.used_heap_size)};
const started=performance.now();
const runs=['Cassiopeia','Sett','Blitzcrank','Jhin'].map(alias=>{
 const result=searchBuilds(data.champions.find(c=>c.alias===alias)!,pool,defaultScenario(alias),[],[],100000,sample);sample();
 return {champion:alias,examined:result.examined,complete:result.complete,best:result.best};
});
console.log(JSON.stringify({node:process.version,elapsedMs:performance.now()-started,peakSampledHeapMiB:peakHeap/1048576,peakSampledUsedMiB:peakUsed/1048576,maxRssMiB:process.resourceUsage().maxRSS/1024,runs}));
