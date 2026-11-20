import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync,existsSync,mkdtempSync,rmSync} from 'node:fs';
import {createHash,randomBytes} from 'node:crypto';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {listFiles} from './release-files.mjs';

const root=process.cwd(),run=(file,args,options={})=>execFileSync(file,args,{stdio:'inherit',...options});
const git=args=>execFileSync('git',args,{encoding:'utf8'}).trim();
const hash=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
const copy=(from,to)=>{mkdirSync(path.dirname(to),{recursive:true});copyFileSync(from,to);};
const pkg=JSON.parse(readFileSync('package.json','utf8'));
if(!/^\d+\.\d+\.\d+$/.test(pkg.version))throw Error('A numeric release version is required.');
// Rebuild every time: matching release.json alone cannot prove dist is unmodified.
run(process.execPath,['scripts/build-release.mjs']);
const sha=git(['rev-parse','HEAD']),tag='v'+pkg.version;
const out=path.resolve('.local/releases',`${tag}-${sha.slice(0,12)}`);
if(existsSync(out))throw Error('Refusing to overwrite an existing release directory: '+out);
const temporary=mkdtempSync(path.join(tmpdir(),'vju-package-'));
try {
 const runtime=path.join(temporary,'runtime'),unpacked=path.join(temporary,'unpacked'),source=path.join(temporary,'source');
 mkdirSync(runtime);mkdirSync(unpacked);mkdirSync(source);mkdirSync(out,{recursive:true});
 for(const file of listFiles('dist'))copy(path.join(root,'dist',file),path.join(runtime,'dist',file));
 for(const file of git(['ls-files','--','server']).split('\n'))if(file.endsWith('.mjs')&&!file.endsWith('.test.mjs'))copy(path.join(root,file),path.join(runtime,file));
 for(const file of ['package.json','package-lock.json','LICENSE','THIRD_PARTY_NOTICES.md','SECURITY.md'])copy(path.join(root,file),path.join(runtime,file));
 const lock=JSON.parse(readFileSync('package-lock.json','utf8'));
 const licenses=[];
 for(const [name,meta] of Object.entries(lock.packages)) {
  if(!name||meta.dev)continue;
  const installed=listFiles(name).filter(f=>!f.includes('/'));
  const files=installed.filter(f=>/^(?:LICEN[CS]E|COPYING|NOTICE)(?:\..*)?$/i.test(f));
  // splaytree 3.2.3 ships its complete MIT notice in Readme.md, not LICENSE.
  if(!files.length)for(const file of installed.filter(f=>/^readme(?:\..*)?$/i.test(f))) {
   const text=readFileSync(path.join(name,file),'utf8');
   if(/## License[\s\S]+Copyright[\s\S]+Permission is hereby granted[\s\S]+SOFTWARE/i.test(text))files.push(file);
  }
  if(!files.length)throw Error('No license notice found for runtime dependency '+name);
  for(const file of files)copy(path.join(root,name,file),path.join(runtime,'licenses',name.replace(/^node_modules\//,''),file));
  licenses.push({name:name.replace(/^node_modules\//,''),version:meta.version,license:meta.license,files});
 }
 writeFileSync(path.join(runtime,'licenses/dependencies.json'),JSON.stringify(licenses,null,2)+'\n');
 run(process.execPath,['scripts/security-check.mjs','--artifact',runtime]);
 const runtimeName=`vju2011-${tag}-runtime.tar.gz`,sourceName=`vju2011-${tag}-source.tar.gz`;
 run('tar',['-czf',path.join(out,runtimeName),'-C',runtime,'.']);
 run('git',['archive','--format=tar.gz','--output='+path.join(out,sourceName),'HEAD']);
 run('tar',['-xzf',path.join(out,runtimeName),'-C',unpacked]);
 run('tar',['-xzf',path.join(out,sourceName),'-C',source]);
 const files=listFiles(runtime).map(file=>({path:file,sha256:hash(path.join(runtime,file))}));
 assert.deepEqual(listFiles(unpacked),files.map(f=>f.path));
 for(const file of files)assert.equal(hash(path.join(unpacked,file.path)),file.sha256,file.path);
 for(const dir of [unpacked,source])run(process.execPath,['scripts/security-check.mjs','--artifact',dir]);
 assert(!listFiles(source).some(f=>f.startsWith('docs/qa/')));
 const {createAppServer}=await import(pathToFileURL(path.join(unpacked,'server/app.mjs')).href);
 const server=createAppServer({dbPath:':memory:',adminToken:randomBytes(32).toString('hex'),seedSamples:false,staticRoot:path.join(unpacked,'dist'),releaseSha:sha,logger:()=>{}});
 const probes=[];
 try {
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  for(const [route,status] of [['/',200],['/api/health',200],['/.env',404],['/.git/config',404],['/server/start.mjs',404],['/api/admin/greetings',401]]) {
   const response=await fetch(base+route);assert.equal(response.status,status,route);
   if(route==='/api/health') { const health=await response.json();assert.equal(health.release,sha); }
   probes.push({route,status});
  }
 } finally {server.closeAllConnections();await new Promise(r=>server.close(r));}
 writeFileSync(path.join(out,'artifact-manifest.json'),JSON.stringify({sha,tag,files},null,2)+'\n');
 writeFileSync(path.join(out,'release-verification.json'),JSON.stringify({sha,tag,scope:'local extracted runtime; synthetic in-memory data; no production writes',archiveRoundTrip:true,sourceArchiveScan:true,runtimeArchiveScan:true,probes,edition:'public',publicationScope:'Original public-edition content and separately licensed assets; no private history or deployment data',realDeviceAcceptance:false},null,2)+'\n');
 const assets=[runtimeName,sourceName,'artifact-manifest.json','release-verification.json'];
 writeFileSync(path.join(out,'SHA256SUMS.txt'),assets.map(file=>hash(path.join(out,file))+'  '+file).join('\n')+'\n');
 console.log('Verified release candidate: '+out);
} catch(error) {
 // Keep failed artifacts local for diagnosis; never imply they are publishable.
 if(existsSync(out))writeFileSync(path.join(out,'FAILED.txt'),'Packaging failed; do not upload this directory.\n');
 throw error;
} finally {rmSync(temporary,{recursive:true,force:true});}
