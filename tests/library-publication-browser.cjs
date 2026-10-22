const assert=require('node:assert/strict');const fs=require('node:fs/promises');const path=require('node:path');
const {chromium,webkit,devices}=require(process.env.LIBRARY_PLAYWRIGHT||'playwright');
(async()=>{for(const [name,type] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch({headless:true});try{const context=await browser.newContext({...devices['iPhone 13']});const page=await context.newPage();const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 await page.goto('http://127.0.0.1:4173/library/');await page.waitForFunction(()=>document.querySelectorAll('.episode').length===40);
 assert.match(await page.locator('#snapshot').innerText(),/5,848件.*2026-10-22掲載判定/);
 assert.equal(requests.filter(u=>u.includes('/search/')).length,0);assert.equal(requests.filter(u=>u.includes('/scope.json')).length,0);
 await page.locator('#show').selectOption('ニュースの学校');await page.waitForFunction(()=>document.querySelector('#status').textContent==='485件');
 await page.locator('#query').fill('EP-06591');await page.locator('#query').press('Enter');await page.waitForFunction(()=>document.querySelector('.empty'));
 await page.locator('#clear-filters').click();await page.locator('#query').fill('EP-04305');await page.locator('#query').press('Enter');await page.waitForFunction(()=>document.querySelectorAll('.episode').length===1&&document.querySelector('#results').getAttribute('aria-busy')==='false');
 assert.ok((await page.locator('.episode').innerText()).includes('アンコール'));await page.locator('.episode-title').click();await page.locator('#detail-title').waitFor();assert.ok(await page.locator('#detail a').count()>0);
 if(process.env.LIBRARY_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.LIBRARY_SCREENSHOT_DIR,'scope-library-'+name+'.png')});
 const root=process.env.LIBRARY_PREVIEW_ROOT||'/tmp/library-publication-preview';
 await page.route('https://neyito96.github.io/asarisunowa/library/**',async route=>{const u=new URL(route.request().url());const relative=u.pathname.replace('/asarisunowa/library/','');if(relative.includes('..'))throw Error('invalid preview route');await route.fulfill({path:path.join(root,'library',relative),contentType:relative.endsWith('.mjs')?'text/javascript':'application/json',headers:{'Access-Control-Allow-Origin':'*'}});});
 await page.goto('http://127.0.0.1:4173/universe/index.html');await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('掲載対象 5,848件'),{},{timeout:60000});
 assert.match(await page.locator('#status').innerText(),/2026-10-22掲載判定/);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.ok(await page.locator('#space').isVisible());assert.deepEqual(errors,[]);
 if(process.env.LIBRARY_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.LIBRARY_SCREENSHOT_DIR,'scope-universe-'+name+'.png')});
 console.log(JSON.stringify({browser:name,library:5848,universe:5848,school:485,heldExcludedFromSearch:true,adoptedEncorePreserved:true,errors}));
 }finally{await browser.close();}
}})().catch(e=>{console.error(e);process.exit(1)});
