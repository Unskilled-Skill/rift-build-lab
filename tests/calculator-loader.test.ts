import {expect,it,vi} from 'vitest';
import {connectCalculator} from '../src/calculator-loader';

it('does not deliver a late calculator to an unmounted or changed view',async()=>{
 let resolve!:(value:never)=>void;
 const ready=vi.fn(),failed=vi.fn();
 const stop=connectCalculator(ready,failed,()=>new Promise(r=>{resolve=r}));
 await Promise.resolve();stop();resolve({calculate:vi.fn()} as never);
 await new Promise(r=>setTimeout(r,0));expect(ready).not.toHaveBeenCalled();expect(failed).not.toHaveBeenCalled();
});
it('reports a module-load failure without leaving a silent loading state',async()=>{
 const failed=vi.fn();connectCalculator(vi.fn(),failed,async()=>{throw Error('missing asset')});
 await new Promise(r=>setTimeout(r,0));expect(failed).toHaveBeenCalledWith(expect.objectContaining({message:'missing asset'}));
});
it('delivers the calculator only after it was requested and loaded',async()=>{
 const calculator={calculate:vi.fn()},ready=vi.fn(),load=vi.fn(async()=>calculator as never);
 expect(load).not.toHaveBeenCalled();connectCalculator(ready,vi.fn(),load);
 await new Promise(r=>setTimeout(r,0));expect(load).toHaveBeenCalledTimes(1);expect(ready).toHaveBeenCalledWith(calculator);
});
