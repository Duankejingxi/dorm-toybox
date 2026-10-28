const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const root = path.resolve(__dirname, '..');
  const server = http.createServer((req, res) => {
    const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404).end(); return; }
      res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
      res.end(data);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('https://**/*', route => route.abort());
    await page.clock.install();
    await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error('存储已满'); }; });
    await page.goto(url + '#timer');
    await page.evaluate(() => document.querySelector('[data-minutes="15"]').click());
    await page.locator('#timerStartBtn').click();
    await page.clock.fastForward(5 * 60 * 1000);
    assert.equal(await page.locator('#timerDisplay').textContent(), '10:00');
    await page.locator('#timerStartBtn').click();
    await page.clock.fastForward(60 * 1000);
    assert.equal(await page.locator('#timerDisplay').textContent(), '10:00');
    await page.locator('#timerStartBtn').click();
    await page.clock.fastForward(10 * 60 * 1000);
    assert.equal(await page.locator('#timerDisplay').textContent(), '00:00');
    assert.match(await page.locator('#tomatoCount').textContent(), /1 个番茄/);
    await page.clock.fastForward(60 * 1000);
    assert.match(await page.locator('#tomatoCount').textContent(), /1 个番茄/);
    await page.locator('#timerResetBtn').click();
    assert.equal(await page.locator('#timerDisplay').textContent(), '15:00');
    assert.deepEqual(errors, []);
    console.log('PASS: 后台时间跳跃、暂停继续、完成只计一次、存储不可用、重置时长');
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exit(1); });
