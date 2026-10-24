// Ranked Reference builds: one per champion, taken from the OP.GG/Lolalytics Emerald+ plan for the champion's main role
// (observed core, observed rune page, reviewed completion items). Bundled with `vite build --ssr` and run by node:
//   generate.js <dataDir> <outFile> [providerRecordsDir]
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import type {Catalog} from '../../src/types';
import type {RankedInfo} from '../../src/chat-builds';
import {buildFullMeta,parseMetaPlans} from '../../src/meta-recommendations';
const json=(file:string)=>JSON.parse(fs.readFileSync(file,'utf8'));
const roleNames:Record<string,string>={top:'top',jungle:'jungle',mid:'mid',adc:'bot',support:'support'};
export interface RankedReference {name:string;goal:string;hypothesis:string;summary:string;itemIds:number[];runePage:number[];shards:number[];testPlan:string[];failureConditions:string[];tradeoffs:string[];buyOrder:string[];coverageNotes:string[];ranked:RankedInfo}
export function rankedReferences(dataDir:string,recordsDir?:string):Record<string,RankedReference>{
 const data=json(path.join(dataDir,'catalog.json')) as Catalog;
 const plans=parseMetaPlans(json(path.join(dataDir,'champion-meta-plans.json')),data);
 const dir=recordsDir||json(path.join(dataDir,'provider-research/index.json')).recordsDirectory;
 const name=(id:number)=>data.items.find(i=>i.id===id)?.name||String(id),rune=(id:number)=>data.runes.find(r=>r.id===id)?.name||String(id);
 const out:Record<string,RankedReference>={};
 for(const plan of plans){
  const champion=data.champions.find(c=>c.alias===plan.champion)!;
  const sources=json(path.join(dataDir,`provider-research/${dir}/${plan.champion}.json`)).sources;
  const full=buildFullMeta(data,plan.champion,sources,plan);
  const source=sources.find((s:{provider:string;role:string})=>s.provider===full.sourceProvider&&s.role===full.role);
  const provider=full.sourceProvider==='opgg'?'OP.GG':'Lolalytics',role=roleNames[full.role]||full.role;
  const games=source?.coreBuildMatches||source?.matches||0,wins=source?.coreBuildWins,winRate=typeof wins==='number'&&games?Math.round(wins/games*1000)/10:typeof source?.coreBuildWinRate==='number'?source.coreBuildWinRate:undefined;
  const core=full.observedCoreItemIds.map(name).join(' → '),completion=full.itemIds.filter(id=>!full.observedCoreItemIds.includes(id)).map(name);
  const evidence=`${games.toLocaleString('en-US')} ranked Emerald+ games with this core on ${provider}, patch ${full.sourcePatch}${winRate!==undefined?`, ${winRate}% win rate`:''}`;
  out[plan.champion]={
   name:`Reference: Ranked ${role} core`,
   goal:`Reference for ${champion.name}: the core and runes ranked Emerald+ ${role} players use most (${evidence}).`,
   hypothesis:`${full.summary} Core in purchase order: ${core}. ${rune(full.runePage[0])} keystone as played in those games.${completion.length?` Remaining slots: ${completion.join(', ')}.`:''}`,
   summary:`The proven ${role} baseline: ${core}, with ${rune(full.runePage[0])}.`,
   itemIds:[...full.itemIds],runePage:[...full.runePage],shards:[...full.shards],
   testPlan:[
    `Play it in ${role} as your control build. Follow the purchase order; the core (${core}) is what ranked players complete first.`,
    'Record kills, deaths, damage dealt and the minute you finish each core item, then compare other builds against these numbers in similar games.',
    'Adapt the last two items to the enemy team: armor or magic resist against fed carries, anti-heal against healing, penetration once enemies stack resists.',
   ],
   failureConditions:[`Your results with this build fall clearly below the ${winRate!==undefined?`${winRate}% `:''}ranked baseline over several games in the same role.`,'The enemy team composition makes the core items poor answers; swap the flexible slots before abandoning the core.'],
   tradeoffs:['Proven and predictable, so opponents know what to expect. It is a starting point, not the best build for every matchup.',...full.warnings.slice(0,2)],
   buyOrder:[`Core in purchase order: ${core}.`,'Boots after the first item unless the lane needs them earlier.'],
   coverageNotes:[`Source: ${provider} ranked Emerald+ solo/duo, patch ${full.sourcePatch}, checked ${full.checkedAt}. Core items and rune page are observed; ${completion.length?'later slots are observed options or reviewed completions':'all slots are observed'}. Win rates describe those games, not a prediction for yours.`],
   ranked:{provider:full.sourceProvider==='opgg'?'opgg':'lolalytics',role:full.role,sourceURL:full.sourceURL,sourcePatch:full.sourcePatch,checkedAt:full.checkedAt,games,...(winRate!==undefined?{winRate}:{}),observedCoreItemIds:[...full.observedCoreItemIds]},
  };
 }
 if(Object.keys(out).length!==data.champions.length)throw new Error(`Ranked references cover ${Object.keys(out).length} of ${data.champions.length} champions.`);
 return out;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [dataDir,outFile,recordsDir]=process.argv.slice(2);
 if(!dataDir||!outFile)throw new Error('Usage: generate.js <dataDir> <outFile> [providerRecordsDir]');
 const catalog=json(path.join(dataDir,'catalog.json'));
 const references=rankedReferences(dataDir,recordsDir);
 fs.writeFileSync(outFile,JSON.stringify({version:1,patch:catalog.patch,references},null,1)+'\n');
 console.log(`Ranked references: ${Object.keys(references).length} champions.`);
}
