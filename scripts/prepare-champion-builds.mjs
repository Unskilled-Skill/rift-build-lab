import fs from 'node:fs';
import path from 'node:path';
import {recipes,pages} from './build-recipes.mjs';
const catalog=JSON.parse(fs.readFileSync('public/data/catalog.json','utf8'));
const resources=JSON.parse(fs.readFileSync('scripts/champion-resources.json','utf8'));
const intents=new Map(fs.readFileSync('scripts/champion-build-intents.txt','utf8').split(/\r?\n/).filter(l=>l.trim()&&!l.startsWith('#')).map(l=>{const [alias,...rest]=l.split('|');return [alias,rest]}));
if(intents.size!==catalog.champions.length)throw new Error('Intent table must match the exact roster.');
const out='public/data/champion-builds';fs.mkdirSync(out,{recursive:true});
const types=['Reference','Damage interaction','Situational adaptation','Experiment'];
const index={version:1,patch:catalog.patch,authoredAt:'2026-10-12',author:'ChatGPT',method:'Per-champion curated intents and shared candidate packages; unvalidated hypotheses.',champions:[]};
const item=id=>{const i=catalog.items.find(i=>i.id===id);if(!i)throw new Error(`Unknown item ${id}`);return i};
for(const champion of catalog.champions){
 const intent=intents.get(champion.alias);if(!intent||intent.length!==5)throw new Error(`${champion.alias}: expected four packages and an individual question.`);
 const kit=JSON.parse(fs.readFileSync(path.join('public/data/champions',champion.alias+'.json'),'utf8'));
 const [reference,damage,situational,experiment,question]=intent;
 const sourceRecords=kit.allSpellRecords.filter(s=>s.tooltipWithSymbolicValues&&(s.primarySlot||s.name===kit.passive.name));
 const evidence=sourceRecords.map(s=>({ability:s.name,slot:s.primarySlot||'Passive',source:s.path,formula:s.tooltipWithSymbolicValues}));
 const resource=resources[champion.alias];
 const builds=[reference,damage,situational,experiment].map((key,n)=>{
  const recipe=recipes[key];if(!recipe)throw new Error(`${champion.alias}: missing package ${key}`);
  const items=recipe.items.map(item);
  const page=[...pages[recipe.page]];if(resource!=='Mana')for(let k=0;k<page.length;k++)if(page[k]===8226)page[k]=8275;
  const attack=items.some(i=>i.baseStats.some(s=>s.name==='Attack Speed'))||['critPick','burstCrit','duel','onhit','tankAD'].includes(key);
  const support=items.some(i=>i.id===3869);
  const resourceNote=resource==='Mana'?'Record available/max mana and any transformed mana-item state.':`Resource: ${resource||'no conventional mana'}. Do not treat mana regeneration as ${resource||'resource'} recovery; Nimbus replaces Manaflow when that Sorcery row is used.`;
  const formulaNote='Source formulas remain in Champion kit. Symbolic values, unresolved tokens and helper records are evidence to inspect, not a certified executable simulator.';
  const comparison=n===0?'Use this as the control for the other three routes.':'Compare against the reference route at the same level, gold spent, finite stacks and opponent setup. Record unused gold; isolate an item change before changing runes.';
  const sourceAbility=evidence.find(e=>e.slot==='Q')||evidence[0];
  const mechanicEvidence=sourceAbility?`${sourceAbility.slot} evidence: ${kit.primaryAbilities.find(a=>a.slot===sourceAbility.slot)?.description||kit.passive.description}`:kit.passive.description;
  const prefix=types[n];
  const conditions=champion.alias==='Sett'?{level:18,rank:5,mode:'w',gritMode:'fraction',grit:50,center:true,heartsteelHP:0,conquerorStacks:0,bloodmailBonus:0}:{level:support?16:18,rank:5,eRank:5,mode:champion.alias==='Cassiopeia'?'sequence':'qe',duration:10,mana:1500,mr:50,targetHP:3000,heartsteelHP:0,conquerorStacks:0,combatSeconds:0};
  return {
   id:`${champion.alias.toLowerCase()}-four-${n+1}`,champion:champion.alias,name:`${prefix}: ${recipe.name}`,goal:`${prefix} for ${champion.name}: ${n===3?'test a different playstyle, with lower confidence':n===2?'adapt to the specified fight rather than assume one universal build':n===1?'test the relevant damage interaction, not an unverified maximum':'establish a repeatable reference'}`,
   hypothesis:`${champion.profile?.intendedPlaystyle||kit.passive.description} ${question} ${recipe.angle} ${n===3?'This is intentionally experimental; abandon it if its lost utility or durability exceeds the damage/access gained.':''}`.trim(),
   itemIds:recipe.items,runePage:page,shards:[attack?5005:5007,support?5001:5008,5001],conditions,
   testPlan:[
    `Kit question for ${champion.name}: ${question}`,
    `Start with the early core (${recipe.core}) plus appropriate boots at matched gold. Record level, actual ability ranks, forms, resource and item transformations; six-item results do not establish lane strength. ${support?'Use real support income and keep the quest/vision slot.':'Use your intended lane or jungle role; jungle starters and early consumables are outside the final six slots.'}`,
    `${comparison} Run three repeatable trials of a short trade and a ten-second fight. Record damage actually landed, attacks/casts, misses, remaining resource and survival. ${resourceNote}`,
    `Measure the actual interaction before granting item/rune procs: ${recipe.angle} Test once stationary, then with a moving opponent and a fixed incoming damage pattern. ${n===2?'Choose the opponent profile this defensive route is intended to address, then repeat against the wrong damage type.':''}`,
    `${mechanicEvidence} Keep finite champion/item/rune stacks explicit. ${champion.alias==='Cassiopeia'?'For Q/E use real poison uptime and available mana.':champion.alias==='Sett'?'Log actual Grit and center/edge W hits.':'Use Practice Tool, a custom match or your own replay; no numerical adapter is available for this champion.'}`
   ],
   failureConditions:[recipe.loss,`The route fails ${champion.name}'s stated kit question: ${question}`,`Higher dummy damage is offset by fewer landed actions, deaths before the useful window, or worse ally utility. ${support?'Also record allies lost while spending on personal damage.':''}`],
   tradeoffs:[recipe.loss,`Full cost ${items.reduce((sum,i)=>sum+i.gold.total,0).toLocaleString()} gold; delayed items, resource starvation and the two-item spike must be judged separately.`,n===3?'Experimental package: plausible mechanics are not proof of strength or novelty.':n===2?'Counter-items are conditional. Change boots/defense for the real matchup, then record the modified setup.':'The reference is a research control, not a claim of the current highest-win-rate build.'],
   buyOrder:[`${recipe.core}. Adapt component timing to lane/jungle pressure; do not blindly follow the displayed six-item order.`,support?'Begin with the actual support quest item; Celestial Opposition is earned by transformation, not directly bought as a 400-gold legendary. Keep buying vision.':'Keep appropriate boots while building the early core; swap boots only when the measured matchup justifies it.',`${items.slice(2,5).map(i=>i.name).join(', ')} are later or conditional slots; do not postpone necessary protection for a six-item ceiling.`,resourceNote],
   coverageNotes:[champion.alias==='Cassiopeia'||champion.alias==='Sett'?'Only the existing Cassio Q/E or Sett W adapter is numerical. Item/rune effects and attack/utility objectives outside that adapter require manual tests.':'No numerical damage or survival adapter exists for this champion. Loading this proposal opens a manual test sheet, not calculated damage.',formulaNote,'Legal source item/rune references were checked; retained map flags cannot prove every live-shop condition. Confirm shop eligibility, exact on-hit/on-attack rules and real proc cooldowns in game.'],
   author:'ChatGPT',category:prefix,resourceType:resource,kitEvidence:evidence
  };
 });
 fs.writeFileSync(path.join(out,champion.alias+'.json'),JSON.stringify({version:1,patch:catalog.patch,author:'ChatGPT',authoredAt:'2026-10-12',builds},null,2)+'\n');
 index.champions.push({alias:champion.alias,name:champion.name,count:4});
 console.log(`${index.champions.length}/${catalog.champions.length} ${champion.name}: four proposals`);
}
fs.writeFileSync(path.join(out,'index.json'),JSON.stringify(index,null,2)+'\n');
