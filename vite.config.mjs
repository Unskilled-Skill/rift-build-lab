import {defineConfig} from 'vite';
import {providerRefreshMiddleware} from './server/provider-refresh.mjs';
import {buildRequestMiddleware} from './server/build-request.mjs';
export default defineConfig({server:{watch:{ignored:[/[\\/]public[\\/]data[\\/]provider-research(?:[\\/]|$)/,/[\\/]data[\\/]provider-refresh(?:[\\/]|$)/]}},plugins:[{name:'local-chat-build-requests',configureServer(server){server.middlewares.use(buildRequestMiddleware(process.cwd()));server.middlewares.use(providerRefreshMiddleware(process.cwd()));},configurePreviewServer(server){server.middlewares.use(buildRequestMiddleware(process.cwd()));}}]});
