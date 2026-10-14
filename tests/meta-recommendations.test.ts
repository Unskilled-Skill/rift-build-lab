import {it,expect} from 'vitest';
import catalog from '../public/data/catalog.json';
import {buildFullMeta,recommendForComp,MetaRecommendationError} from '../src/meta-recommendations';
import type {MetaPlan} from '../src/meta-recommendations';
import type {Catalog} from '../src/types';
import type {ProviderSource} from '../src/provider-research';
import fs from 'node:fs';
const data=catalog as unknown as Catalog;
const traits:MetaPlan['traits']={damage:'magic',attackBased:false,heals:false,shields:false,hardCC:true,dive:false,poke:true,frontline:false,armorStacking:false,attackSpeedThreat:false};
const plan:MetaPlan={champion:'Ahri',role:'mid',preferredItemIds:[3118,3020,4645,3089,3135,3157],situationalItemIds:[3165,3102,3137],summary:'Spell burst and safe access.',traits,notes:[]};
const source:ProviderSource={champion:'Ahri',role:'mid',provider:'opgg',status:'available',sourceURL:'https://op.gg/open-source/opgg-mcp',sourcePatch:'16.20',checkedAt:'2026-10-14',observedCoreItemIds:[3118,4645,3089],observedRunePage:[8112,8139,8140,8106,8226,8210],coreBuildMatches:1000,bootsId:3020,limits:'Core only.'};
const enemy=(champion:string,overrides:Partial<MetaPlan['traits']>={}):MetaPlan=>({...plan,champion,traits:{...traits,...overrides}});
it('completes six legal items and distinguishes inferred slots from observed core',()=>{const b=buildFullMeta(data,'Ahri',[source],plan);expect(b.itemIds).toHaveLength(6);expect(b.observedCoreItemIds).toEqual(source.observedCoreItemIds);expect(b.inferredItemIds).toEqual([3135,3157]);expect(b.buyOrder).toEqual(b.itemIds);expect(b.warnings.join(' ')).toMatch(/six-item.*statistic/i)});
it('fails closed when all sources are unavailable or stale',()=>{for(const s of [{...source,status:'unavailable' as const},{...source,sourcePatch:'16.19'}])expect(()=>buildFullMeta(data,'Ahri',[s],plan)).toThrow(MetaRecommendationError)});
it('falls back to legal Lolalytics source when OP.GG core is invalid',()=>{const b=buildFullMeta(data,'Ahri',[{...source,observedCoreItemIds:[999999]},{...source,provider:'lolalytics'}],plan);expect(b.sourceProvider).toBe('lolalytics')});
it('upgrades observed Tear as inference without counting its completion as observed',()=>{const p={...plan,preferredItemIds:[3040,3020,3116,3089,3135,3157]};const b=buildFullMeta(data,'Ahri',[{...source,observedCoreItemIds:[3070,3116,3089]}],p);expect(b.itemIds).toContain(3040);expect(b.itemIds).not.toContain(3070);expect(b.observedCoreItemIds).toEqual([3116,3089]);expect(b.inferredItemIds).toContain(3040)});
it('chooses adequately sampled late options instead of a tiny highest win-rate',()=>{const s={...source,observedItemOptions:[{slot:4,items:[{id:3157,matches:1000,winRate:55},{id:3102,matches:3,winRate:100}]}]};const b=buildFullMeta(data,'Ahri',[s],plan);expect(b.sourceOptionItemIds).toContain(3157);expect(b.sourceOptionItemIds).not.toContain(3102)});
it('AP spell builds get Morellonomicon for meaningful healing and never Serpent against shields',()=>{const b=buildFullMeta(data,'Ahri',[source],plan);const r=recommendForComp(data,b,plan,[plan,enemy('Soraka',{heals:true,shields:true})],{allies:[],enemies:['Soraka']});expect(r.build.itemIds).toContain(3165);expect(r.build.itemIds).not.toContain(6695);expect(r.build.itemIds).not.toContain(3076);expect(r.build.observedCoreItemIds).toEqual(b.observedCoreItemIds);expect(r.warnings.join(' ')).toMatch(/shield/)});
it('rejects unknown, duplicate, own and oversized compositions',()=>{const b=buildFullMeta(data,'Ahri',[source],plan);for(const c of [{allies:['Ahri'],enemies:[]},{allies:[],enemies:['not-real']},{allies:['Soraka'],enemies:['Soraka']},{allies:[],enemies:['Soraka','Soraka']},{allies:['Aatrox','Annie','Ashe','Bard','Caitlyn'],enemies:[]}])expect(()=>recommendForComp(data,b,plan,[plan],c)).toThrow()});
it('true-damage threat does not trigger blanket armor and allies change priorities',()=>{const b=buildFullMeta(data,'Ahri',[source],plan);const plans=[plan,enemy('Vayne',{damage:'true-heavy',attackBased:true,attackSpeedThreat:true}),enemy('Ashe',{damage:'physical',attackBased:true,frontline:false})];const r=recommendForComp(data,b,plan,plans,{allies:['Ashe'],enemies:['Vayne']});expect(r.warnings.join(' ')).toMatch(/true damage/);expect(r.priorities.map(p=>p.title)).toContain('Protect access without a frontline');expect(r.build.itemIds).not.toContain(3143)});
it('physical frontline fighters use Chempunk rather than relying on enemy attacks',()=>{const p={...plan,champion:'Aatrox',role:'top',preferredItemIds:[6692,3047,6610,6333,3053,3065],situationalItemIds:[6609],traits:{...traits,damage:'physical' as const,frontline:true,attackBased:true}};const b=buildFullMeta(data,'Aatrox',[{...source,champion:'Aatrox',role:'top',observedCoreItemIds:[6692,6610,6333],bootsId:3047}],p);expect(recommendForComp(data,b,p,[p,enemy('Soraka',{heals:true})],{allies:[],enemies:['Soraka']}).build.itemIds).toContain(6609)});
it('mixed-damage attack carries keep compatible attack antiheal even with some AP',()=>{const p={...plan,champion:'Kaisa',role:'adc',preferredItemIds:[6672,3006,3124,3115,3089,3157],situationalItemIds:[3033],traits:{...traits,damage:'mixed' as const,attackBased:true}};const b=buildFullMeta(data,'Kaisa',[{...source,champion:'Kaisa',role:'adc',observedCoreItemIds:[6672,3124,3115],bootsId:3006}],p);expect(recommendForComp(data,b,p,[p],{allies:[],enemies:[],enemyHealing:true}).build.itemIds).toContain(3033)});
it('keeps a sourced final Tear upgrade while removing its redundant starting component',()=>{const p={...plan,preferredItemIds:[3040,3020,3116,3089,3135,3157]};const b=buildFullMeta(data,'Ahri',[{...source,observedCoreItemIds:[3070,3040,3116,3089]}],p);expect(b.itemIds).not.toContain(3070);expect(b.observedCoreItemIds).toContain(3040);expect(b.inferredItemIds).not.toContain(3040)});
it('converts unstacked Archangel to the plan final form and labels it inferred',()=>{const p={...plan,preferredItemIds:[3040,3020,3116,3089,3135,3157]};const b=buildFullMeta(data,'Ahri',[{...source,observedCoreItemIds:[3003,3116,3089]}],p);expect(b.itemIds).toContain(3040);expect(b.inferredItemIds).toContain(3040)});
it('completes every champion from the shipped provider snapshot without duplicate families',()=>{const plans=JSON.parse(fs.readFileSync('public/data/champion-meta-plans.json','utf8')).plans as MetaPlan[];const index=JSON.parse(fs.readFileSync('public/data/provider-research/index.json','utf8'));for(const p of plans){const sources=JSON.parse(fs.readFileSync(`public/data/provider-research/${index.recordsDirectory}/${p.champion}.json`,'utf8')).sources;const b=buildFullMeta(data,p.champion,sources,p);expect(b.itemIds,p.champion).toHaveLength(6);expect(new Set(b.itemIds).size,p.champion).toBe(6)}});
it('responds to a magic-heavy enemy team with compatible fighter defense',()=>{
 const p={...plan,champion:'Aatrox',role:'top',preferredItemIds:[6692,3047,6610,6333,3053,3026],situationalItemIds:[3065,2504],traits:{...traits,damage:'physical' as const,frontline:true,heals:true,attackBased:true}};
 const b=buildFullMeta(data,'Aatrox',[{...source,champion:'Aatrox',role:'top',observedCoreItemIds:[6692,6610,6333],bootsId:3047}],p);
 const r=recommendForComp(data,b,p,[p,enemy('Annie'),enemy('Lux'),enemy('Veigar')],{allies:[],enemies:['Annie','Lux','Veigar']});
 expect(r.build.itemIds).toContain(3065);expect(r.build.observedCoreItemIds).toEqual(b.observedCoreItemIds);
});
it('does not turn an enchanter utility build into a stasis mage because it contains AP',()=>{
 const p={...plan,champion:'Lulu',role:'support',preferredItemIds:[3870,3158,3504,6617,3222,3107],situationalItemIds:[3190,3109],traits:{...traits,damage:'magic' as const,frontline:false,heals:false,shields:true,attackBased:false}};
 const b=buildFullMeta(data,'Lulu',[{...source,champion:'Lulu',role:'support',observedCoreItemIds:[3504,6617],bootsId:3158}],p);
 const r=recommendForComp(data,b,p,[p,enemy('Zed',{damage:'physical',dive:true})],{allies:[],enemies:['Zed']});
 expect(r.build.itemIds).not.toContain(3157);expect(r.priorities.map(p=>p.title)).toContain('Protect the carry through utility');
});
it('does not present old authored core descriptions and samples as fresh provider observations',()=>{
 const p={...plan,summary:'Old source core: Duskblade.',notes:['OP.GG observed core 999; source sample 1.','Six-slot completion is our kit-based inference. Provider core sample: 1 matches.']};
 const b=buildFullMeta(data,'Ahri',[source],p);
 expect(b.summary).not.toContain('Duskblade');expect(b.warnings.join(' ')).not.toContain('sample: 1');expect(b.warnings.join(' ')).not.toContain('core 999');
});

const shippedPlans=JSON.parse(fs.readFileSync('public/data/champion-meta-plans.json','utf8')).plans as MetaPlan[];
// Captured 16.20 cores keep behavior regressions stable when daily provider data changes.
const regressionCores:Record<string,{core:number[];boots:number;role:string}>={Senna:{core:[3071,3087,3094],boots:3009,role:'support'},Jax:{core:[3078,6610,3157],boots:3047,role:'top'},Smolder:{core:[3508,3071,3161],boots:3008,role:'adc'},Kaisa:{core:[6672,3124,3302],boots:3006,role:'adc'},TahmKench:{core:[3084,2510,3075],boots:3047,role:'top'}};
const shippedBuild=(champion:string)=>{const p=shippedPlans.find(p=>p.champion===champion)!;const fixture=regressionCores[champion];return {p,b:buildFullMeta(data,champion,[{...source,champion,role:fixture.role,observedCoreItemIds:fixture.core,bootsId:fixture.boots}],p)}};
it('physical Senna and incidental-AP Jax do not buy Void Staff for confirmed MR',()=>{
 for(const champion of ['Senna','Jax']){const {p,b}=shippedBuild(champion);const r=recommendForComp(data,b,p,shippedPlans,{allies:[],enemies:['Ornn'],enemyMR:true});expect(r.build.itemIds,champion).not.toContain(3135)}
});
it('uses compatible antiheal when an ADC core already owns a penetration family item',()=>{
 for(const champion of ['Smolder','Kaisa']){const {p,b}=shippedBuild(champion);const r=recommendForComp(data,b,p,shippedPlans,{allies:[],enemies:['Soraka'],enemyHealing:true});expect(r.build.itemIds,champion).toContain(6609);expect(r.warnings.join(' ')).not.toContain('no compatible optional slot')}
});
it('protects a finished version of a sourced Tear core during composition swaps',()=>{
 const p={...plan,preferredItemIds:[3040,3020,3116,3089,3135,3157]};const b=buildFullMeta(data,'Ahri',[{...source,observedCoreItemIds:[3003,3116,3089]}],p);
 const r=recommendForComp(data,b,p,[p,enemy('Soraka',{heals:true}),enemy('Zed',{damage:'physical',dive:true})],{allies:[],enemies:['Soraka','Zed'],enemyMR:true});expect(r.build.itemIds).toContain(3040);
});
it('adapts Tahm optional armor and defensive boots against a magic-heavy team even with Visage already owned',()=>{
 const {p,b}=shippedBuild('TahmKench');const r=recommendForComp(data,b,p,shippedPlans,{allies:[],enemies:['Annie','Lux','Veigar']});expect(r.build.itemIds).toContain(2504);expect(r.build.itemIds).toContain(3111);expect(r.build.itemIds).not.toContain(3143);expect(r.build.observedCoreItemIds).toEqual(b.observedCoreItemIds);
});

it('keeps AP utility purchases available for a spell build with conditional true damage',()=>{
 const p={...plan,champion:'Velkoz',traits:{...traits,damage:'true-heavy' as const}};const b=buildFullMeta(data,'Velkoz',[{...source,champion:'Velkoz'}],p);expect(recommendForComp(data,b,p,[p],{allies:[],enemies:[],enemyHealing:true}).build.itemIds).toContain(3165);
});

it('reserves survival answers ahead of conflicting damage and healing suggestions when survival is selected',()=>{
 const b=buildFullMeta(data,'Ahri',[source],plan),ps=[plan,enemy('Zed',{damage:'physical',dive:true}),enemy('Soraka',{heals:true})];
 const r=recommendForComp(data,b,plan,ps,{allies:[],enemies:['Zed','Soraka'],enemyMR:true,priority:'survival',mainThreat:'Zed'});
 expect(r.build.itemIds).toContain(3157);expect(r.warnings.join(' ')).toMatch(/priorit/i);
 const damage=recommendForComp(data,b,plan,ps,{allies:[],enemies:['Zed','Soraka'],enemyMR:true,priority:'damage'});expect(damage.build.itemIds).toContain(3135);expect(damage.build.itemIds).toContain(3165);
});
it('respects individual item locks and validates threat selections',()=>{
 const b=buildFullMeta(data,'Ahri',[source],plan);const r=recommendForComp(data,b,plan,[plan],{allies:[],enemies:[],enemyHealing:true,lockedItemIds:[3135,3157]});expect(r.build.itemIds).toEqual(b.itemIds);
 for(const c of [{mainThreat:'Zed'},{laneOpponent:'Unknown'},{priority:'invalid'},{lockedItemIds:[999]}])expect(()=>recommendForComp(data,b,plan,[plan],{allies:[],enemies:[],...c} as any)).toThrow();
});
