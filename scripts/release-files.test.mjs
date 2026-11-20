import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {assertTrackedPublic} from './release-files.mjs';

test('ignored local assets cannot silently enter a clean release build',t=>{
 const root=mkdtempSync(path.join(tmpdir(),'vju-public-test-'));
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 execFileSync('git',['init','-q'],{cwd:root});mkdirSync(path.join(root,'public'));
 writeFileSync(path.join(root,'.gitignore'),'public/private-notes.txt\n');
 writeFileSync(path.join(root,'public','safe.txt'),'reviewed public fixture');
 execFileSync('git',['add','.'],{cwd:root});assert.doesNotThrow(()=>assertTrackedPublic(root));
 writeFileSync(path.join(root,'public','private-notes.txt'),'untracked fixture');
 assert.throws(()=>assertTrackedPublic(root),/Untracked public files/);
});
