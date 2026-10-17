import {expect,it} from 'vitest';
import {assertAnalysisChunks} from '../scripts/check-analysis-chunks.mjs';
import type {Chunk} from '../scripts/check-analysis-chunks.mjs';
const deferred=['src/engine.ts','src/PurchasePlanner.tsx','src/ComparisonLab.tsx'];
function manifest():Record<string,Chunk>{return Object.fromEntries([['index.html',{file:'assets/index.js',isEntry:true,dynamicImports:deferred}],...deferred.map(key=>[key,{file:`assets/${key.split('/').at(-1)}.js`,isDynamicEntry:true}])]);}
it('accepts independently deferred calculator and analysis panels',()=>{expect(()=>assertAnalysisChunks(manifest())).not.toThrow()});
it('rejects an analysis engine pulled into the initial static graph',()=>{
 const graph=manifest();graph['index.html'].imports=['shared'];graph.shared={file:'shared.js',imports:['src/engine.ts']};
 expect(()=>assertAnalysisChunks(graph)).toThrow(/initial/);
});
it('rejects an absent deferred analysis chunk',()=>{const graph=manifest();delete graph['src/engine.ts'];expect(()=>assertAnalysisChunks(graph)).toThrow(/engine/)});
