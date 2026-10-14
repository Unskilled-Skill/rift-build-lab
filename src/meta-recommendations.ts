import type {Catalog,Item} from './types';
import type {ProviderSource} from './provider-research';
import {legalBuild} from './engine';
import {validRunePage} from './storage';

export interface MetaPlan {
 champion:string;role:string;preferredItemIds:number[];situationalItemIds:number[];summary:string;
 traits:{damage:'physical'|'magic'|'mixed'|'true-heavy';attackBased:boolean;heals:boolean;shields:boolean;hardCC:boolean;dive:boolean;poke:boolean;frontline:boolean;armorStacking:boolean;attackSpeedThreat:boolean};notes:string[];
}
export interface FullMetaBuild {
 champion:string;role:string;referenceItemIds?:number[];itemIds:number[];runePage:number[];shards:number[];buyOrder:number[];
 observedCoreItemIds:number[];coreCompletionItemIds?:number[];inferredItemIds:number[];sourceOptionItemIds:number[];
 reasons:Array<{itemId:number;reason:string;kind:'observed-core'|'provider-option'|'kit-completion'|'composition-swap'}>;
 warnings:string[];sourceProvider:string;sourcePatch:string;checkedAt:string;sourceURL:string;summary:string;
}
export class MetaRecommendationError extends Error {
 constructor(public code:'no-current-core'|'incomplete-build'|'invalid-plan'|'invalid-composition',message:string){super(message);this.name='MetaRecommendationError'}
}
const quests=[3865,3866,3867,3869,3870,3871,3876,3877];
const finalQuests=[3869,3870,3871,3876,3877];
const knownHealers=new Set(['Aatrox','Briar','DrMundo','Fiddlesticks','Gwen','Illaoi','Irelia','Maokai','Nami','Nilah','Olaf','Rhaast','Kayn','Renekton','Soraka','Swain','Sylas','Taric','Vladimir','Warwick','Yuumi','Zac','Sona','Seraphine','Milio','Janna','Nidalee']);
const assassinAliases=new Set(['Akshan','Khazix','Naafiri','Nocturne','Pantheon','Pyke','Qiyana','Rengar','Shaco','Talon','Zed']);
const get=(data:Catalog,id:number)=>data.items.find(i=>i.id===id);
const boots=(item:Item)=>item.tags.includes('Boots');
const complete=(item:Item)=>[3041,...finalQuests].includes(item.id)||boots(item)&&item.id!==1001||item.gold.total>=1800&&item.buildsInto.length===0;
function legal(data:Catalog,ids:number[],champion:string){const items=ids.map(id=>get(data,id));return items.every(Boolean)&&legalBuild(items as Item[],100000,6,champion)&&ids.filter(id=>quests.includes(id)).length<=1}
function validatePlan(plan:MetaPlan,data:Catalog){
 if(!plan||!data.champions.some(c=>c.alias===plan.champion)||!['top','mid','adc','jungle','support'].includes(plan.role)||!Array.isArray(plan.preferredItemIds)||!Array.isArray(plan.situationalItemIds)||[...plan.preferredItemIds,...plan.situationalItemIds].some(id=>!Number.isInteger(id)||!get(data,id))||typeof plan.summary!=='string'||!Array.isArray(plan.notes)||plan.notes.some(n=>typeof n!=='string')||!plan.traits||!['physical','magic','mixed','true-heavy'].includes(plan.traits.damage)||['attackBased','heals','shields','hardCC','dive','poke','frontline','armorStacking','attackSpeedThreat'].some(k=>typeof plan.traits[k as keyof MetaPlan['traits']]!=='boolean'))throw new MetaRecommendationError('invalid-plan','The champion completion plan does not match this catalog.');
}
export function parseMetaPlans(value:unknown,data:Catalog):MetaPlan[]{
 const input=value as {version:number;patch:string;plans:MetaPlan[];checkedAt:string};
 if(!input||input.version!==1||input.patch!==data.patch||!/^\d{4}-\d{2}-\d{2}$/.test(input.checkedAt)||!Array.isArray(input.plans)||input.plans.length!==data.champions.length)throw new MetaRecommendationError('invalid-plan','Expected one current-patch completion plan per champion.');
 input.plans.forEach(p=>validatePlan(p,data));if(new Set(input.plans.map(p=>p.champion)).size!==data.champions.length)throw new MetaRecommendationError('invalid-plan','Completion plans contain duplicate champions.');return input.plans;
}
function upgrade(data:Catalog,id:number,plan:MetaPlan):number|undefined {
 const item=get(data,id);if(!item)return;
 if([3003,3004,3119,2526].includes(id)){const end:Record<number,number>={3003:3040,3004:3042,3119:3121,2526:2530};return end[id]}
 if(complete(item))return id;
 const preferred=[...plan.preferredItemIds,...plan.situationalItemIds];
 if(id===3070||id===3003||id===3004){const targets=id===3003?[3040]:id===3004?[3042]:[3040,3042,3121,3119];return preferred.find(n=>targets.includes(n)&&!!get(data,n))}
 const reaches=(current:number,target:number,seen=new Set<number>()):boolean=>{if(current===target)return true;if(seen.has(current))return false;seen.add(current);return (get(data,current)?.buildsInto||[]).some(n=>reaches(n,target,seen))};
 return preferred.find(n=>get(data,n)&&complete(get(data,n)!)&&reaches(id,n));
}
type OptionSource=ProviderSource&{observedItemOptions?:Array<{slot:number;items:Array<{id:number;matches?:number;winRate?:number}>}>};
export function buildFullMeta(data:Catalog,champion:string,sources:ProviderSource[],plan:MetaPlan):FullMetaBuild {
 validatePlan(plan,data);if(plan.champion!==champion)throw new MetaRecommendationError('invalid-plan','Completion plan belongs to another champion.');
 const patch=data.version.split('.').slice(0,2).join('.');
 const candidates=sources.filter(s=>s.champion===champion&&s.status==='available'&&(s.sourcePatch===patch||s.sourcePatch===data.patch)&&s.coreBuildMatches!>0&&s.observedCoreItemIds?.length&&s.observedRunePage&&validRunePage(s.observedRunePage,data.trees)).sort((a,b)=>(a.provider==='opgg'?0:1)-(b.provider==='opgg'?0:1));
 for(const source of candidates){
  const ids:number[]=[],reasons:FullMetaBuild['reasons']=[],observed:number[]=[],options:number[]=[],inferred:number[]=[],coreCompletions:number[]=[];
  const add=(id:number,kind:FullMetaBuild['reasons'][number]['kind'],reason:string)=>{const item=get(data,id);if(!item||!complete(item)||!legal(data,[...ids,id],champion))return false;ids.push(id);reasons.push({itemId:id,kind,reason});if(kind==='observed-core')observed.push(id);else if(kind==='provider-option')options.push(id);else inferred.push(id);return true};
  let invalid=false;
  for(const id of source.observedCoreItemIds!){if(id===3070&&source.observedCoreItemIds!.some(other=>[3003,3040,3004,3042,3119,3121].includes(other)))continue;const target=upgrade(data,id,plan);if(target===undefined||!add(target,target===id?'observed-core':'kit-completion',target===id?'Observed provider core.':`Completion of source component ${get(data,id)?.name}; inferred finished item.`)){invalid=true;break}if(target!==id)coreCompletions.push(target)}
  if(invalid)continue;
  if(!ids.some(id=>boots(get(data,id)!))){const boot=source.bootsId&&get(data,source.bootsId);const selectedBoot=boot&&boots(boot)?boot.id:plan.preferredItemIds.find(id=>boots(get(data,id)!));if(selectedBoot)add(selectedBoot,selectedBoot===source.bootsId?'provider-option':'kit-completion','Boots preserve the source or champion movement plan.');}
  if(source.role==='support'&&!ids.some(id=>finalQuests.includes(id))){const quest=plan.preferredItemIds.find(id=>finalQuests.includes(id));if(!quest||!add(quest,'kit-completion','Support quest upgrade; inferred from the champion plan.'))continue;}
  for(const slot of [...((source as OptionSource).observedItemOptions||[])].sort((a,b)=>a.slot-b.slot)){
   if(ids.length>=6)break;
   const valid=slot.items.filter(o=>[...plan.preferredItemIds,...plan.situationalItemIds].includes(o.id)&&Number.isInteger(o.matches)&&o.matches!>=20&&get(data,o.id)&&complete(get(data,o.id)!));
   valid.sort((a,b)=>(b.matches||0)-(a.matches||0)||(b.winRate||0)-(a.winRate||0)||a.id-b.id);
   for(const item of valid)if(add(item.id,'provider-option',`Observed slot ${slot.slot} option (${item.matches} matches); marginal option, not a joint six-item statistic.`))break;
  }
  for(const id of [...plan.preferredItemIds,...plan.situationalItemIds]){if(ids.length===6)break;add(id,'kit-completion','Champion kit completion; not observed six-item performance.');}
  if(ids.length!==6||!legal(data,ids,champion)||!ids.some(id=>boots(get(data,id)!)))continue;
  return {champion,role:source.role,itemIds:ids,runePage:[...source.observedRunePage!],shards:source.observedShards?[...source.observedShards]:[5008,5008,5001],buyOrder:[...ids],observedCoreItemIds:observed,coreCompletionItemIds:coreCompletions,inferredItemIds:inferred,sourceOptionItemIds:options,reasons,warnings:['The observed core and individual options do not establish six-item build statistics. Late slots are kit-based inferences.',...plan.notes.filter(n=>!n.startsWith('OP.GG observed core')&&!n.startsWith('Early Tear/Dark Seal')).map(n=>n.replace(/Provider core sample: \d+ matches\./g,'')),source.limits],sourceProvider:source.provider,sourcePatch:source.sourcePatch!,checkedAt:source.checkedAt,sourceURL:source.sourceURL,summary:`${data.champions.find(c=>c.alias===champion)?.profile?.intendedPlaystyle||'Use the selected champion kit to execute its role.'} The current ${source.role} provider core anchors this plan; later slots are observed options or reviewed kit completions.`};
 }
 if(candidates.length)throw new MetaRecommendationError('incomplete-build',`${champion}: no legal six-item completion is available for the current provider core. Refresh provider data or review this champion’s completion plan.`);
 throw new MetaRecommendationError('no-current-core','No validated current-patch provider core is available. Refresh provider references; an authored experiment cannot replace observed meta data.');
}

export interface Composition {allies:string[];enemies:string[];enemyArmor?:boolean;enemyMR?:boolean;enemyHealing?:boolean;enemyShields?:boolean;priority?:'balanced'|'damage'|'survival';mainThreat?:string;laneOpponent?:string;lockedItemIds?:number[]}
export function recommendForComp(data:Catalog,base:FullMetaBuild,plan:MetaPlan,plans:MetaPlan[],comp:Composition):{build:FullMetaBuild;priorities:Array<{title:string;reason:string}>;changes:Array<{removed:number;added:number;reason:string}>;warnings:string[]} {
 validatePlan(plan,data);
 if(!comp||!Array.isArray(comp.allies)||!Array.isArray(comp.enemies)||comp.allies.length>4||comp.enemies.length>5||[...comp.allies,...comp.enemies].some(alias=>alias===base.champion||!data.champions.some(c=>c.alias===alias))||new Set([...comp.allies,...comp.enemies]).size!==comp.allies.length+comp.enemies.length||['enemyArmor','enemyMR','enemyHealing','enemyShields'].some(k=>comp[k as keyof Composition]!==undefined&&typeof comp[k as keyof Composition]!=='boolean'))throw new MetaRecommendationError('invalid-composition','Choose at most four allies and five enemies; each known champion must appear once, excluding your champion.');
 if((comp.priority!==undefined&&!['balanced','damage','survival'].includes(comp.priority))||[comp.mainThreat,comp.laneOpponent].some(c=>c!==undefined&&!comp.enemies.includes(c))||(comp.lockedItemIds!==undefined&&(!Array.isArray(comp.lockedItemIds)||comp.lockedItemIds.length>6||new Set(comp.lockedItemIds).size!==comp.lockedItemIds.length||comp.lockedItemIds.some(id=>!base.itemIds.includes(id)))))throw new MetaRecommendationError('invalid-composition','Choose threats from the enemy team and lock only equipped items.');
 if(base.champion!==plan.champion||base.itemIds.length!==6||!legal(data,base.itemIds,base.champion))throw new MetaRecommendationError('invalid-composition','Select a legal six-item base build for this champion first.');
 const build:FullMetaBuild={...base,referenceItemIds:[...base.itemIds],itemIds:[...base.itemIds],buyOrder:[...base.buyOrder],observedCoreItemIds:[...base.observedCoreItemIds],inferredItemIds:[...base.inferredItemIds],sourceOptionItemIds:[...base.sourceOptionItemIds],reasons:base.reasons.map(r=>({...r})),warnings:[...base.warnings]};
 const priorities:Array<{title:string;reason:string}>=[],changes:Array<{removed:number;added:number;reason:string}>=[],warnings=['Composition advice is qualitative; it does not predict win rate or calculate a complete fight.'];
 const lookup=(alias:string)=>plans.find(p=>p.champion===alias);
 const enemies=comp.enemies.map(lookup).filter((p):p is MetaPlan=>!!p),allies=comp.allies.map(lookup).filter((p):p is MetaPlan=>!!p);
 if(enemies.length<comp.enemies.length||allies.length<comp.allies.length)warnings.push('Some selected champions lack kit traits; recommendations for them are limited.');
 const priority=(title:string,reason:string)=>priorities.push({title,reason});
 const used=new Set<number>();
 const applySwap=(id:number,reason:string,quiet=false,bootOnly=false)=>{
  const candidate=get(data,id);if(!candidate||!complete(candidate))return false;if(build.itemIds.includes(id)){used.add(id);return true;}
  for(let n=build.itemIds.length-1;n>=0;n--){const old=build.itemIds[n],item=get(data,old)!;if(comp.lockedItemIds?.includes(old)||base.observedCoreItemIds.includes(old)||base.coreCompletionItemIds?.includes(old)||(bootOnly?!boots(item):boots(item))||quests.includes(old)||used.has(old))continue;
   const next=[...build.itemIds];next[n]=id;if(!legal(data,next,base.champion))continue;
   build.itemIds=next;build.buyOrder=[...next];build.inferredItemIds=build.inferredItemIds.filter(x=>x!==old);build.inferredItemIds.push(id);build.sourceOptionItemIds=build.sourceOptionItemIds.filter(x=>x!==old);build.reasons=build.reasons.filter(r=>r.itemId!==old);build.reasons.push({itemId:id,reason,kind:'composition-swap'});changes.push({removed:old,added:id,reason});used.add(id);return true;
  }if(!quiet)warnings.push(`Keep the observed core: ${candidate.name} has no compatible optional slot. Consider a separate matchup variant.`);return false;
 };
 let need='healing';
 const pending:Array<{id:number;reason:string;bootOnly:boolean;group:string;score:number;order:number}>=[];
 const score=(group:string)=>{const defense=group.includes('defense')||group==='dive';return defense?(comp.priority==='survival'?120:comp.priority==='damage'?50:85):group==='penetration'?(comp.priority==='damage'?120:comp.priority==='survival'?70:95):group==='healing'?(comp.enemyHealing?95:75):comp.enemyShields?90:60;};
 const swap=(id:number,reason:string,_quiet=false,bootOnly=false)=>{pending.push({id,reason,bootOnly,group:need+(bootOnly?'-boots':''),score:score(need),order:pending.length});return false;};
 if(comp.priority)warnings.push(`Recommendation priority: ${comp.priority}. Higher-priority compatible answers retain their slots before lower-priority requests.`);
 if(comp.mainThreat)priority('Focus the main threat',`${namesFor(comp.mainThreat)} is your selected main threat; its typical damage profile receives extra defensive weight.`);
 if(comp.laneOpponent)priority('Plan the lane first',`Lane opponent: ${namesFor(comp.laneOpponent)}. Use the purchase checkpoints for lane timing; this does not infer their actual items.`);
 function namesFor(alias:string){return data.champions.find(c=>c.alias===alias)?.name||alias}
 const hasStat=(name:string)=>base.itemIds.some(id=>get(data,id)!.baseStats.some(s=>s.name===name&&s.value>0));
 const attackCarry=plan.role==='adc'&&plan.traits.attackBased&&hasStat('Attack Damage');
 const offensiveAD=hasStat('Attack Damage')&&plan.traits.damage!=='magic';
 const utilitySupport=plan.role==='support'&&(plan.traits.heals||plan.traits.shields)&&base.itemIds.some(id=>get(data,id)!.baseStats.some(s=>s.name.includes('Heal and Shield')&&s.value>0));
 const statTotal=(name:string)=>base.itemIds.reduce((total,id)=>total+get(data,id)!.baseStats.filter(s=>s.name===name).reduce((sum,s)=>sum+s.value,0),0);
 const offensiveAP=hasStat('Ability Power')&&!attackCarry&&!utilitySupport&&(plan.traits.damage==='magic'||['mixed','true-heavy'].includes(plan.traits.damage)&&statTotal('Ability Power')*.6>statTotal('Attack Damage'));
 const names=(ps:MetaPlan[])=>ps.map(p=>data.champions.find(c=>c.alias===p.champion)?.name||p.champion).join(', ');
 warnings.push('Damage profiles describe typical kit threats, not confirmed enemy builds. Check actual items, damage patterns and who is ahead.');
 if(comp.enemyHealing||enemies.some(p=>p.traits.heals&&knownHealers.has(p.champion))||enemies.filter(p=>p.traits.heals).length>=2){
  const reason=`Enemy sustain${enemies.some(p=>p.traits.heals)?` from ${names(enemies.filter(p=>p.traits.heals))}`:''}: apply Grievous Wounds reliably and coordinate coverage with allies.`;priority('Cover enemy healing',reason);
  if(utilitySupport)warnings.push('Your build centers on ally utility. Coordinate healing reduction with a reliable damage dealer rather than automatically replacing utility with a mage damage item.');else if(attackCarry){if(!swap(3033,reason,true))swap(6609,reason);}else if(offensiveAD)swap(6609,reason);else if(offensiveAP)swap(3165,reason);else warnings.push('Healing reduction needs a reliable applicator. Thornmail requires enemies to attack you; do not rely on it against spell-only healing.');
 }
 need='shields';
 if(comp.enemyShields||enemies.some(p=>p.traits.shields)){
  priority('Plan around enemy shields','Delay burst or coordinate shield breaking; evaluate how frequently the shield protects your actual target.');
  if(assassinAliases.has(plan.champion)&&plan.traits.damage==='physical')swap(6695,'AD assassin shield breaking with Serpent’s Fang.');else warnings.push('No compatible shield-reduction purchase is recommended for this kit. Shadowflame is not an anti-shield item.');
 }
 need='penetration';
 if(comp.enemyMR&&offensiveAP){priority('Answer confirmed magic resistance','The selected enemy MR flag represents observed purchases, rather than an assumption from champion identity.');swap(3135,'Confirmed enemy magic resistance: percentage magic penetration.');}
 else if(!comp.enemyMR&&offensiveAP&&enemies.some(p=>p.traits.frontline))priority('Check actual magic resistance','A frontline kit does not prove an MR purchase. Consider percentage magic penetration once target MR is confirmed.');
 if(comp.enemyArmor&&plan.traits.damage==='physical'){priority('Answer confirmed armor','Choose penetration or team armor reduction compatible with your attack pattern.');swap(plan.traits.attackBased&&plan.role==='adc'?3036:plan.traits.frontline?3071:6694,'Confirmed enemy armor: compatible armor penetration or reduction.');}
 else if(!comp.enemyArmor&&plan.traits.damage==='physical'&&enemies.some(p=>p.traits.armorStacking))priority('Check actual armor','The enemy kit can benefit from armor; confirm purchases before changing optional damage slots.');
 if(enemies.some(p=>p.traits.damage==='true-heavy')){priority('Respect true-damage threats','Use positioning, peel and appropriate health/sustain; resistance alone will not protect against true damage.');warnings.push('Armor and magic resistance do not reduce true damage; percentage-health true damage also limits health stacking.');}
 need='dive';
 const divers=enemies.filter(p=>p.traits.dive).length;
 if(divers){priority('Survive the first engage',`Dive threats${enemies.some(p=>p.traits.dive)?` including ${names(enemies.filter(p=>p.traits.dive))}`:''} make access and escape timing more valuable than another damage proc.`);if(utilitySupport)priority('Protect the carry through utility','Keep shields, healing and disengage available for the threatened ally; a mage stasis purchase is not the default response for this utility build.');else if(offensiveAP)swap(3157,'Enemy dive: stasis creates time for allies to peel; account for cooldown and timing.');else if(plan.traits.frontline)priority('Keep the carry reachable','Hold crowd control for enemy divers when your allies need peel.');}
 const magicThreats=enemies.filter(p=>p.traits.damage==='magic'),physicalThreats=enemies.filter(p=>p.traits.damage==='physical');
 const magicWeight=magicThreats.length+(magicThreats.some(p=>p.champion===comp.mainThreat)?2:0),physicalWeight=physicalThreats.length+(physicalThreats.some(p=>p.champion===comp.mainThreat)?2:0);
 need='magic-defense';
 if(magicWeight>=3){const reason=`The typical kits of ${names(magicThreats)} lean toward magic damage. Confirm actual builds and which threat is ahead before spending on defense.`;priority('Consider magic defense',reason);if(plan.traits.frontline)swap((plan.traits.heals||plan.traits.shields)&&!build.itemIds.includes(3065)?3065:2504,reason);else if(utilitySupport)swap(3190,'Magic-heavy pressure: Locket adds team shielding and resists while preserving a utility role.');else if(offensiveAD)swap(3156,'Magic-heavy pressure: Maw preserves AD while adding magic defense; Lifeline conflicts still apply.');else if(offensiveAP)swap(3102,'Magic-heavy pressure: spell shield and magic resistance, with AP retained.');}
 if(magicWeight>=3&&build.itemIds.includes(3047))swap(3111,'Magic-heavy pressure: replace armor boots with magic resistance; tenacity only helps reducible control.',true,true);
 need='physical-defense';
 if(physicalWeight>=3){const reason=`The typical kits of ${names(physicalThreats)} lean toward physical damage. Armor does not answer their true-damage packets.`;priority('Consider physical defense',reason);if(plan.traits.frontline)swap(3143,'Physical-heavy pressure: an armor and health slot; extra crit reduction matters only if enemies actually crit.');else if(utilitySupport)swap(3109,'Physical-heavy pressure: Knight’s Vow supports protecting a linked carry; choose and maintain the partner carefully.');else if(offensiveAD)swap(3026,'Physical-heavy pressure: Guardian Angel retains AD, adds armor and provides a cooldown-dependent revive.');else if(offensiveAP)swap(3157,'Physical-heavy pressure: armor and timed stasis; this cannot replace positioning.');}
 if(enemies.some(p=>p.traits.hardCC)){priority('Check the crowd-control type','Tenacity helps reducible control only; identify the actual enemy spells before changing boots.');warnings.push('Hard-CC traits do not distinguish knockups or suppression. Tenacity does not shorten every control effect.');}
 if(comp.allies.length&&allies.length===comp.allies.length&&!allies.some(p=>p.traits.frontline)&&!plan.traits.frontline)priority('Protect access without a frontline','Your allies lack a frontline trait. Play around terrain, range and disengage rather than assuming a safe front-to-back fight.');
 if(allies.some(p=>p.traits.attackSpeedThreat)&&plan.traits.hardCC)priority('Peel for sustained attackers','Your allies can deal sustained attack damage; hold reliable control to protect their firing time.');
 if(allies.some(p=>p.traits.poke)&&plan.traits.poke)priority('Coordinate poke windows','Use allied range to soften targets before committing; preserve mana and avoid isolated engages.');
 if(allies.length&&allies.every(p=>p.traits.damage===plan.traits.damage)&&['physical','magic'].includes(plan.traits.damage))priority('Account for shared damage type','Your selected allies share your main damage type. Enemy resistance purchases become valuable; confirm them before choosing penetration.');
 if(!comp.enemies.length)warnings.push('Select enemies to get matchup priorities. Actual builds, lane state and player execution are not supplied.');
 const satisfied=new Set<string>();
 for(const request of pending.sort((a,b)=>b.score-a.score||a.order-b.order)){
  if(satisfied.has(request.group))continue;
  if(applySwap(request.id,request.reason,true,request.bootOnly))satisfied.add(request.group);
 }
 for(const group of new Set(pending.map(r=>r.group)))if(!satisfied.has(group))warnings.push(`Unfilled ${group.replace(/-/g,' ')} need: no compatible optional slot remains after item locks, source core protection and higher-priority answers. Compare a separate variant or adjust priorities.`);
 build.warnings=[...new Set([...build.warnings,...warnings])];return {build,priorities,changes,warnings};
}
