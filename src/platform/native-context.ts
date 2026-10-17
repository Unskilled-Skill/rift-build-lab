import {createContext} from 'react';
import type {NativeBuildActions} from './types';
/** Native build actions in the desktop app; undefined on the website. */
export const NativeContext=createContext<NativeBuildActions|undefined>(undefined);
