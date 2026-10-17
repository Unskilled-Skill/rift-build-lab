import {useEffect,useState} from 'react';
import type {Platform} from './types';
import {getPlatform,isDesktop} from './index';
/** The desktop platform once loaded; always undefined in the website build. */
export function useDesktopPlatform():Platform|undefined{
 const [platform,setPlatform]=useState<Platform>();
 useEffect(()=>{if(!isDesktop)return;let live=true;void getPlatform().then(p=>{if(live)setPlatform(p)});return()=>{live=false}},[]);
 return platform;
}
