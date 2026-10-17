import type {Platform} from './types';
import {PlatformError} from './types';
import {webPlatform} from './web';
import {appPath} from '../hosting';
// Build-time constant (vite.config.mjs): the website build folds every desktop branch away.
export const isDesktop=import.meta.env.VITE_TARGET==='desktop';
const dataPath=/^\/data\/(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+(?:\?[A-Za-z0-9=&_.-]*)?$/;
// Published data files only; desktop serves the same relative tree from its active data revision.
export function dataUrl(path:string):string{
 if(!dataPath.test(path)||path.split('?')[0].split('/').some(part=>part==='..'||part==='.'))throw new PlatformError('internal',`Not a published data path: ${path}`);
 // WebView2 serves custom schemes as http://<scheme>.localhost (Windows is the only desktop target).
 return isDesktop?`http://rbldata.localhost${path}`:appPath(path);
}
let desktop:Promise<Platform>|undefined;
export function getPlatform():Promise<Platform>{
 if(!isDesktop)return Promise.resolve(webPlatform);
 return desktop??=import('./desktop').then(m=>m.desktopPlatform);
}
