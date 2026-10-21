// CI-only preview server. experiments/ is not included in Pages publication.
const assert=require('node:assert/strict');
const {chromium,webkit,devices}=require(process.env.LIBRARY_PLAYWRIGHT||'playwright');
(async()=>{
 for(const [engine,type]of [['chromium',chromium],['webkit',webkit]]){
  const browser=await type.launch({headless:true}),context=await browser.newContext({...devices['iPhone 13']}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4174/universe-v0.1/');await page.locator('#results article').first().waitFor();
  assert.equal(await page.locator('.stratum').count(),7);assert.equal(await page.locator('.month').count(),84);assert.ok((await page.locator('body').textContent()).includes('母集団は監査中'));
  const link=await page.locator('#results a').first().getAttribute('href');assert.match(link,/^https:\/\/neyito96\.github\.io\/asarisunowa\/library\/\?ep=EP-\d{5}$/);
  await page.locator('#topic').selectOption('文化');assert.ok(await page.locator('#results article').count()>0);
  await page.locator('.month.has-sample').first().click();assert.equal(await page.locator('.month[aria-pressed=true]').count(),1);assert.ok((await page.locator('#selection').textContent()).includes('文化'));
  await page.locator('#query').fill('<script>bad</script>');assert.equal(await page.locator('#results article').count(),0);assert.equal(await page.locator('#results script').count(),0);assert.ok((await page.locator('#results').textContent()).includes('有無は示しません'));
  await page.locator('#clear').click();assert.ok(await page.locator('#results article').count()>0);assert.equal(await page.locator('.month[aria-pressed=true]').count(),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
  if(process.env.LIBRARY_SCREENSHOT_DIR)await page.screenshot({path:process.env.LIBRARY_SCREENSHOT_DIR+'/universe-'+engine+'.png',fullPage:true});
  console.log(JSON.stringify({surface:'universe-v0.1',engine,viewport:'iPhone 13',checks:'JST years/months, topic/month/query, EP-ID link, audit disclaimer, no totals, empty, clear, XSS, overflow',errors}));await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
