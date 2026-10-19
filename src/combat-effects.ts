/** Explicit preparation shared by the calculator, saved builds and comparison lab. */
export interface CombatEffects {
 bloodlineStacks?:number;alacrityStacks?:number;legendHasteStacks?:number;manaflowStacks?:number;biscuits?:number;
 overgrowthUnits?:number;graspStacks?:number;jackStacks?:number;
 conditioningActive?:boolean;aftershockActive?:boolean;unflinchingActive?:boolean;
 hubrisKills?:number;hubrisActive?:boolean;jakshoActive?:boolean;
 lethalTempoStacks?:number;hailOfBladesActive?:boolean;attackForm?:'melee'|'ranged';inRiver?:boolean;movementSpeed?:number;
 ptaActive?:boolean;shojinStacks?:number;cleaverStacks?:number;abyssalInRange?:boolean;
 axiomMode?:'auto'|'off'|'single'|'area';
 runeProcsReady?:boolean;cometHit?:boolean;cometDistance?:number;darkHarvestStacks?:number;
 ludenCharges?:number;itemProcsReady?:boolean;stopAtDeath?:boolean;heartsteelReady?:boolean;
 targetBonusHP?:number;terminusLightStacks?:number;terminusDarkStacks?:number;
}
export const combatEffectNumbers:Record<string,number>={bloodlineStacks:15,alacrityStacks:10,legendHasteStacks:10,manaflowStacks:10,biscuits:3,overgrowthUnits:100000,graspStacks:100000,jackStacks:10,hubrisKills:1000,lethalTempoStacks:6,shojinStacks:4,cleaverStacks:5,darkHarvestStacks:1000,ludenCharges:6,cometDistance:750,movementSpeed:3000,targetBonusHP:100000,terminusLightStacks:3,terminusDarkStacks:3};
export const combatEffectBooleans=['conditioningActive','aftershockActive','unflinchingActive','hubrisActive','jakshoActive','hailOfBladesActive','ptaActive','abyssalInRange','runeProcsReady','cometHit','itemProcsReady','inRiver','stopAtDeath','heartsteelReady'] as const;
/** Keep target/scoring conditions when removing a build's earned preparation. */
export function targetCombatEffects(e:CombatEffects|undefined):CombatEffects{return {...(e?.targetBonusHP===undefined?{}:{targetBonusHP:e.targetBonusHP}),...(e?.stopAtDeath===undefined?{}:{stopAtDeath:e.stopAtDeath})};}
export function parseCombatEffects(input:unknown):CombatEffects {
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid combat preparation.');
 const result:Record<string,unknown>={};
 for(const [key,value] of Object.entries(input)){
  if(Object.hasOwn(combatEffectNumbers,key)){
   if(typeof value!=='number'||!Number.isInteger(value)||value<0||value>combatEffectNumbers[key])throw new Error(`Invalid combat preparation ${key}.`);
  }else if((combatEffectBooleans as readonly string[]).includes(key)){
   if(typeof value!=='boolean')throw new Error(`Invalid combat preparation ${key}.`);
  }else if(key==='axiomMode'){
   if(!['auto','off','single','area'].includes(value as string))throw new Error('Invalid Axiom classification.');
  }else if(key==='attackForm'){
   if(!['melee','ranged'].includes(value as string))throw new Error('Invalid attack form.');
  }else throw new Error(`Unknown combat preparation ${key}.`);
  result[key]=value;
 }
 return result as CombatEffects;
}
