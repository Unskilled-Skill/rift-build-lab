import {it,expect} from 'vitest';
// @ts-expect-error Source generator deliberately stays plain ESM.
import {ceilingCombatPreparation} from '../scripts/ceiling-combat-preparation.mjs';
const entry=(runes:number[],setup:string[],extra:object={})=>({itemIds:[],runePlan:{runes,setup},...extra});
it('does not treat unrelated numbers as earned rune stacks or enable procs',()=>{
 expect(ceilingCombatPreparation(entry([9103,9104],['Use 1500 target HP and ten combat seconds.']))).toEqual({stopAtDeath:true});
 expect(ceilingCombatPreparation(entry([8226,8316,8439],['Manaflow if earned; record Jack types; Aftershock only if triggered.']))).toEqual({stopAtDeath:true});
});
it('compiles explicitly reviewed earned counters without granting new fight events',()=>{
 expect(ceilingCombatPreparation(entry([9103,9104,8345],['Bloodline: exactly15 earned legend stacks.','Alacrity requires exactly ten earned legend stacks.','Three biscuits consumed.']))).toEqual({stopAtDeath:true,bloodlineStacks:15,alacrityStacks:10,biscuits:3});
 expect(ceilingCombatPreparation(entry([] ,[],{itemIds:[6697,3161,3036],finiteState:'Hubris ten kills. Shojin 4. Enemy has 1500 bonus HP.'}))).toEqual({stopAtDeath:true,hubrisKills:10,hubrisActive:true,shojinStacks:4,targetBonusHP:1500});
});
