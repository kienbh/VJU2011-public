import {createServer} from 'vite';
import {createAppServer} from '../server/app.mjs';
import {mkdir,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import path from 'node:path';import {DatabaseSync} from 'node:sqlite';import {createHash,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.VJU_PLAYWRIGHT_MODULE||'playwright');
const dir='qa/moderation-controls/browser';await mkdir(dir,{recursive:true});
const token='qa-only-'.repeat(8),url='http://127.0.0.1:5521';
const temp=await mkdtemp(path.join(tmpdir(),'vju-moderation-ui-')),dbPath=path.join(temp,'qa.sqlite'),issuer='https://qa.test';
const api=createAppServer({dbPath,moderationGrants:()=>[{issuer,subject:'mod',role:'moderator'}],ssoConfig:{issuer,clientId:'qa',clientSecret:'qa',jwtSecret:'qa'.repeat(32),appOrigin:url},adminToken:token,seedSamples:false,trialAccounts:true,publicOnly:true,devOrigin:url,logger:()=>{}});
await new Promise(r=>api.listen(0,'127.0.0.1',r));
const db=new DatabaseSync(dbPath),session=randomUUID();db.prepare('INSERT INTO garden_sessions VALUES(?,?,?,?,?)').run(createHash('sha256').update(session).digest('hex'),issuer,'mod','QA Moderator',Date.now()+600000);db.close();
const testMain=`import {mountGreetings} from '/src/greetings/index.ts';import {mountSharedGarden} from '/src/greetings/sharedGarden.ts';import {createFlowerLoop} from '/src/festival/flowerLoop.ts';
 document.body.innerHTML='<button id="admin">Quản trị</button><button id="compose">Viết thiệp</button><button id="garden">Cắm hoa</button>';
 document.body.style.cssText='font:16px system-ui;background:#efe4cd';
 if(!new URLSearchParams(location.search).has('moderator'))await fetch('/api/auth/guest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'anonymous'})});
 window.ui=mountGreetings({showAdmin:true,onOpenChange:()=>{},onConfirmed:()=>{},onPublicCards:()=>{},onConfig:c=>window.cfg=c});
 window.garden=mountSharedGarden({local:()=>createFlowerLoop(Date.now(),['rose']),consume:()=>{},pause:()=>{},view:()=>{}});
 document.querySelector('#admin').onclick=()=>ui.openAdmin();document.querySelector('#compose').onclick=()=>ui.openCompose();document.querySelector('#garden').onclick=()=>garden.open();`;
const vite=await createServer({plugins:[{name:'approval-qa',enforce:'pre',transform(code,id){if(id.replaceAll('\\','/').endsWith('/src/entry.ts'))return testMain;}}],server:{port:5521,host:'127.0.0.1',strictPort:true,proxy:{'/api':`http://127.0.0.1:${api.address().port}`}}});await vite.listen();
let lastPage;
const browser=await chromium.launch({channel:'msedge',headless:true}),errors=[],results=[];
try{
 for(const [width,height] of [[1440,900],[390,844],[360,740],[844,390]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:width<900,isMobile:width<900});
  const p=await context.newPage();lastPage=p;p.setDefaultTimeout(15000);p.on('dialog',d=>d.accept());p.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});p.on('console',m=>{if(m.type()==='error')console.error(m.text())});
  await p.goto(url);console.log('LOADED',width);await p.waitForFunction(()=>window.cfg);console.log('CONFIG',width);
  await p.locator('#admin').click();await p.locator('[name=token]').fill(token);await p.locator('#vg-admin-login button').click();
  await p.locator('#vg-auto-approval').waitFor();
  const set=async value=>{await p.locator('[name=autoApprove]').setChecked(value);await p.locator('#vg-auto-approval button').click();await p.waitForFunction(v=>window.cfg.event.autoApprove===v,value);await p.locator('#vg-auto-approval button:enabled').waitFor();assert.equal(await p.locator('[name=autoApprove]').isChecked(),value);};
  await set(true);await p.screenshot({path:`${dir}/admin-${width}.png`});
  assert.equal(await p.locator('dialog.vju-greetings').evaluate(d=>d.scrollWidth<=d.clientWidth+1),true);
  await p.locator('.vg-close').click();
  // Public greeting is published immediately with the server-returned status.
  const compose=async(auto)=>{
   await p.locator('#compose').click();if(await p.locator('[data-action=new]').count())await p.locator('[data-action=new]').click();await p.locator('[name=message]').fill('Cảm ơn thầy cô. QA local '+width+' '+auto);
   await p.locator('[name=publicConsent]').check();await p.locator('#vg-compose button[type=submit]').click();
   assert.ok((await p.locator('.vg-content').textContent()).includes(auto?'Công khai ngay sau khi gửi':'Công khai sau khi duyệt'));
   const response=p.waitForResponse(r=>r.url().endsWith('/api/greetings')&&r.request().method()==='POST');
   await p.locator('[data-action=submit]').click();const data=await (await response).json();assert.equal(data.status,auto?'approved':'pending');
   await p.locator('.vg-receipt').waitFor();assert.ok((await p.locator('.vg-content').textContent()).includes(auto?'Thiệp đã được công khai':'Thiệp sẽ lên bảng'));
   await p.screenshot({path:`${dir}/receipt-${auto?'auto':'manual'}-${width}.png`});await p.locator('.vg-close').click();return data.id;
  };
  const first=await compose(true);
  // Switch to manual through the real admin form, persists across reload.
  await p.locator('#admin').click();await p.locator('[name=token]').fill(token);await p.locator('#vg-admin-login button').click();await set(false);
  await p.reload();await p.waitForFunction(()=>window.cfg?.event.autoApprove===false);
  const waiting=await compose(false);
  await p.locator('#garden').click();await p.locator('#shared-garden-plant').waitFor();await p.locator('[form=shared-garden-plant]:enabled').waitFor();
  assert.ok((await p.locator('dialog.shared-garden-dialog[open]').textContent()).includes('Công khai sau khi duyệt'));
  await p.locator('#shared-garden-plant [name=recipient]').fill('Thầy cô VJU');await p.locator('#shared-garden-plant [name=message]').fill('Cảm ơn thầy cô đã đồng hành cùng chúng em.');
  const potResponse=p.waitForResponse(r=>r.url().endsWith('/api/garden/pots')&&r.request().method()==='POST');
  await p.locator('[form=shared-garden-plant]').click();const pot=(await (await potResponse).json()).pot;assert.equal(pot.status,'pending');
  await p.locator('.sg-pot').waitFor();assert.ok((await p.locator('.sg-pot').textContent()).includes('Đang chờ duyệt'));
  assert.equal(await p.locator('.sg-pot + [data-view]').count(),0);
  assert.equal(await p.evaluate(()=>window.garden.state({planted:[],basket:[]}).planted.some(p=>p&&p.status!=='approved')),false);
  await p.locator('[data-overview]').click();await p.locator('[data-filter=mine]').click();await p.locator('[data-mine]').first().click();await p.locator('.sg-pot').waitFor();
  assert.ok((await p.locator('.sg-pot').textContent()).includes('Đang chờ duyệt'));
  await p.screenshot({path:`${dir}/garden-manual-${width}.png`});await p.locator('dialog.shared-garden-dialog[open] [data-close]').click();
  // Turn on again without auto-publishing pending greeting/pot; reject published item.
  await p.locator('#admin').click();await p.locator('[name=token]').fill(token);await p.locator('#vg-admin-login button').click();await set(true);
  await p.locator(`#vg-admin-status`).selectOption('pending');await p.locator(`[data-moderate=approve][data-id="${waiting}"]`).waitFor();await p.locator(`[data-moderate=approve][data-id="${pot.id}"]`).waitFor();
  await p.locator('[data-admin-source=garden]').click();
  await p.locator('[data-admin-source=garden]').evaluate(e=>e.scrollIntoView());await p.screenshot({path:`${dir}/garden-management-${width}.png`});
  assert.equal(await p.locator(`[data-id="${waiting}"]`).count(),0);
  await p.locator(`[data-garden-edit="${pot.id}"]`).click();
  await p.locator('#vg-garden-edit [name=message]').fill('Cảm ơn thầy cô. Nội dung đã chỉnh sửa '+width);
  await p.screenshot({path:`${dir}/garden-editor-${width}.png`});
  await p.locator('#vg-garden-edit button[type=submit]').click();
  await p.locator('#vg-garden-edit').waitFor({state:'detached'});
  assert.ok((await p.locator('.vg-admin-list').textContent()).includes('Nội dung đã chỉnh sửa '+width));
  await p.locator('[data-admin-source=all]').click();
  await p.locator('#vg-admin-status').selectOption('approved');await p.locator(`[data-moderate=reject][data-id="${first}"]`).click();
  await p.waitForFunction(id=>!document.querySelector(`[data-moderate=reject][data-id="${id}"]`),first);
  const wall=await (await context.request.get(url+'/api/greetings')).json();assert.ok(!wall.greetings.some(g=>[first,waiting,pot.id].includes(g.id)));
  await p.locator('[data-admin-source=garden]').click();await p.locator('#vg-admin-status').selectOption('pending');
  await p.locator(`[data-moderate=approve][data-id="${pot.id}"]`).click();
  await p.waitForFunction(id=>!document.querySelector(`[data-moderate=approve][data-id="${id}"]`),pot.id);
  await p.evaluate(()=>window.garden.refresh());
  assert.equal(await p.evaluate(id=>window.garden.state({planted:[],basket:[]}).planted.some(p=>p?.id===id),pot.id),true);
  await p.locator('#vg-admin-status').selectOption('approved');
  await p.locator(`[data-moderate=reject][data-id="${pot.id}"]`).click();
  await p.waitForFunction(id=>!document.querySelector(`[data-moderate=reject][data-id="${id}"]`),pot.id);
  await p.evaluate(()=>window.garden.refresh());
  assert.equal(await p.evaluate(id=>window.garden.state({planted:[],basket:[]}).planted.some(p=>p?.id===id),pot.id),false);
  // Fresh guest plants on auto; no relation to previous quota.
  await context.close();
  const fresh=await browser.newContext({viewport:{width,height},hasTouch:width<900,isMobile:width<900}),q=await fresh.newPage();q.on('pageerror',e=>errors.push(e.message));
  await q.goto(url);await q.waitForFunction(()=>window.cfg?.event.autoApprove===true);await q.locator('#garden').click();await q.locator('#shared-garden-plant').waitFor();await q.locator('[form=shared-garden-plant]:enabled').waitFor();
  assert.ok((await q.locator('dialog.shared-garden-dialog[open]').textContent()).includes('Công khai ngay sau khi gửi'));
  await q.locator('#shared-garden-plant [name=recipient]').fill('Thầy cô VJU');await q.locator('#shared-garden-plant [name=message]').fill('Cảm ơn thầy cô đã đồng hành cùng chúng em.');
  const reply=q.waitForResponse(r=>r.url().endsWith('/api/garden/pots')&&r.request().method()==='POST');await q.locator('[form=shared-garden-plant]').click();assert.equal((await (await reply).json()).pot.status,'approved');await q.locator('.sg-pot').waitFor();
  assert.ok((await q.locator('.sg-pot').textContent()).includes('Đã công khai'));await q.screenshot({path:`${dir}/garden-auto-${width}.png`});
  await fresh.close();results.push({width,height,autoAndManualGreeting:true,autoAndManualPot:true,adminToggleReload:true,pendingUnchanged:true,reject:true});
 }
 for(const lang of ['vi','ja']){
  const c=await browser.newContext({viewport:{width:390,height:844}});await c.addCookies([{name:'vju_session',value:session,url}]);const p=await c.newPage();lastPage=p;p.on('pageerror',e=>errors.push(e.message));
  await p.goto(url+'/?moderator=1&lang='+lang);await p.waitForFunction(()=>window.cfg);await p.locator('#admin').click();await p.locator('#vg-auto-approval').waitFor();assert.equal(await p.locator('#vg-settings').count(),0);assert.equal(await p.locator('#vg-admin-login').count(),0);
  for(const value of [false,true]){await p.locator('[name=autoApprove]').setChecked(value);await p.locator('#vg-auto-approval button').click();await p.waitForFunction(v=>window.cfg.event.autoApprove===v,value);await p.locator('#vg-auto-approval button:enabled').waitFor();}
  await p.locator('#vg-admin-status').selectOption('approved');await p.locator('[data-moderate=reject]').first().waitFor();const id=await p.locator('[data-moderate=reject]').first().getAttribute('data-id');
  await p.locator('[data-admin-source=garden]').click();await p.locator('#vg-admin-status').selectOption('approved');await p.locator('[data-garden-edit]').first().click();
  await p.locator('#vg-garden-edit [name=message]').fill('SSO moderator updated this flower message.');
  await p.locator('#vg-garden-edit button[type=submit]').click();await p.locator('#vg-garden-edit').waitFor({state:'detached'});
  p.once('dialog',d=>d.dismiss());await p.locator('[data-moderate=reject]').first().click();assert.equal(await p.locator('[data-id="'+id+'"]').count(),2);
  p.once('dialog',d=>d.accept());await p.locator('[data-moderate=reject]').first().click();await p.waitForFunction(id=>!document.querySelector('[data-id="'+id+'"]'),id);
  assert.equal(await p.locator('dialog.vju-greetings').evaluate(d=>d.scrollWidth<=d.clientWidth+1),true);await p.screenshot({path:dir+'/moderator-'+lang+'-390.png'});results.push({role:'moderator',language:lang,toggle:true,settingsHidden:true,removeConfirmed:true});await c.close();
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:results.length,errors}));
}catch(e){console.error(e);if(lastPage&&!lastPage.isClosed()){console.error(await lastPage.locator('body').innerText());await lastPage.screenshot({path:dir+'/failure.png'});}process.exitCode=1;}
finally{await writeFile(`${dir}/results.json`,JSON.stringify({results,errors,realDevices:false,environment:'local in-memory API, isolated UI'},null,2));await browser.close();await vite.close();await new Promise(r=>api.close(r));assert.equal(path.dirname(temp),tmpdir());assert(path.basename(temp).startsWith('vju-moderation-ui-'));await rm(temp,{recursive:true,force:true});}
