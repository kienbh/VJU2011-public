import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {spawnSync,execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sensitivePath} from './security-check.mjs';
const script=fileURLToPath(new URL('./security-check.mjs',import.meta.url));
function fixture(t){const dir=mkdtempSync(path.join(tmpdir(),'vju-security-test-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));execFileSync('git',['init','-q'],{cwd:dir});return dir;}
const scan=(cwd,args=[],env={})=>spawnSync(process.execPath,[script,...args],{cwd,env:{...process.env,...env},encoding:'utf8'});
test('credential filenames and archives are blocked; source and templates remain valid',()=>{
 for(const p of ['prod.env','public/.env.local','admin-token.txt','nested/credentials.json','private.pfx','id_ed25519','playwright/.auth/user.json','backup.zip','dump.sqlite3','storageState.json'])assert.equal(sensitivePath(p),true,p);
 for(const p of ['server/sso.mjs','.env.example','deploy/rehearsal.env.example','src/greetings/index.ts'])assert.equal(sensitivePath(p),false,p);
});
test('scans staged contents, redacts matches, and refuses credentials even when ignored',t=>{
 const dir=fixture(t),secret=randomBytes(24).toString('hex');
 writeFileSync(path.join(dir,'config.js'),['const pass','word = '].join('')+JSON.stringify(secret)+';\n');
 execFileSync('git',['add','config.js'],{cwd:dir});writeFileSync(path.join(dir,'config.js'),'// clean working copy\n');
 const result=scan(dir);assert.notEqual(result.status,0);assert(!(result.stdout+result.stderr).includes(secret));assert.match(result.stdout+result.stderr,/Secret scan failed/);
 execFileSync('git',['add','config.js'],{cwd:dir});assert.equal(scan(dir).status,0);
 writeFileSync(path.join(dir,'.env'),'EXAMPLE=value\n');execFileSync('git',['add','.env'],{cwd:dir});assert.match(scan(dir).stderr,/Private file paths/);
});
test('release artifact guard catches private files, secrets and unsafe client env',t=>{
 const dir=fixture(t),dist=path.join(dir,'dist');mkdirSync(dist);
 writeFileSync(path.join(dist,'admin-token.txt'),'dummy-test-data');assert.notEqual(scan(dir,['--artifact',dist]).status,0);rmSync(path.join(dist,'admin-token.txt'));
 const fake=['ghp_',randomBytes(18).toString('hex')].join('');writeFileSync(path.join(dist,'app.js'),'const accessToken = '+JSON.stringify(fake));
 const found=scan(dir,['--artifact',dist]);assert.notEqual(found.status,0);assert(!(found.stdout+found.stderr).includes(fake));
 rmSync(path.join(dist,'app.js'));writeFileSync(path.join(dist,'index.html'),'<title>Safe fixture</title>');assert.equal(scan(dir,['--artifact',dist]).status,0);
 assert.match(scan(dir,[],{VITE_CLIENT_SECRET:'dummy-test-value'}).stderr,/server-only/);
});
