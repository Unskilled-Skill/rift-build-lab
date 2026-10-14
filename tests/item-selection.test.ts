import {describe,it,expect} from 'vitest';
import {defaultScenario} from '../src/engine';
import type {Item,Kit} from '../src/types';
import {pickerItems,itemBlockReason,abilityObjectives} from '../src/item-selection';
const item=(id:number,overrides:Partial<Item>={}):Item=>({id,name:`Item ${id}`,baseStats:[],gold:{total:3000},descriptionText:'',effectDescriptionText:'',shopListedBySource:true,maps:{'11':true},requiredChampion:null,buildsInto:[],tags:[],iconUrl:'',...overrides});
describe('item picker eligibility and conflicts',()=>{
 it('excludes mode variants even when their source map and shop flags match',()=>{expect(pickerItems([item(3135),item(323135),item(663135)],'all','').map(i=>i.id)).toEqual([3135]);});
 it('defaults to completed items while allowing component and consumable discovery',()=>{const items=[item(3135),item(1052,{buildsInto:[3135]}),item(2003,{tags:['Consumable']})];expect(pickerItems(items,'completed','').map(i=>i.id)).toEqual([3135]);expect(pickerItems(items,'all','1052').map(i=>i.id)).toEqual([1052]);});
 it('searches stat names without exposing unavailable hidden items',()=>{expect(pickerItems([item(3135,{baseStats:[{name:'Magic Penetration',value:40,unit:'percent'}]}),item(999,{shopListedBySource:false})],'all','penetration').map(i=>i.id)).toEqual([3135]);});
 it('preserves earned transformations in the picker',()=>{expect(pickerItems([item(3042,{shopListedBySource:false})],'completed','').map(i=>i.id)).toEqual([3042]);});
 it('keeps starter purchases and trinkets out of the completed default without hiding them from all items',()=>{const items=[item(1055,{tags:['Lane']}),item(3340,{tags:['Trinket']}),item(3135)];expect(pickerItems(items,'completed','').map(i=>i.id)).toEqual([3135]);expect(pickerItems(items,'all','1055').map(i=>i.id)).toEqual([1055]);});
 it('blocks a conflicting family before selection with its equipped item name',()=>{expect(itemBlockReason(item(3137),[item(3135,{name:'Void Staff'})],defaultScenario())).toMatch(/Void Staff/);});
 it('explains budget, slot, champion and boots restrictions',()=>{expect(itemBlockReason(item(3135),[],{...defaultScenario(),budget:2999})).toMatch(/budget/i);expect(itemBlockReason(item(3135),[item(3089)],{...defaultScenario(),slots:1})).toMatch(/slot/i);expect(itemBlockReason(item(3135,{requiredChampion:'Viktor'}),[],defaultScenario())).toMatch(/Viktor/);expect(itemBlockReason(item(3006,{tags:['Boots']}),[item(3111,{tags:['Boots'],name:'Mercury'})],defaultScenario())).toMatch(/Mercury/);});
 it('does not discard equipped items or ignore existing invalid setup',()=>{const selected=[item(3089)];expect(itemBlockReason(item(3135),selected,{...defaultScenario(),budget:2000})).not.toBeNull();expect(selected.map(i=>i.id)).toEqual([3089]);});
});
describe('manual ability objectives',()=>{
 it('uses real ultimate rank caps and preserves both source forms',()=>{const ability={description:'',tooltipTemplate:'',cooldownByRank:[],costByRank:[],rangeByRank:[],enginePath:''};const kit:Kit={passive:{name:'Passive',description:''},primaryAbilities:[{...ability,slot:'Q',name:'Hammer / Cannon',maxRank:6},{...ability,slot:'R',name:'Transform',maxRank:1}],allSpellRecords:[],sources:null};const options=abilityObjectives(kit);expect(options.find(o=>o.value==='Q:1')).toMatchObject({name:'Cannon',maxRank:6});expect(options.find(o=>o.value==='R')).toMatchObject({maxRank:1});expect(options.find(o=>o.value==='P')).toBeDefined();expect(options.find(o=>o.value==='combo')).toBeDefined();});
});
