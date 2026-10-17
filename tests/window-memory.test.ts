import {afterEach,expect,it,vi} from 'vitest';
import {connectWindowMemory} from '../src/desktop/window-memory';
afterEach(()=>vi.useRealTimers());
function setup(focused=true){
 vi.useFakeTimers();const events=new EventTarget();const send=vi.fn(async(_active:boolean)=>true);
 const state={focused,busy:false};const stop=connectWindowMemory({events,focused:()=>state.focused,busy:()=>state.busy,send,idleMs:15_000});
 return {events,send,state,stop,fire:(name:string)=>events.dispatchEvent(new Event(name))};
}
it('releases caches after idle while the window remains open, then restores normal mode on input',()=>{
 const f=setup();expect(f.send).toHaveBeenLastCalledWith(true);
 vi.advanceTimersByTime(14_999);expect(f.send).toHaveBeenCalledTimes(1);
 vi.advanceTimersByTime(1);expect(f.send).toHaveBeenLastCalledWith(false);
 f.fire('pointerdown');expect(f.send).toHaveBeenLastCalledWith(true);
 f.stop();
});
it('keeps an actively used window in normal mode without sending IPC on every input',()=>{
 const f=setup();for(let n=0;n<10;n++){vi.advanceTimersByTime(2000);f.fire('wheel')}
 expect(f.send).toHaveBeenCalledTimes(1);vi.advanceTimersByTime(15_000);expect(f.send).toHaveBeenLastCalledWith(false);f.stop();
});
it('uses low mode immediately on blur and restores on focus; background pointer events do not wake it',()=>{
 const f=setup();f.state.focused=false;f.fire('blur');expect(f.send).toHaveBeenLastCalledWith(false);
 f.fire('pointermove');vi.advanceTimersByTime(60_000);expect(f.send).toHaveBeenCalledTimes(2);
 f.state.focused=true;f.fire('focus');expect(f.send).toHaveBeenLastCalledWith(true);f.stop();
});
it('cleans up timers and event handlers when the desktop shell unmounts',()=>{
 const f=setup();f.stop();f.fire('pointerdown');f.fire('blur');vi.advanceTimersByTime(60_000);expect(f.send).toHaveBeenCalledTimes(1);
});
it('does not break the app if memory management is unavailable on an older runtime',async()=>{
 vi.useFakeTimers();const events=new EventTarget();const stop=connectWindowMemory({events,focused:()=>true,send:async()=>{throw Error('Unsupported runtime')},idleMs:15_000});
 await vi.advanceTimersByTimeAsync(15_000);stop();
});

it('keeps normal performance for an ongoing damage search even without further input',()=>{
 const f=setup();f.state.busy=true;vi.advanceTimersByTime(30_000);expect(f.send).toHaveBeenCalledTimes(1);
 f.state.busy=false;vi.advanceTimersByTime(15_000);expect(f.send).toHaveBeenLastCalledWith(false);f.stop();
});

it.each(['click','input','compositionstart'])('restores normal mode for accessible form activity: %s',event=>{
 const f=setup();vi.advanceTimersByTime(15_000);f.fire(event);expect(f.send).toHaveBeenLastCalledWith(true);f.stop();
});

it('retries restoring normal mode on input after a transient IPC failure',async()=>{
 vi.useFakeTimers();const events=new EventTarget();
 const requested:boolean[]=[];
 const send=async(active:boolean)=>{requested.push(active);if(requested.length===1)throw Error('Window temporarily unavailable');return true};
 const stop=connectWindowMemory({events,focused:()=>true,send});
 await Promise.resolve();
 events.dispatchEvent(new Event('keydown'));
 expect(requested).toEqual([true,true]);
 stop();
});

it('does not let an older failed request invalidate a newer successful memory target',async()=>{
 vi.useFakeTimers();const events=new EventTarget();const requested:boolean[]=[];
 let failFirst!:(error:Error)=>void;
 const send=(active:boolean)=>{requested.push(active);return requested.length===1?new Promise((_,reject)=>{failFirst=reject}):Promise.resolve(true)};
 const stop=connectWindowMemory({events,focused:()=>true,send});
 vi.advanceTimersByTime(15_000);
 await Promise.resolve();
 failFirst(Error('Old request failed'));
 await Promise.resolve();
 events.dispatchEvent(new Event('blur'));
 expect(requested).toEqual([true,false]);
 stop();
});
