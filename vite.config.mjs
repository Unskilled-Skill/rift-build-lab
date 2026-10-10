import {defineConfig} from 'vite';
import {buildRequestMiddleware} from './server/build-request.mjs';
export default defineConfig({plugins:[{name:'local-chat-build-requests',configureServer(server){server.middlewares.use(buildRequestMiddleware(process.cwd()));},configurePreviewServer(server){server.middlewares.use(buildRequestMiddleware(process.cwd()));}}]});
