import {mkdir,writeFile,readFile,chmod,copyFile} from 'node:fs/promises';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const version='8.30.1';
const platform=process.platform==='win32'?'windows':process.platform;
const archives={
 windows_x64:['zip','d29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e'],
 linux_x64:['tar.gz','551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb'],
};
const selected=archives[`${platform}_${process.arch}`];
if(!selected)throw Error('Security setup currently supports Windows x64 and Linux x64.');
const dir=path.join(root,'.local/security/tools');await mkdir(dir,{recursive:true});
const name=`gitleaks_${version}_${platform}_x64.${selected[0]}`,archive=path.join(dir,name);
const response=await fetch(`https://github.com/gitleaks/gitleaks/releases/download/v${version}/${name}`);
if(!response.ok)throw Error(`Gitleaks download failed: HTTP ${response.status}`);
const bytes=Buffer.from(await response.arrayBuffer());
if(createHash('sha256').update(bytes).digest('hex')!==selected[1])throw Error('Gitleaks archive checksum mismatch.');
await writeFile(archive,bytes);
execFileSync('tar',['-xf',archive,'-C',dir,platform==='windows'?'gitleaks.exe':'gitleaks'],{stdio:'inherit'});
const binary=path.join(dir,platform==='windows'?'gitleaks.exe':'gitleaks');if(platform!=='windows')await chmod(binary,0o755);
console.log(`Installed verified Gitleaks ${version}.`);
if(process.argv.includes('--hooks')){
 const common=path.resolve(execFileSync('git',['rev-parse','--git-common-dir'],{encoding:'utf8'}).trim());
 const configured=spawnSync('git',['config','--get','core.hooksPath'],{encoding:'utf8'});
 if(configured.status!==1)throw Error('An existing core.hooksPath needs review; no hooks were replaced.');
 const hooks=path.join(common,'hooks'),installed=path.join(common,'security-guard');
 const marker='# VJU2011 managed secret guard';
 for(const name of ['pre-commit','pre-push']){
  let prior='';try{prior=await readFile(path.join(hooks,name),'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
  if(prior&&!prior.includes(marker))throw Error(`Existing ${name} hook needs review; no hooks were replaced.`);
 }
 await mkdir(path.join(installed,'scripts'),{recursive:true});await mkdir(path.join(installed,'.local/security/tools'),{recursive:true});await mkdir(hooks,{recursive:true});
 await copyFile(path.join(root,'scripts/security-check.mjs'),path.join(installed,'scripts/security-check.mjs'));
 await copyFile(path.join(root,'.gitleaks.toml'),path.join(installed,'.gitleaks.toml'));
 const installedBinary=path.join(installed,'.local/security/tools',path.basename(binary));await copyFile(binary,installedBinary);if(platform!=='windows')await chmod(installedBinary,0o755);
 for(const [name,arg] of [['pre-commit',''],['pre-push','--history']]){
  const hook=path.join(hooks,name);
  await writeFile(hook,`#!/bin/sh\n${marker}\nhook_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)\nexec node "$hook_dir/../security-guard/scripts/security-check.mjs" ${arg}\n`,{mode:0o755});await chmod(hook,0o755);
 }
 console.log('Installed pre-commit and pre-push guards in the shared Git directory for all local worktrees.');
}
