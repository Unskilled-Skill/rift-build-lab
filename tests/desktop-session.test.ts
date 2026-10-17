import {it,expect,vi} from 'vitest';
import type {Platform,OpenBuild} from '../src/platform/types';
import {connectDesktopSession} from '../src/platform/session';
function fixture(){
 let open:(b:OpenBuild)=>void=()=>{},persist:()=>void=()=>{};const offOpen=vi.fn(),offPersist=vi.fn();
 const platform={preferences:vi.fn(async()=>({ui:{firstRunSeen:true,champion:'Ahri',tab:'Items'}})),takePendingOpen:vi.fn(async()=>({champion:'Sett',planId:'authored:Sett:sett-reference'})),onOpenBuild:vi.fn((cb:typeof open)=>{open=cb;return offOpen}),onPersistUiState:vi.fn((cb:typeof persist)=>{persist=cb;return offPersist}),saveUiState:vi.fn(async()=>{})} as unknown as Platform;
 const callbacks={restore:vi.fn(),open:vi.fn(),snapshot:vi.fn(()=>({champion:'Sett',tab:'Builds'})),flush:vi.fn(),error:vi.fn()};
 return {platform,callbacks,offOpen,offPersist,open:(b:OpenBuild)=>open(b),persist:()=>persist()};
}
it('restores saved navigation before opening a pending build, then handles live links',async()=>{
 const f=fixture();const stop=connectDesktopSession(f.platform,f.callbacks);await vi.waitFor(()=>expect(f.callbacks.open).toHaveBeenCalledOnce());
 expect(f.callbacks.restore).toHaveBeenCalledWith({firstRunSeen:true,champion:'Ahri',tab:'Items'});
 f.open({champion:'Zac'});expect(f.callbacks.open).toHaveBeenLastCalledWith({champion:'Zac'});stop();expect(f.offOpen).toHaveBeenCalledOnce();expect(f.offPersist).toHaveBeenCalledOnce();
});
it('flushes the draft before acknowledging a tray close and preserves setup flags',async()=>{
 const f=fixture();const stop=connectDesktopSession(f.platform,f.callbacks);f.persist();await vi.waitFor(()=>expect(f.platform.saveUiState).toHaveBeenCalled());
 expect(f.callbacks.flush).toHaveBeenCalledOnce();expect(f.platform.saveUiState).toHaveBeenCalledWith({firstRunSeen:true,champion:'Sett',tab:'Builds'});stop();
});
it('does not acknowledge a failed draft flush',async()=>{
 const f=fixture();f.callbacks.flush.mockImplementation(()=>{throw Error('Storage full')});const stop=connectDesktopSession(f.platform,f.callbacks);f.persist();await vi.waitFor(()=>expect(f.callbacks.error).toHaveBeenCalled());expect(f.platform.saveUiState).not.toHaveBeenCalled();stop();
});
it('stops late startup results and reports native subscription failures without unhandled promises',async()=>{
 const f=fixture();let resolve!:(v:unknown)=>void;vi.mocked(f.platform.preferences).mockImplementation(()=>new Promise(r=>{resolve=r as never}));const stop=connectDesktopSession(f.platform,f.callbacks);stop();resolve({ui:{champion:'Ahri'}});await Promise.resolve();expect(f.callbacks.restore).not.toHaveBeenCalled();expect(f.platform.takePendingOpen).not.toHaveBeenCalled();
});
