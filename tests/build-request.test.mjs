import {it,expect} from 'vitest';
import {validateRequest} from '../server/build-request.mjs';
const catalog={champions:[{alias:'Sett'}],items:[{id:2501}]};
it('records an explicit champion goal and scenario for this chat',()=>{const r=validateRequest({champion:'Sett',goal:'  Max W without infinite stacks  ',scenario:{champion:'Sett',level:18},items:[2501]},catalog);expect(r.goal).toBe('Max W without infinite stacks');expect(r.patch).toBe('26.20');expect(r.items).toEqual([2501])});
it('rejects paths as champion aliases and invalid goals or item references',()=>{for(const override of [{champion:'../../private'},{goal:''},{goal:'a'.repeat(4001)},{items:[999]},{scenario:{champion:'Cassiopeia'}}])expect(()=>validateRequest({champion:'Sett',goal:'W test',scenario:{champion:'Sett'},items:[],...override},catalog)).toThrow()});
