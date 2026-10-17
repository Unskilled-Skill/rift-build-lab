import type {Platform} from './types';
import {PlatformError} from './types';
const unavailable=async():Promise<never>=>{throw new PlatformError('internal','This action needs the Rift Build Lab desktop app.')};
const links={releases:'https://github.com/Unskilled-Skill/rift-build-lab/releases','riot-lcu-policy':'https://developer.riotgames.com/docs/lol#league-client-api',website:'https://unskilled-skill.github.io/rift-build-lab/'};
// The website never has native access; every League write is a desktop-only capability.
export const webPlatform:Platform={
 kind:'web',
 capabilities:{nativeApply:false,autoImport:false,tray:false,dataUpdates:false},
 status:async()=>({kind:'disabled'}),
 onStatus:()=>()=>{},
 testConnection:unavailable,apply:unavailable,setDefault:unavailable,
 preferences:unavailable,updatePreferences:unavailable,
 pause:unavailable,resume:unavailable,reapply:unavailable,
 openBackupFolder:unavailable,checkDataUpdates:unavailable,
 openExternal:async link=>{window.open(typeof link==='string'?links[link]:link.url,'_blank','noopener,noreferrer')},
};
