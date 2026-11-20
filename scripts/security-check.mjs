import {execFileSync,spawnSync} from 'node:child_process';
import {existsSync,mkdtempSync,rmSync,readFileSync,readdirSync,lstatSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const guardRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const binary=path.join(guardRoot,'.local/security/tools',process.platform==='win32'?'gitleaks.exe':'gitleaks');
const config=path.join(guardRoot,'.gitleaks.toml');
const git=args=>execFileSync('git',args,{encoding:'utf8',maxBuffer:32*1024*1024});
export function sensitivePath(file){
 const p=file.replaceAll('\\','/'),base=path.posix.basename(p);
 if(/(?:^|\/)\.git(?:\/|$)/i.test(p))return true;
 if(/(?:^|\/)(?:\.aws|\.ssh|\.azure|\.kube|\.auth)(?:\/|$)/i.test(p))return true;
 if(/(?:^|\/)\.local(?:\/|$)/i.test(p))return true;
 if(/\.(?:zip|7z|tar|tar\.gz|tgz)$/i.test(base))return true;
 if(/^(?:\.env|.+\.env)(?:\..*)?$/i.test(base))return !base.endsWith('.example');
 return /^(?:admin-token\.txt|credentials(?:\..+)?\.json|secrets(?:\..+)?\.json|service[-_]account.*\.json|id_(?:rsa|dsa|ecdsa|ed25519)|\.npmrc|\.?netrc|_netrc|(?:storage-state|storageState|auth-state).*\.json)$/i.test(base)||/\.(?:pem|key|p12|pfx|jks|keystore|tfstate(?:\..*)?|sqlite(?:3)?(?:-.*)?|db(?:3)?(?:-.*)?|dump)$/i.test(base);
}
function safePaths(files){const bad=files.filter(sensitivePath);if(bad.length)throw Error('Private file paths must not be tracked or released:\n'+bad.join('\n'));}
function walk(dir,prefix=''){return readdirSync(dir).flatMap(name=>{const rel=prefix+name,p=path.join(dir,name),stat=lstatSync(p);if(stat.isSymbolicLink())throw Error('Release input contains a symlink: '+rel);return stat.isDirectory()?walk(p,rel+'/'):[rel];});}
function scan(mode,target,extra=[]){
 if(!existsSync(binary))throw Error('Secret scanner is required. Run npm run security:setup first.');
 const result=spawnSync(binary,[mode,target,'--config',config,'--redact=100','--no-banner','--no-color','--ignore-gitleaks-allow','--max-archive-depth=3',...extra],{stdio:'inherit'});
 if(result.error||result.status!==0)throw Error('Secret scan failed. Review redacted findings before committing or releasing.');
}
function viteEnv(){
 const names=Object.keys(process.env);
 for(const name of ['.env','.env.local','.env.production','.env.production.local'])if(existsSync(name))for(const line of readFileSync(name,'utf8').split(/\r?\n/)){const m=/^\s*(?:export\s+)?(VITE_[A-Z0-9_]+)\s*=/.exec(line);if(m)names.push(m[1]);}
 const bad=[...new Set(names)].filter(n=>/^VITE_.*(?:SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE|API_?KEY|ACCESS_?KEY)/i.test(n));
 if(bad.length)throw Error('Credentials must remain server-only; forbidden client environment names: '+bad.join(', '));
}
export function check(args=process.argv.slice(2)){
 if(args[0]==='--artifact'){
  if(!args[1]||!existsSync(args[1]))throw Error('Artifact directory is required.');
  safePaths(walk(args[1]));scan('dir',args[1]);return;
 }
 viteEnv();
 const files=git(['ls-files','-z']).split('\0').filter(Boolean);safePaths(files);
 if(args.includes('--history')){scan('git','.', ['--log-opts=--all --full-history']);return;}
 // Scan the index, including partially staged files, rather than the working copy.
 const temporary=mkdtempSync(path.join(tmpdir(),'vju-secret-scan-'));
 try{
  if(git(['ls-files','--stage']).split('\n').some(line=>line.startsWith('120000 ')))throw Error('Symlinks require an explicit security review.');
  git(['checkout-index','--all','--prefix='+temporary.replaceAll('\\','/')+'/']);
  scan('dir',temporary);
 }finally{rmSync(temporary,{recursive:true,force:true});}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))try{check();}catch(error){console.error(error.message);process.exitCode=1;}
