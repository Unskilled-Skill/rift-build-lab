import {it,expect} from 'vitest';
import fs from 'node:fs';
import catalog from '../public/data/catalog.json';
import type {Catalog} from '../src/types';
import {parseProviderResearch} from '../src/provider-research';
const data=catalog as unknown as Catalog;
it('collected provider records load against the current item and rune catalog',()=>{const op=JSON.parse(fs.readFileSync('scripts/provider-research/opgg.json','utf8')),lol=JSON.parse(fs.readFileSync('scripts/provider-research/lolalytics.json','utf8'));expect(op).toHaveLength(173);expect(lol).toHaveLength(173);expect(new Set(op.map((s:any)=>s.champion)).size).toBe(173);expect(new Set(lol.map((s:any)=>s.champion)).size).toBe(173);for(const c of data.champions){const sources=[op.find((s:any)=>s.champion===c.alias),lol.find((s:any)=>s.champion===c.alias)];expect(sources.every(Boolean)).toBe(true);expect(sources[0].role).toBe(sources[1].role);for(const s of sources){expect(s.status).toBe('available');expect(s.sourcePatch).toBe('16.20')}try{expect(parseProviderResearch(JSON.stringify({version:1,patch:data.patch,champion:c.alias,sources}),data,c.alias)).toHaveLength(2)}catch(e){throw new Error(`${c.alias}: ${e instanceof Error?e.message:e}`)}}});

it("all published per-champion references survive client validation",()=>{for(const c of data.champions){const raw=fs.readFileSync(`public/data/provider-research/${c.alias}.json`,'utf8');expect(parseProviderResearch(raw,data,c.alias)).toHaveLength(2)}});
