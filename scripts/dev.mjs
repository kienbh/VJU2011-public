import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const children=[['server/start.mjs'],['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173','--strictPort']].map(args=>spawn(process.execPath,args,{cwd:root,stdio:'inherit',windowsHide:true}));
let stopping=false;
function stop(){if(stopping)return;stopping=true;for(const child of children)child.kill();}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,stop);
for(const child of children)child.on('exit',code=>{process.exitCode=code||0;stop();});
