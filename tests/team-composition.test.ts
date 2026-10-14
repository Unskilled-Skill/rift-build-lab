import {it,expect} from 'vitest';
import catalog from '../public/data/catalog.json';
import type {Catalog} from '../src/types';
import {parseTeamText,parseCompDraft,teamPickerOptions,replaceTeamSlot} from '../src/team-composition';
const data=catalog as unknown as Catalog;
it('recognizes names, aliases and common shorthand without splitting multiword champions',()=>{
 expect(parseTeamText('Lee Sin, Wukong; Tahm Kench\nMundo',data.champions,4)).toEqual(['LeeSin','MonkeyKing','TahmKench','DrMundo']);
});
it('rejects unrecognized names and duplicates rather than silently changing the team',()=>{
 expect(()=>parseTeamText('Garen, Not a champ',data.champions,4)).toThrow(/Not a champ/);
 expect(()=>parseTeamText('Tahm, Tahm Kench',data.champions,4)).toThrow(/duplicate/i);
 expect(()=>parseTeamText('Garen, Lux, Jinx',data.champions,2)).toThrow(/2/);
});
it('restores bounded text drafts and refuses corrupted fields',()=>{
 expect(parseCompDraft(JSON.stringify({version:1,alliesText:'Lux',enemiesText:'Garen',enemyArmor:true}))).toMatchObject({alliesText:'Lux',enemiesText:'Garen',enemyArmor:true});
 expect(()=>parseCompDraft(JSON.stringify({version:1,alliesText:42,enemiesText:'Garen'}))).toThrow();
});

it('champion pickers filter selected champions and reject duplicate slot changes',()=>{
 expect(teamPickerOptions('tahm',data.champions,['TahmKench']).length).toBe(0);expect(teamPickerOptions('wukong',data.champions,[]).map(c=>c.alias)).toEqual(['MonkeyKing']);
 expect(replaceTeamSlot(['Lux','',''],1,'Ashe',['Ahri','Lux'])).toEqual(['Lux','Ashe','']);expect(()=>replaceTeamSlot(['Lux','',''],1,'Lux',['Ahri','Lux'])).toThrow(/already/i);
 expect(parseCompDraft(JSON.stringify({version:1,alliesText:'Lux',enemiesText:'',allySlots:['Lux','','','']})).allySlots).toEqual(['Lux','','','']);
});
