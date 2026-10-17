import {it,expect} from 'vitest';
import fs from 'node:fs';
import {appPath} from '../src/hosting';
import {webPlatform} from '../src/platform/web';
import {dataUrl,getPlatform,isDesktop} from '../src/platform/index';
import {PlatformError,errorCodes} from '../src/platform/types';
import {findDesktopLeaks} from '../scripts/check-web-bundle.mjs';

it('exposes no native capability on the website',()=>{
 expect(webPlatform.kind).toBe('web');expect(Object.values(webPlatform.capabilities).every(v=>v===false)).toBe(true);
 expect(isDesktop).toBe(false);
});
it('resolves data URLs exactly like the existing Pages paths and confines them to the published data tree',()=>{
 for(const path of ['/data/catalog.json','/data/champions/Cassiopeia.json','/data/provider-roles/2026-10-15/Poppy.json?t=1'])expect(dataUrl(path)).toBe(appPath(path));
 for(const path of ['/downloads/companion.zip','/data/../index.html','data/catalog.json','https://example.com/data/x.json','/data\\x.json'])expect(()=>dataUrl(path)).toThrow(PlatformError);
});
it('rejects native operations on the website with a typed error instead of pretending to apply',async()=>{
 const calls=[()=>webPlatform.testConnection(),()=>webPlatform.apply({} as never,{items:true,runes:true}),()=>webPlatform.reapply(),()=>webPlatform.pause(),()=>webPlatform.resume(),()=>webPlatform.openBackupFolder(),()=>webPlatform.checkDataUpdates(),()=>webPlatform.preferences(),()=>webPlatform.updatePreferences({}),()=>webPlatform.setDefault({champion:'Ahri',role:'mid'},{} as never,'x')];
 for(const call of calls)await expect(call()).rejects.toMatchObject({name:'PlatformError',code:'internal'});
 expect(await webPlatform.status()).toEqual({kind:'disabled'});const off=webPlatform.onStatus(()=>{throw Error('never')});expect(typeof off).toBe('function');off();
 expect(await getPlatform()).toBe(webPlatform);
});
it('shares one error-code list with the native core',()=>{
 const shared=JSON.parse(fs.readFileSync('tests/fixtures/error-codes.json','utf8'));expect([...errorCodes]).toEqual(shared);
});
it('finds desktop markers and desktop chunks in a website bundle',()=>{
 const clean=[{name:'assets/index-abc.js',text:'fetch("/data/catalog.json")'}];expect(findDesktopLeaks(clean)).toEqual([]);
 const leaks=findDesktopLeaks([{name:'assets/index-abc.js',text:'window.__TAURI_INTERNALS__'},{name:'assets/x.js',text:'import("@tauri-apps/api/core")'},{name:'assets/y.js',text:'"rbldata://localhost/data"'},{name:'assets/z.js',text:'fetch("http://rbldata.localhost/data/catalog.json")'},{name:'assets/desktop-123.js',text:''}]);
 expect(leaks.map(l=>l.file)).toEqual(['assets/index-abc.js','assets/x.js','assets/y.js','assets/z.js','assets/desktop-123.js']);
});
it('keeps desktop catalog paging out of the standalone website',()=>{
 expect(findDesktopLeaks([{name:'assets/index.js',text:'className:"desktop-catalog-pages"'}])).toEqual([{file:'assets/index.js',marker:'desktop-catalog-pages'}]);
});
