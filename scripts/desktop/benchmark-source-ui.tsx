// Count rendered source DOM, not WebView2 heap or operating-system working set.
import fs from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import RuneCard from '../../src/RuneCard';
import type {Catalog} from '../../src/types';
const data=JSON.parse(fs.readFileSync('public/data/catalog.json','utf8')) as Catalog;
const measure=(defer:boolean,count:number)=>{
 const html=renderToStaticMarkup(<>{data.runes.slice(0,count).map(rune=><RuneCard key={rune.id} rune={rune} deferSource={defer}/>)}</>);
 return {cards:count,elementCount:(html.match(/<[a-z][\w-]*(?:\s|>)/g)||[]).length,tables:(html.match(/<table/g)||[]).length,rawSourceBlocks:(html.match(/<pre/g)||[]).length,htmlBytes:Buffer.byteLength(html)};
};
console.log(JSON.stringify({desktopPage:{before:measure(false,32),after:measure(true,32)},wholeCatalog:{before:measure(false,data.runes.length),after:measure(true,data.runes.length)}}));
