import {it,expect} from 'vitest';
import catalog from '../public/data/catalog.json';
import starterBuilds from '../public/data/chatgpt-builds.json';
import {parseChatBuilds,toTestSave,parseTestRecords} from '../src/chat-builds';
import type {Catalog} from '../src/types';
const data=catalog as unknown as Catalog;
const build={id:'sett-test',champion:'Sett',name:'Health conversion',goal:'Test W',hypothesis:'HP feeds Grit and Bloodmail.',itemIds:[2501,3083,3084,3748,3161,3053],runePage:[8437,8401,8444,8451,9105,8299],shards:[5008,5008,5001],conditions:{level:18,rank:5,mode:'w',heartsteelHP:0,grit:100},testPlan:['Test at zero earned HP.','Repeat at partial Grit.'],failureConditions:['Cannot fill Grit.'],tradeoffs:['No boots.'],buyOrder:['Bloodmail first.'],coverageNotes:['Several item/rune effects omitted.']};
const payload=()=>({version:1,patch:'26.20',author:'ChatGPT in this chat',builds:[build]});
it('preserves valid test history while rejecting malformed records',()=>{const b=parseChatBuilds(JSON.stringify(payload()),data)[0],save=toTestSave(b,data);const record={buildId:b.id,champion:b.champion,name:b.name,date:'2026-10-10T23:00:00Z',outcome:'mixed',measuredDamage:1000,observations:'Center W hit.',scenario:save.scenario,itemIds:save.items};const parsed=parseTestRecords(JSON.stringify([{...record,itemIds:undefined},record,{...record,measuredDamage:undefined}]),data);expect(parsed.records).toHaveLength(1);expect(parsed.rejected).toBe(2)});
it('every shipped ChatGPT proposal has a valid full build and test setup',()=>{const builds=parseChatBuilds(JSON.stringify(starterBuilds),data);expect(builds.length).toBeGreaterThanOrEqual(6);for(const b of builds)expect(toTestSave(b,data).items).toHaveLength(6)});
it('validates a full AI-authored build and loads its complete legal page',()=>{const b=parseChatBuilds(JSON.stringify(payload()),data)[0];const s=toTestSave(b,data);expect(s.items).toEqual(build.itemIds);expect(s.scenario.runePage).toEqual(build.runePage);expect(s.scenario.heartsteelHP).toBe(0);expect(s.scenario.budget).toBeGreaterThanOrEqual(19000)});
it('rejects hallucinated IDs, duplicate items and invalid rune rows',()=>{for(const replacement of [{itemIds:[999999,...build.itemIds.slice(1)]},{itemIds:[2501,2501,3084,3748,3161,3053]},{runePage:[8437,8401,8444,8451,9105,9104]}])expect(()=>parseChatBuilds(JSON.stringify({...payload(),builds:[{...build,...replacement}]}),data)).toThrow()});
it('rejects unknown champions, wrong patch and oversized text',()=>{expect(()=>parseChatBuilds(JSON.stringify({...payload(),patch:'26.19'}),data)).toThrow();expect(()=>parseChatBuilds(JSON.stringify({...payload(),builds:[{...build,champion:'Fake'}]}),data)).toThrow();expect(()=>parseChatBuilds(JSON.stringify({...payload(),builds:[{...build,hypothesis:'a'.repeat(6000)}]}),data)).toThrow()});
it('requires six items and bounded scenario conditions',()=>{expect(()=>parseChatBuilds(JSON.stringify({...payload(),builds:[{...build,itemIds:[2501]}]}),data)).toThrow();expect(()=>parseChatBuilds(JSON.stringify({...payload(),builds:[{...build,conditions:{level:1000}}]}),data)).toThrow()});


it('rejects malformed numeric-coverage flags on authored tests',()=>{expect(()=>parseChatBuilds(JSON.stringify({...payload(),builds:[{...build,requiresManualTest:'false'}]}),data)).toThrow(/model flag/);expect(parseChatBuilds(JSON.stringify({...payload(),builds:[{...build,requiresManualTest:true}]}),data)[0].requiresManualTest).toBe(true)});

it('preserves manual-only coverage when saving an audited objective',()=>{const b=parseChatBuilds(JSON.stringify({...payload(),builds:[{...build,requiresManualTest:true}]}),data)[0];expect(toTestSave(b,data).requiresManualTest).toBe(true)});
