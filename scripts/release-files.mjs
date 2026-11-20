import {execFileSync} from 'node:child_process';
import {readdirSync,lstatSync} from 'node:fs';
import path from 'node:path';

export function listFiles(root,prefix='') {
 return readdirSync(root).flatMap(name=>{
  const rel=prefix+name, absolute=path.join(root,name), stat=lstatSync(absolute);
  if(stat.isSymbolicLink())throw Error('Release input contains a symlink: '+rel);
  if(stat.isDirectory())return listFiles(absolute,rel+'/');
  if(!stat.isFile())throw Error('Release input is not a regular file: '+rel);
  return [rel];
 }).sort();
}

export function assertTrackedPublic(root=process.cwd()) {
 const tracked=new Set(execFileSync('git',['ls-files','-z','--','public'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean));
 const extra=listFiles(path.join(root,'public'),'public/').filter(file=>!tracked.has(file));
 if(extra.length)throw Error('Untracked public files would enter the release (including ignored files):\n'+extra.join('\n'));
}
