/** Compile only finite preparation explicitly recorded by the reviewed setup.
 * Proc damage stays off: ceiling benchmarks score the named native metric. */
export function ceilingCombatPreparation(entry){
 const runes=entry.runePlan?.runes||[],setup=(entry.runePlan?.setup||[]).join(' '),state=entry.finiteState||'';
 const effects={stopAtDeath:true};
 if(runes.includes(9103)&&/Bloodline[^.!?]*(?:15|fifteen)|(?:15|fifteen)[^.!?]*Bloodline/i.test(setup))effects.bloodlineStacks=15;
 if(runes.includes(9104)&&/Alacrity[^.!?]*(?:10|ten)|(?:10|ten)[^.!?]*Alacrity/i.test(setup))effects.alacrityStacks=10;
 if(runes.includes(8345)&&/three|\b3\b/i.test(setup)&&/consum|sold/i.test(setup))effects.biscuits=3;
 if(runes.includes(8451)&&/\b150\b/.test(setup))effects.overgrowthUnits=150;
 if(runes.includes(8429)&&(entry.conditions?.gatheringMinutes??0)>=12)effects.conditioningActive=true;
 if(runes.includes(8008)&&/(?:six|6).{0,25}Lethal Tempo|Lethal Tempo.{0,25}(?:six|6)|LT6/i.test(setup+' '+state))effects.lethalTempoStacks=6;
 if(entry.itemIds.includes(6697)&&/(?:Hubris.{0,45}(?:10|ten).{0,20}kill|(?:10|ten).{0,35}Hubris.{0,20}kill|(?:10|ten).{0,15}kill.{0,35}Hubris)/i.test(state+' '+entry.mechanic)){effects.hubrisKills=10;effects.hubrisActive=true;}
 if(entry.itemIds.includes(3161)&&/Shojin\s*4|Shojin.{0,20}(?:four|4).{0,12}stack/i.test(state))effects.shojinStacks=4;
 if(entry.itemIds.includes(6665)&&(entry.conditions?.combatSeconds??0)>=5)effects.jakshoActive=true;
 const bonusHP=state.match(/(?:target|enemy)[^.]*?([0-9]+)\s*bonus\s*HP/i);
 if(entry.itemIds.includes(3036)&&bonusHP)effects.targetBonusHP=Number(bonusHP[1]);
 // Conditional Manaflow/Jack/Aftershock/Abyssal text is not a ready-state claim.
 // Users supply those observed counters/windows in the test bench.
 return effects;
}
