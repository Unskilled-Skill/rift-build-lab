import {expect,it} from 'vitest';
import {defaultScenario} from '../src/engine';
import {compareAtTarget,defenseSweep,purchaseAtBudget,progressionRows} from '../src/comparison-lab';
import type {Champion,Item} from '../src/types';
const champion:Champion={id:69,alias:'Cassiopeia',name:'Cassiopeia',title:'',roles:[],profile:null,stats:{hp:610,hpperlevel:98,mp:450,mpperlevel:40,attackdamage:60}};
const item=(id:number,cost:number,ap=0):Item=>({id,name:`Item ${id}`,gold:{total:cost},baseStats:[{name:'Ability Power',value:ap,unit:'flat'}],descriptionText:'',effectDescriptionText:'',shopListedBySource:true,maps:{'11':true},requiredChampion:null,buildsInto:[],tags:[],iconUrl:''});
const scenario={...defaultScenario(),level:1,rank:1,eRank:1,mode:'q' as const,mr:0,shards:[5005,5010,5011]};
it('compares shared target conditions without claiming equal spending',()=>{
 const result=compareAtTarget(champion,[item(990,3000,100)],[item(991,2500,50)],scenario,scenario);
 expect(result.experiment.damage).toBeCloseTo(140);expect(result.baseline.damage).toBeCloseTo(102.5);
 expect(result.spendingGap).toBe(500);expect(result.delta).toBeCloseTo(37.5);expect(result.percent).toBeCloseTo(100*37.5/102.5);
});
it('reports a zero baseline without infinity or a fabricated percentage',()=>{
 const r=compareAtTarget(champion,[],[],{...scenario,mana:0},{...scenario,mana:0});expect(r.percent).toBeNull();expect(r.delta).toBe(0);
});
it('never compares a baseline against different levels, ranks or target defenses',()=>{
 const r=compareAtTarget(champion,[],[],scenario,{...scenario,level:18,rank:5,mr:999,armor:999,targetHP:99999});
 expect(r.delta).toBe(0);expect(r.experiment.damage).toBe(65);
});
it('buys only an affordable ordered prefix and leaves gold unspent',()=>{
 const result=purchaseAtBudget([item(1,3000),item(2,1000)],2500);
 expect(result.items).toEqual([]);expect(result.unspent).toBe(2500);
 expect(purchaseAtBudget([item(2,1000),item(1,3000)],2500).items.map(i=>i.id)).toEqual([2]);
});
it('checks both purchase routes at the same cap and retains different actual costs',()=>{
 const rows=progressionRows(champion,[item(1,3000,100),item(2,1000,50)],[item(3,2500,90)],scenario,scenario,[3000,4000],true);
 expect(rows[0].experiment.cost).toBe(3000);expect(rows[0].baseline.cost).toBe(2500);expect(rows[0].experimentUnspent).toBe(0);expect(rows[0].baselineUnspent).toBe(500);
 expect(rows[1].experiment.damage).toBeCloseTo(177.5);
});
it('uses purchasable prerequisites and no earned stacks by default',()=>{
 const rod=item(6657,2600,50),seraph=item(3040,2900,70),archangel=item(3003,2900,60),catalog=[rod,seraph,archangel];
 const s={...scenario,rodStacks:10,gatheringMinutes:30};
 const plain=progressionRows(champion,[rod,seraph],[],s,s,[6000],false,catalog)[0];
 const earned=progressionRows(champion,[rod,seraph],[],s,s,[6000],true,catalog)[0];
 expect(plain.experimentIds).toEqual([6657,3003]);expect(plain.experiment.stats.ap).toBe(110);expect(earned.experiment.stats.ap).toBeGreaterThan(plain.experiment.stats.ap);
});
it('respects the shared slot limit at purchase checkpoints',()=>{
 const s={...scenario,slots:1};const items=[item(1,1000,20),item(2,1000,20)];
 const row=progressionRows(champion,items,items,s,s,[6000],true)[0];expect(row.experimentIds).toEqual([1]);expect(row.experimentUnspent).toBe(5000);
});
it('does not silently price a transformation without its prerequisite record',()=>{
 expect(()=>progressionRows(champion,[item(3040,2900)],[],scenario,scenario,[3000])).toThrow(/prerequisite/i);
});
it('sweeps MR including endpoints with independently known resistance damage',()=>{
 const rows=defenseSweep(champion,[],[],scenario,scenario,'mr',0,200,3);
 expect(rows.map(r=>r.value)).toEqual([0,100,200]);rows.forEach((r,i)=>expect(r.experiment.damage).toBeCloseTo([65,32.5,65/3][i]));expect(scenario.mr).toBe(0);
});
it('keeps true damage flat across an armor sweep',()=>{
 const sett={...champion,id:875,alias:'Sett'};const s={...defaultScenario('Sett'),level:1,center:true};
 const rows=defenseSweep(sett,[],[],s,s,'armor',0,400,5);expect(new Set(rows.map(r=>r.experiment.damage)).size).toBe(1);
});
it('finds a sampled lead change when penetration overtakes raw AP',()=>{
 const penetration={...item(3135,3000,50),baseStats:[{name:'Ability Power',value:50,unit:'flat'},{name:'Magic Penetration',value:40,unit:'percent'}]};
 const rows=defenseSweep(champion,[item(999,3000,100)],[penetration],scenario,scenario,'mr',0,400,9);
 expect(rows[0].delta).toBeGreaterThan(0);expect(rows.at(-1)!.delta).toBeLessThan(0);
});
it('recalculates HP scaling rather than assuming every ability scales with HP',()=>{
 const tahm={...champion,id:223,alias:'TahmKench'};const s=defaultScenario('TahmKench');s.mode='tahm-r';s.mr=0;s.rank=1;s.shards=[5005,5010,5011];
 const rows=defenseSweep(tahm,[],[],s,s,'targetHP',1000,3000,3);expect(rows.map(r=>r.experiment.damage)).toEqual([250,400,550]);
});
it('retains baseline rune stats while sharing swept target values',()=>{
 const rows=defenseSweep(champion,[],[],{...scenario,shards:[5008,5008,5011]},scenario,'mr',0,100,3);
 expect(rows[0].delta).toBeCloseTo(13.5);expect(rows[2].delta).toBeCloseTo(6.75);
});
it('rejects unsupported objectives and invalid sweep ranges instead of showing bogus curves',()=>{
 expect(()=>defenseSweep({...champion,alias:'Ahri'},[],[],scenario,scenario,'mr',0,100)).toThrow();
 for(const [min,max] of [[100,0],[NaN,100],[0,Infinity]])expect(()=>defenseSweep(champion,[],[],scenario,scenario,'mr',min,max)).toThrow();
 expect(()=>defenseSweep(champion,[],[],scenario,scenario,'targetHP',0,100)).toThrow();
});
