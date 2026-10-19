import {abilityModel,abilityModels} from './ability-models';
import type {Scenario} from './types';
/** Coverage is an objective contract, not a claim of full champion simulation. */
// Bump whenever engine or ability formulas change; desktop builds refuse data published for a different value.
export const FORMULA_COMPAT=2;
export const modeledChampions = ['Cassiopeia', 'Sett', 'Blitzcrank', 'TahmKench',...Object.keys(abilityModels)];
const objectives: Record<string, Record<string, string>> = {
 Cassiopeia: {q:'Q poison',e:'Twin Fang',qe:'Q + poisoned E',sequence:'Repeated Q/E'},
 Sett: {w:'Haymaker'},
 Blitzcrank: {'blitz-e':'Power Fist (noncritical)'},
 TahmKench: {'tahm-q':'Tongue Lash + passive','tahm-w':'Abyssal Dive','tahm-r':'Enemy Devour'},
};
export function objectiveSupport(champion:string,mode:string){
 const model=abilityModel(champion,mode),label=objectives[champion]?.[mode]||model?.label;
 return {supported:Boolean(label),partial:true,label:label||'Manual objective',limitations:model?[model.notes]:champion==='Blitzcrank'
  ? ['E crit scaling and generic on-hit/proc rules are unverified; the estimate is noncritical.']
  : champion==='TahmKench' ? ['Single champion hit only; healing, shielding, stack setup and crowd control are excluded.']
  : ['Only the selected damage objective and documented item/rune effects are modeled.']};
}

export function objectiveOptions(champion:string){return [...Object.entries(objectives[champion]||{}).map(([mode,label])=>({mode:mode as Scenario['mode'],label})),...Object.entries(abilityModels[champion]||{}).map(([mode,model])=>({mode:mode as Scenario['mode'],label:model!.label}))];}
