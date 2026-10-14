/** Coverage is an objective contract, not a claim of full champion simulation. */
export const modeledChampions = ['Cassiopeia', 'Sett', 'Blitzcrank', 'TahmKench'] as const;
const objectives: Record<string, Record<string, string>> = {
 Cassiopeia: {q:'Q poison',e:'Twin Fang',qe:'Q + poisoned E',sequence:'Repeated Q/E'},
 Sett: {w:'Haymaker'},
 Blitzcrank: {'blitz-e':'Power Fist (noncritical)'},
 TahmKench: {'tahm-q':'Tongue Lash + passive','tahm-w':'Abyssal Dive','tahm-r':'Enemy Devour'},
};
export function objectiveSupport(champion:string,mode:string){
 const label=objectives[champion]?.[mode];
 return {supported:Boolean(label),partial:true,label:label||'Manual objective',limitations:champion==='Blitzcrank'
  ? ['E crit scaling and generic on-hit/proc rules are unverified; the estimate is noncritical.']
  : champion==='TahmKench' ? ['Single champion hit only; healing, shielding, stack setup and crowd control are excluded.']
  : ['Only the selected damage objective and documented item/rune effects are modeled.']};
}
