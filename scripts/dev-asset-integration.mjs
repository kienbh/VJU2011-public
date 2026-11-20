// Isolated preview: loopback only, fresh local QA database, no SSO/live configuration.
import {createServer} from 'vite';
import {createAppServer} from '../server/app.mjs';
import {mkdir} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import path from 'node:path';
await mkdir('.local',{recursive:true});
const api=createAppServer({dbPath:path.resolve('.local/asset-integration.sqlite'),staticRoot:path.resolve('dist'),adminToken:randomBytes(48).toString('hex'),seedSamples:false,trialAccounts:true,devOrigin:'http://127.0.0.1:5365',logger:()=>{}});
await new Promise((resolve,reject)=>{api.once('error',reject);api.listen(8977,'127.0.0.1',resolve);});
let vite;
try{vite=await createServer({server:{host:'127.0.0.1',port:5365,strictPort:true,proxy:{'/api':'http://127.0.0.1:8977'}}});await vite.listen();}
catch(error){api.close();throw error;}
console.log('Local asset integration: http://127.0.0.1:5365/?view=walk&festival=1&intro=0');
console.log('Architecture preview: add &assetPreview=batch03 (proposed facades only).');
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await vite.close();api.close(()=>process.exit(0));});
