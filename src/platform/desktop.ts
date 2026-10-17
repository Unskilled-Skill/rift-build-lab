import type {Platform} from './types';
import {webPlatform} from './web';
// Desktop build entry. Until the Tauri IPC adapter lands (plan T17) it claims no native capability.
export const desktopPlatform:Platform={...webPlatform,kind:'desktop'};
