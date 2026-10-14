export const localServicesEnabled=import.meta.env.DEV;
export function appPath(path:string,base=import.meta.env.BASE_URL){return `${base.endsWith('/')?base:`${base}/`}${path.replace(/^\/+/, '')}`}
