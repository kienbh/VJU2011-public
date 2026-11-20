import {createAppServer} from '../server/app.mjs';
import {randomBytes} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.VJU_PLAYWRIGHT_MODULE||'playwright');
const rows=JSON.parse(readFileSync('content/reflections/original-public.json','utf8'));
const dir=path.resolve('.local/public-browser');mkdirSync(dir,{recursive:true});
const app=createAppServer({dbPath:':memory:',staticRoot:path.resolve('dist'),trialAccounts:true,seedSamples:false,adminToken:randomBytes(32).toString('hex'),logger:()=>{}});
await new Promise(r=>app.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+app.address().port;
const browser=await chromium.launch({channel:'msedge',headless:true}),results=[],errors=[],requests=[];
try {
 for(const [width,height,lang] of [[1440,900,'vi'],[390,844,'vi'],[1440,900,'ja'],[390,844,'ja']]) {
  const context=await browser.newContext({viewport:{width,height},isMobile:width<600,hasTouch:width<600});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(base+'/'))requests.push(r.url());});
  page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+new URL(r.url()).pathname);});
  await page.goto(base+'/?lang='+lang);await page.locator('.participation-intro img').waitFor();
  assert(await page.locator('.participation-intro img').evaluate(i=>i.complete&&i.naturalWidth>0));
  await page.screenshot({path:path.join(dir,`welcome-${width}-${lang}.png`)});
  const response=await context.request.post(base+'/api/auth/guest',{headers:{Origin:base},data:{mode:'anonymous'}});assert.equal(response.status(),200);
  await page.goto(base+'/?lang='+lang+'&panel=reflections');
  const reader=page.locator('.reflection-reader[open]');await reader.waitFor({timeout:45000});
  for(let i=0;i<rows.length;i++) {
   await page.waitForFunction(({expected})=>document.querySelector('.reflection-reader blockquote')?.textContent?.includes(expected),{expected:lang==='ja'?rows[i].jaContent:rows[i].content});
   if(i<rows.length-1)await reader.locator('[data-step="1"]').click();
  }
  assert(await reader.evaluate(d=>d.scrollWidth<=d.clientWidth+1));
  await page.screenshot({path:path.join(dir,`reader-${width}-${lang}.png`)});
  results.push({width,height,lang,originalEntries:rows.length,projectMarkLoaded:true});await context.close();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
 writeFileSync(path.join(dir,'results.json'),JSON.stringify({results,errors,externalRequests:requests,realPhone:false,realSso:false,scope:'isolated localhost; synthetic guest; original public copy'},null,2)+'\n');
 console.log(JSON.stringify({passed:results.length,entriesPerViewport:rows.length,errors,externalRequests:requests}));
}finally{await browser.close();app.closeAllConnections();await new Promise(r=>app.close(r));}
