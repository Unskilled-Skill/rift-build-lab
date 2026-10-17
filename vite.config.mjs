import {defineConfig} from 'vite';
import {providerRefreshMiddleware} from './server/provider-refresh.mjs';
import {buildRequestMiddleware} from './server/build-request.mjs';
// `--mode desktop` builds the bundled Tauri frontend: relative asset paths, no local dev services, desktop branches kept.
// SSR builds only bundle Node build tools (scripts/desktop-data), so they never copy public/.
export default defineConfig(({mode,isSsrBuild})=>{
 const desktop=mode==='desktop';
 return {
  base:desktop?'./':process.env.GITHUB_PAGES_BASE||'/',
  build:{copyPublicDir:!isSsrBuild,manifest:!isSsrBuild},
  define:{'import.meta.env.VITE_TARGET':JSON.stringify(desktop?'desktop':'web')},
  server:{watch:{ignored:[/[\\/]public[\\/]data[\\/]provider-research(?:[\\/]|$)/,/[\\/]data[\\/]provider-refresh(?:[\\/]|$)/]}},
  plugins:desktop?[]:[{name:'local-chat-build-requests',configureServer(server){server.middlewares.use(buildRequestMiddleware(process.cwd()));server.middlewares.use(providerRefreshMiddleware(process.cwd()));},configurePreviewServer(server){server.middlewares.use(buildRequestMiddleware(process.cwd()));}}],
 };
});
