import {it,expect} from 'vitest';
import fs from 'node:fs';
import {renderToString} from 'react-dom/server';
import type {Preferences,RevisionInfo} from '../src/platform/types';
import {FirstRunView,firstRunPatch} from '../src/desktop/FirstRun';
import {ImportSettingsView} from '../src/desktop/ImportSettings';
const samples=JSON.parse(fs.readFileSync('tests/fixtures/ipc-samples.json','utf8'));
const [defaults,filled]=samples.preferences as Preferences[];
const revision=samples.revisions[0] as RevisionInfo;
const text=(html:string)=>html.replace(/<!-- -->/g,'').replace(/<[^>]+>/g,' ').replace(/&#x27;/g,"'").replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const noop=()=>{};
const checkbox=(html:string,label:string)=>{const m=html.match(new RegExp(`<label[^>]*>(?:(?!</label>).)*?<input([^>]*)>(?:(?!</label>).)*?${label}`));if(!m)throw Error(`no checkbox ${label}`);return {checked:/checked=""/.test(m[1]),disabled:/disabled=""/.test(m[1])}};

it('explains what automatic imports change and starts with them off',()=>{
 const html=renderToString(<FirstRunView busy={false} message="" onEnable={noop} onSkip={noop} onTest={noop}/>),t=text(html);
 for(const part of ['Rift Build Lab','item set','rune page named Rift Build Lab','Personal','backup','Turn on automatic imports','Not now','Test League connection'])expect(t).toContain(part);
 expect(checkbox(html,'Items')).toMatchObject({checked:true});expect(checkbox(html,'Runes')).toMatchObject({checked:true});
 expect(checkbox(html,'current meta plan')).toMatchObject({checked:false});
 expect(html).not.toMatch(/type="(password|text|email)"|<textarea/);expect(t).toContain('No Riot password, account login or API key is needed');
});
it('only enables the meta fallback as part of turning automatic imports on',()=>{
 expect(firstRunPatch({items:true,runes:false,metaFallback:true})).toEqual({autoImport:{enabled:true,items:true,runes:false,metaFallback:true}});
 expect(firstRunPatch({items:false,runes:false,metaFallback:true})).toBeNull();
});
it('shows imports off with the meta fallback unavailable until imports are on',()=>{
 const html=renderToString(<ImportSettingsView prefs={defaults} revision={revision} status={{kind:'disabled'}} busy={false} message="" onAction={noop}/>),t=text(html);
 expect(checkbox(html,'Automatic imports')).toMatchObject({checked:false});
 expect(checkbox(html,'current meta plan')).toMatchObject({disabled:true});
 for(const part of ['No saved builds yet','Nothing imported yet','Bundled with the app','Patch 26.20','Provider data checked 2026-10-17','Check for data updates','Open backup folder','Keep running in the tray','Start with Windows','Check for app update'])expect(t).toContain(part);
 expect(checkbox(html,'Start with Windows')).toMatchObject({checked:false});
});
it('lists saved defaults, defaults needing review and the last result',()=>{
 const html=renderToString(<ImportSettingsView prefs={filled} revision={{...revision,bundled:false}} status={{kind:'paused'}} busy={false} message="Build data is up to date." onAction={noop}/>),t=text(html);
 expect(checkbox(html,'Automatic imports')).toMatchObject({checked:true});
 expect(checkbox(html,'Keep running in the tray')).toMatchObject({checked:true});
 expect(t).toContain('Ahri · Mid · Ahri mid meta plan');
 expect(t).toMatch(/Zed · Mid.*needs review.*26\.19/);
 expect(t).toContain('Last import: Ahri mid meta plan · confirmed');
 expect(t).toContain('Last problem: x');
 expect(t).toContain('Downloaded update');expect(t).toContain('Resume');expect(t).toContain('Build data is up to date.');
 expect((html.match(/>Clear</g)||[]).length).toBe(2);
});
