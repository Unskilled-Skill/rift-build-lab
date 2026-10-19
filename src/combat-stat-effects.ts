import type {Champion,Item,Scenario} from './types';
import type {CombatEffects} from './combat-effects';
import {championResource} from './resources';

/** Coefficients: catalog.json, patch 26.20 / Data Dragon 16.20.1, rune
 * effectValuesRaw and item descriptions. Sterak's missing tooltip coefficient:
 * https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-16-notes/
 * (45% -> 50% base AD). These are prepared snapshot stats, not stack generation.
 * Neither adaptive stat choice nor champion/item conversions happen here. */
const effects=(s:Scenario):CombatEffects=>s.effects??{};
const count=(n:number|undefined,max:number)=>Math.floor(Math.min(max,Math.max(0,Number.isFinite(n)?n!:0)));
const levelOf=(s:Scenario)=>Math.min(18,Math.max(1,Number.isFinite(s.level)?s.level:1));
const growth=(level:number)=>.7025*(level-1)+.0175*(level-1)**2;
/** Use the scored adapter's form. Historical Grasp stacks need the explicit
 * form override when earned in a different form; mixed-form histories require
 * separate scenarios rather than pretending every proc earned melee health. */
function ranged(champion:Champion,s:Scenario){
 const override=effects(s).attackForm;
 if(override)return override==='ranged';
 if(champion.alias==='Gnar')return s.mode!=='cast-r'; // Q/W/E adapters are Mini Gnar.
 return (champion.stats.attackrange??125)>300;
}
export interface CombatStatBonuses {bonusHP:number;bonusMana:number;bonusAD:number;bonusAS:number;adaptiveForce:number;basicHaste:number;haste:number;hpMultiplier:number;notes:string[];implemented:string[]}
export function combatStatBonuses(champion:Champion,items:Item[],s:Scenario):CombatStatBonuses{
 const e=effects(s),level=levelOf(s),isRanged=ranged(champion,s),has=(id:number)=>s.runePage.includes(id);
 const out:CombatStatBonuses={bonusHP:0,bonusMana:0,bonusAD:0,bonusAS:0,adaptiveForce:0,basicHaste:0,haste:0,hpMultiplier:1,notes:[],implemented:[]};
 const mark=(name:string,note:string)=>{out.implemented.push(name);out.notes.push(note)};
 if(has(9103)){const n=count(e.bloodlineStacks,15);if(n===15)out.bonusHP+=85;mark('Legend: Bloodline',`Bloodline: ${n}/15 earned stacks; 85 max HP only at 15. Lifesteal is outside native spell damage.`)}
 if(has(9104)){const n=count(e.alacrityStacks,10);out.bonusAS+=.03+.015*n;mark('Legend: Alacrity',`Alacrity: 3% plus 1.5% AS per supplied earned stack (${n}/10); no stack generation.`)}
 if(has(9105)){const n=count(e.legendHasteStacks,10);out.basicHaste+=1.5*n;mark('Legend: Haste',`Legend: Haste: ${n}/10 earned stacks, basic abilities only.`)}
 if(has(8210)){out.haste+=(level>=5?5:0)+(level>=8?5:0);mark('Transcendence','Transcendence: +5 general haste at level 5 and another +5 at level 8. Level-11 takedown cooldown refunds are not automatically generated.')}
 if(has(8226)){const n=count(e.manaflowStacks,10);if(championResource(champion.alias).kind==='mana')out.bonusMana+=25*n;mark('Manaflow Band',`Manaflow: ${n}/10 earned procs, +25 maximum mana each only for mana users; regeneration omitted.`)}
 if(has(8345)){const n=count(e.biscuits,3);out.bonusHP+=30*n;mark('Biscuit Delivery',`Biscuits: ${n}/3 explicitly consumed or sold, +30 permanent HP each; no restoration proc is added.`)}
 if(has(8451)){const n=count(e.overgrowthUnits,100000);out.bonusHP+=3*Math.floor(n/8);if(n>=120)out.hpMultiplier=1.035;mark('Overgrowth',`Overgrowth: ${n} observed eligible nearby deaths; 3 HP per completed group of 8 and 3.5% total max HP after 120. Apply the total-health multiplier once, before conversions.`)}
 if(has(8437)){const n=count(e.graspStacks,100000);out.bonusHP+=n*(isRanged?2:5);mark('Grasp of the Undying',`Grasp: ${n} earned ${isRanged?'ranged':'melee'} procs (${isRanged?2:5} permanent HP each). No new attacks or stacks are generated.`);if(['Gnar','Jayce','Elise','Nidalee'].includes(champion.alias))out.notes.push('Transform champion: supplied attack form also describes the historical Grasp procs; mixed-form proc histories must be tested separately.')}
 if(has(8233)){if(s.healthPercent>70)out.adaptiveForce+=3+27*(level-1)/17;mark('Absolute Focus',`Absolute Focus grants 3–30 adaptive force only above 70% owner HP; current owner HP ${s.healthPercent}%.`)}
 if(has(8232)){if(e.inRiver===true)out.adaptiveForce+=13+17*(level-1)/17;mark('Waterwalking',`Waterwalking adaptive force ${e.inRiver===true?'active in supplied river position':'inactive outside river'}: 13–30 based on level. Its movement bonus is not added again to observed client movement speed.`)}
 if(has(8316)){const n=count(e.jackStacks,10);out.adaptiveForce+=n>=10?20:n>=5?8:0;out.haste+=n;mark('Jack Of All Trades',`Jack: ${n} observed purchased-stat types; 1 general haste per type and 8/20 adaptive force at 5/10. Rune and champion stats are not item types.`)}
 if(has(8008)){const n=count(e.lethalTempoStacks,6);out.bonusAS+=n*(isRanged?.04:.06);mark('Lethal Tempo',`Lethal Tempo: ${n}/6 explicitly prepared ${isRanged?'ranged':'melee'} stacks; AS only. Max-stack on-attack damage and stack generation are separate effects.`)}
 if(has(9923)){if(e.hailOfBladesActive===true)out.bonusAS+=isRanged?.6:.9;mark('Hail of Blades',`Hail of Blades AS is ${e.hailOfBladesActive===true?'explicitly active':'inactive'}; no free pre-channel attack, no unlimited 3-hit buff duration, no native-ability true damage credit.`)}
 if(items.some(i=>i.id===6697)){const n=count(e.hubrisKills,1000);if(e.hubrisActive===true&&n>0)out.bonusAD+=12+3*n;mark('Hubris',`Hubris: ${n} earned qualifying kills, 90-second Eminence buff ${e.hubrisActive===true&&n>0?'active':'inactive'}; active bonus is 12 + 3 per earned kill.`)}
 if(items.some(i=>i.id===3053)){const base=(champion.stats.attackdamage||0)+(champion.stats.attackdamageperlevel||0)*growth(level);out.bonusAD+=.5*base;mark("Sterak's Gage","Sterak: 50% of level-grown base AD as bonus AD (official patch 26.16). Lifeline shielding is separate.")}
 if(champion.alias==='Hecarim'){
  // Hecarim.json HecarimPassive BonusAD: .12 + .02 at each of 3/6/9/12/15/18,
  // multiplied by Stat(7)[statFormula=2] (bonus move speed). Official 10.24
  // notes corroborate the 12–24% curve at precisely these breakpoints.
  // https://www.leagueoflegends.com/en-gb/news/game-updates/patch-10-24-notes/
  if(typeof e.movementSpeed==='number'&&Number.isFinite(e.movementSpeed)){
   const bonusSpeed=Math.max(0,e.movementSpeed-(champion.stats.movespeed??345)),ratio=.12+.02*[3,6,9,12,15,18].filter(threshold=>level>=threshold).length;
   out.bonusAD+=bonusSpeed*ratio;
   mark('Warpath',`Warpath: observed final client movement speed ${e.movementSpeed}, minus base ${champion.stats.movespeed??345}, converted at ${Math.round(ratio*100)}%. Supply speed after soft caps and current buffs; item/rune speed is not separately added again. Do not also enter this Warpath AD as extra AD.`);
  }else out.notes.push('Hecarim Warpath omitted until final client movement speed is explicitly supplied. Nimbus, Celerity, Stormraider, E acceleration and movement soft caps are not generated automatically.');
 }
 return out;
}

/** Prepared pre-hit defensive snapshot. Never infers a prior immobilize from
 * the selected spell. Returns bonus values (base resistance is not duplicated).
 * Ordering of simultaneous temporary champion buffs remains a gameplay check. */
export function applyCombatDefenses(baseArmor:number,baseMR:number,bonusArmor:number,bonusMR:number,items:Item[],s:Scenario){
 const e=effects(s),has=(id:number)=>s.runePage.includes(id),notes:string[]=[],implemented:string[]=[];
 if(items.some(i=>i.id===3302)){const n=count(s.effects?.terminusLightStacks,3),perHit=s.level>=14?8:s.level>=11?7:6;bonusArmor+=n*perHit;bonusMR+=n*perHit;implemented.push('Terminus Light');notes.push(`Terminus Light: ${n}/3 prepared stacks, ${perHit} armor/MR per stack; no automatic attack generation.`)}
 if(has(8429)){implemented.push('Conditioning');if(e.conditioningActive===true&&(s.gatheringMinutes??0)>=12){bonusArmor=(baseArmor+bonusArmor+8)*1.03-baseArmor;bonusMR=(baseMR+bonusMR+8)*1.03-baseMR;notes.push('Conditioning active after 12 minutes: +8 flat resists, then +3% total resistance.')}else notes.push('Conditioning inactive: requires explicit preparation and at least 12 elapsed minutes.')}
 if(has(8242)){implemented.push('Unflinching');if(e.unflinchingActive===true){bonusArmor+=10;bonusMR+=10;notes.push('Unflinching: +10 armor/MR during an explicitly supplied incoming-CC window (or its 2-second linger).')}}
 if(has(8439)){implemented.push('Aftershock');if(e.aftershockActive===true){const cap=80+70*(levelOf(s)-1)/17;bonusArmor+=Math.min(cap,45+.75*Math.max(0,bonusArmor));bonusMR+=Math.min(cap,45+.75*Math.max(0,bonusMR));notes.push(`Aftershock explicitly prepared before impact: 45 + 75% prior bonus resistance, independently capped at ${cap.toFixed(2)} armor/MR. No retroactive same-hit resist and no explosion damage.`)}}
 if(items.some(i=>i.id===6665)){implemented.push("Jak'Sho");if(e.jakshoActive===true&&s.combatSeconds>=5){bonusArmor*=1.3;bonusMR*=1.3;notes.push("Jak'Sho explicitly active after five champion-combat seconds: +30% bonus resists.");if(e.aftershockActive===true&&has(8439))notes.push("Combined Aftershock/Jak'Sho uses a nonrecursive snapshot with Aftershock prepared before Jak'Sho activates. Other trigger orders, buff expiry and dynamic rescaling are not simulated.")}else notes.push("Jak'Sho inactive: requires explicit preparation and five champion-combat seconds.")}
 return {bonusArmor,bonusMR,notes,implemented};
}
