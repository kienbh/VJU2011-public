import { chromium } from '../../qa/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
let calls = [], attempts = 0;
const config = { event: { name: 'VJU2011', date: '2026-11-20', timeZone: 'Asia/Saigon', mode: 'rehearsal', acceptingSubmissions: true, effectsEnabled: true, closingAt: null }, recipients: [{ id: 'general', name: 'Tập thể thầy cô VJU' }] };
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const exceptions = [];
  page.on('pageerror', error => { exceptions.push(error.message); console.error(error.message); });
  await page.route('**/src/main.ts*', route => route.fulfill({ contentType: 'application/javascript', body: `import {mountGreetings} from '/src/greetings/index.ts'; document.body.innerHTML='<button id="launch">Gửi lời chúc</button>'; window.events=[]; window.ui=mountGreetings({onOpenChange:v=>events.push(['open',v]),onConfirmed:()=>events.push(['confirmed']),onPublicCards:c=>events.push(['cards',c.length]),onConfig:c=>events.push(['config'])});document.querySelector('#launch').onclick=()=>ui.open();` }));
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    let status = 200, data;
    if (path === '/api/config') data = config;
    else if (path === '/api/greetings' && request.method() === 'GET') data = { greetings: [] };
    else if (path === '/api/greetings') {
      calls.push({ key: request.headers()['idempotency-key'], body: request.postDataJSON() });
      if (++attempts === 1) { status = 503; data = { error: 'Thử lỗi mạng tạm thời.' }; }
      else data = { id: 'test-receipt', receiptToken: 'receipt-secret', status: 'pending', duplicate: false };
    } else if (path.startsWith('/api/receipts/')) data = { status: 'approved', visibility: 'private', recipientName: 'Tập thể thầy cô VJU' };
    else if (path === '/api/admin/greetings') {
      assert.equal(request.headers().authorization, 'Bearer admin-test');
      data = { greetings: [{ id: 'private-test', message: 'PRIVATE ADMIN CONTENT', signature: 'Test', className: '', gift: 'none', visibility: 'private', status: 'pending', recipientName: 'VJU', createdAt: '' }] };
    } else data = { event: config.event };
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.goto(process.env.QA_URL || 'http://127.0.0.1:5173');
  await page.locator('#launch').click();
  await page.locator('[data-tab="compose"]').click();
  assert.equal(await page.locator('input[value="private"]').isChecked(), true);
  await page.locator('textarea[name="message"]').fill('Cảm ơn thầy cô đã đồng hành cùng chúng em. <script>alert(1)</script>');
  await page.locator('input[name="signature"]').fill('Người học');
  await page.locator('#vg-compose button[type="submit"]').click();
  assert.equal(await page.locator('.vg-content script').count(), 0);
  await page.locator('[data-action="submit"]').click();
  await page.getByText('Thử lỗi mạng tạm thời.', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => events.filter(e => e[0] === 'confirmed').length), 0);
  await page.locator('[data-action="submit"]').click();
  await page.getByText('Máy chủ đã nhận thiệp của bạn.', { exact: true }).waitFor();
  assert.equal(calls.length, 2);
  assert.equal(calls[0].key, calls[1].key);
  assert.equal(calls[1].body.visibility, 'private');
  assert.equal(await page.evaluate(() => events.filter(e => e[0] === 'confirmed').length), 1);
  await page.locator('[data-action="receipt"]').click();
  await page.getByText('Đã được duyệt', { exact: true }).waitFor();
  await page.locator('[data-tab="board"]').click();
  assert.equal(await page.locator('.vg-board .vg-card').count(), 0);
  await page.locator('[data-tab="admin"]').click();
  await page.locator('input[name="token"]').fill('admin-test');
  await page.locator('#vg-admin-login button').click();
  await page.getByText('PRIVATE ADMIN CONTENT', { exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('dialog').open);
  assert.equal(await page.locator('#launch').evaluate(el => el === document.activeElement), true);
  assert.equal(await page.locator('dialog').textContent().then(x => x.includes('PRIVATE ADMIN CONTENT')), false);
  assert.equal(await page.evaluate(() => Object.values(localStorage).join('').includes('admin-test')), false);
  assert.equal(await page.evaluate(() => Object.values(sessionStorage).join('').includes('admin-test')), false);
  await page.locator('#launch').click();
  await page.locator('[data-tab="admin"]').click();
  await page.locator('input[name="token"]').waitFor();
  assert.equal(await page.evaluate(() => document.querySelector('dialog').scrollWidth <= document.querySelector('dialog').clientWidth + 1), true);
  assert.deepEqual(exceptions, []);
  console.log('PASS private default, escaped content, failed-send draft retention, stable retry key, server-confirmed receipt, private board exclusion, admin token memory-only, close cleanup/focus, mobile width; no browser exceptions.');
} finally { await browser.close(); }
