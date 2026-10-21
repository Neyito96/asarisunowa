// Standalone browser acceptance test. Run after serving public/ on port 4173.
const assert = require('node:assert/strict');
const { chromium, webkit, devices } = require(process.env.LIBRARY_PLAYWRIGHT || 'playwright');
(async () => {
  for (const [name, type] of [['chromium', chromium], ['webkit', webkit]]) {
    const browser = await type.launch({ headless: true });
    const context = await browser.newContext({ ...devices['iPhone 13'] });
    const page = await context.newPage();
    const requests = [], errors = [];
    page.on('request', r => requests.push(r.url()));
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(process.env.LIBRARY_TEST_URL || 'http://127.0.0.1:4173/library/');
    const base = page.url();
    await page.waitForFunction(() => document.querySelectorAll('.episode').length === 40);
    assert.equal(requests.filter(x => x.includes('/search/')).length, 0);
    assert.equal(requests.filter(x => x.includes('/details/')).length, 0);
    assert.equal(requests.filter(x => x.includes('/pages/')).length, 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.locator('#next').click();
    await page.waitForFunction(() => document.querySelector('#page-label').textContent.startsWith('2 /'));
    await page.locator('#show').selectOption('ドーナツ');
    await page.waitForFunction(() => document.querySelector('#status').textContent === '60件');
    await page.locator('#order').selectOption('oldest');
    await page.waitForFunction(() => document.querySelector('#results').getAttribute('aria-busy') === 'false');
    await page.locator('#next').click();
    await page.waitForFunction(() => document.querySelectorAll('.episode').length === 20);
    await page.locator('#query').fill('寺下真理加');
    await page.locator('#query').press('Enter');
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('検索結果') && document.querySelector('#results').getAttribute('aria-busy') === 'false');
    assert.ok(await page.locator('.episode').count() > 0);
    await page.locator('.episode-title').first().click();
    await page.locator('#detail-title').waitFor();
    assert.ok(await page.locator('#detail a').count() > 0);
    await page.locator('#close-detail').click();
    await page.goto(base + '?ep=EP-00281');
    await page.locator('#detail audio').waitFor({ state: 'attached' });
    assert.equal(await page.locator('audio').getAttribute('preload'), 'none');
    assert.equal(requests.filter(x => x.includes('audio.mp3')).length, 0);
    assert.equal(await page.locator('audio').getAttribute('src'), null);
    await page.getByRole('button', { name: '▶ この回を聴く' }).click();
    assert.ok((await page.locator('audio').getAttribute('src')).startsWith('https://'));
    await page.locator('#close-detail').click();
    await page.locator('#query').fill('<script>bad</script>');
    await page.locator('#query').press('Enter');
    await page.waitForFunction(() => document.querySelector('.empty'));
    assert.equal(await page.locator('#results script').count(), 0);
    await page.locator('#clear-filters').click();
    await page.waitForFunction(() => document.querySelectorAll('.episode').length === 40);
    assert.deepEqual(errors, []);
    if (process.env.LIBRARY_SCREENSHOT_DIR) {
      await page.screenshot({ path: `${process.env.LIBRARY_SCREENSHOT_DIR}/library-${name}-mobile.png`, fullPage: true });
    }
    console.log(JSON.stringify({ engine: name, viewport: 'iPhone 13', initialPageRequests: 1, initialSearchRequests: 0, initialDetailRequests: 0, checks: 'pagination, oldest boundary, programme, speaker search, details, official links, no audio preload, empty, XSS, mobile overflow', errors }));
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
