import type {Catalog} from './types';
import {defaultScenario,legalBuild} from './engine';
import {parseSave,validRunePage} from './storage';
import type {Save} from './storage';
import {createLeagueRunePage} from './league-export';
export interface ImportPreview {save:Save;name:string;warnings:string[];format:string}
export function previewImport(text:string,data:Catalog,fallbackChampion:string,blockIndex?:number):ImportPreview{
 if(text.length>100000)throw Error('Import is too large (maximum 100 KB).');
 const raw=JSON.parse(text);if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Choose a scenario, companion bundle or League item-set JSON file.');
 if(raw.scenario){const save=parseSave(text,data.champions,data.items);if(!validRunePage(save.scenario.runePage,data.trees))throw Error('The rune page is not legal.');return {save,name:'Saved scenario',warnings:[],format:'Build Lab scenario'}}
 const bundle=!!raw.itemSet,set=bundle?raw.itemSet:raw;
 if(bundle&&(raw.version!==1||raw.patch!==data.patch))throw Error(`This bundle must use patch ${data.patch}.`);
 if(!set||!Array.isArray(set.blocks)||!set.blocks.length||set.blocks.length>16)throw Error('Expected a League item set with 1–16 purchase blocks.');
 if(set.blocks.some((b:unknown)=>!b||typeof b!=='object'||!Array.isArray((b as {items?:unknown}).items)))throw Error('Each purchase block needs an item list. Choose a valid League item-set export.');
 const champion=bundle?data.champions.find(c=>c.alias===raw.championAlias&&c.id===raw.championId):Array.isArray(set.associatedChampions)&&set.associatedChampions.length===1?data.champions.find(c=>c.id===set.associatedChampions[0]):data.champions.find(c=>c.alias===fallbackChampion);
 if(!champion)throw Error('Choose a known champion for this item set.');
 const index=blockIndex??set.blocks.reduce((last:number,b:{type?:string},n:number)=>typeof b.type==='string'&&b.type.startsWith('Final build')?n:last,-1);
 const block=set.blocks[index>=0?index:set.blocks.length-1];
 if(!block||!Array.isArray(block.items)||!block.items.length||block.items.length>6)throw Error('Select a block containing one to six unique build items.');
 const ids=block.items.map((i:{id:unknown;count:unknown})=>{if(i.count!==1||!/^\d+$/.test(String(i.id)))throw Error('A build block must contain one of each item. Choose a final-build block.');return Number(i.id)});
 const items=ids.map((id:number)=>data.items.find(i=>i.id===id));if(items.some((i:unknown)=>!i)||!legalBuild(items,100000,6,champion.alias))throw Error('This block contains unknown, duplicate or incompatible items. Select another block.');
 const scenario=defaultScenario(champion.alias);scenario.budget=Math.max(scenario.budget,items.reduce((n:number,i:Catalog['items'][number])=>n+i.gold.total,0));
 const warnings=['Ability conditions and stacks use defaults. Review them before comparing damage.'];
 if(bundle){const perks=raw.runePage?.selectedPerkIds;if(!Array.isArray(perks)||perks.length!==9)throw Error('The companion bundle needs six runes and three shards.');scenario.runePage=perks.slice(0,6);scenario.shards=perks.slice(6);const page=createLeagueRunePage(data,scenario.runePage,scenario.shards);if(page.primaryStyleId!==raw.runePage.primaryStyleId||page.subStyleId!==raw.runePage.subStyleId)throw Error('Rune trees do not match the selected runes.');}
 else warnings.push('League item sets contain no runes. A default rune page will be loaded.');
 if(!bundle&&set.associatedChampions?.length!==1)warnings.push(`No single champion attached: using ${champion.name}, selected below.`);
 return {save:{version:1,patch:'26.20',scenario,items:ids},name:String(bundle?raw.buildName:set.title).slice(0,120),warnings,format:bundle?'Items + runes bundle':'League item set'};
}
