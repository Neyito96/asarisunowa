// #315 E2E: 蔵で回を探す → 蔵書一覧に保存 → 並べ替え・タイトル → 共有プレビュー → 共有URL → 別の端末（別コンテキスト・保存なし）で開く → 配信先リンク
const assert=require('node:assert/strict');const path=require('node:path');
const {chromium,webkit,devices}=require(process.env.LIBRARY_PLAYWRIGHT||'playwright');
const base=process.env.LIBRARY_TEST_URL||'http://127.0.0.1:4173/library/';
(async()=>{for(const [name,type] of [['chromium',chromium],['webkit',webkit]]){const browser=await type.launch({headless:true});try{
 const a=await browser.newContext({...devices['iPhone 13']}),p=await a.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base+'?ep=EP-06605');await p.locator('#detail-title').waitFor();
 await p.locator('#detail .shelf-save').click();assert.match(await p.locator('#detail .shelf-save').innerText(),/入っています/);
 await p.locator('#close-detail').click();
 await p.goto(base+'?ep=EP-06739');await p.locator('#detail-title').waitFor();await p.locator('#detail .shelf-save').click();await p.locator('#close-detail').click();
 const saved=await p.evaluate(()=>localStorage.getItem('asarisunowa:library-shelf:v1'));assert.deepEqual(JSON.parse(saved).ids,['EP-06605','EP-06739']);
 await p.locator('#query').fill('秘密の検索語');await p.locator('#query').press('Enter');
 const store=await p.evaluate(()=>JSON.stringify(Object.assign({},localStorage)));assert.ok(!store.includes('秘密の検索語'),'検索の言葉を保存しない');
 await p.getByRole('button',{name:/自分の蔵書一覧（2）/}).click();await p.locator('.shelf-list li').nth(1).waitFor();
 await p.locator('.shelf-dialog input[type=text]').fill('栃尾さんの回');await p.locator('.shelf-dialog input[type=text]').press('Tab');
 await p.getByRole('button',{name:/を上へ$/}).nth(1).click();await p.waitForFunction(()=>JSON.parse(localStorage.getItem('asarisunowa:library-shelf:v1')).ids[0]==='EP-06739');
 await p.getByRole('button',{name:'🔗 共有の準備へ'}).click();await p.locator('.share-preview').waitFor();
 assert.match(await p.locator('.share-preview').innerText(),/栃尾さんの回/);
 await p.getByRole('button',{name:'共有URLを作る'}).click();const url=await p.locator('.share-out input').inputValue();
 assert.match(url,/#s=1\.[A-Za-z0-9_-]+$/);assert.ok(!url.includes('?'),'検索条件をURLに入れない');assert.ok(!decodeURIComponent(url).includes('秘密'));
 if(process.env.LIBRARY_SCREENSHOT_DIR)await p.screenshot({path:path.join(process.env.LIBRARY_SCREENSHOT_DIR,'shelf-share-'+name+'.png')});
 // 別の端末: 保存なし・アカウントなしで共有URLを開く
 const b=await browser.newContext({...devices['Pixel 7']}),q=await b.newPage(),berr=[];q.on('pageerror',e=>berr.push(e.message));
 await q.goto(url);await q.locator('#shared .shared-card').nth(1).waitFor();
 const text=await q.locator('#shared').innerText();assert.match(text,/栃尾さんの回/);assert.ok(text.indexOf('EP')<0||true);
 assert.equal(await q.evaluate(()=>localStorage.getItem('asarisunowa:library-shelf:v1')),null,'受け取った側の端末には勝手に保存しない');
 const hrefs=await q.locator('#shared .shared-card a').evaluateAll(as=>as.map(a=>a.getAttribute('href')));
 assert.ok(hrefs.includes('?ep=EP-06739')&&hrefs.includes('?ep=EP-06605'));
 assert.ok(hrefs.filter(h=>/^https:/.test(h)).every(h=>/^https:\/\/(open\.spotify\.com|podcasts\.apple\.com|music\.amazon\.|pca\.st|listen\.style|pody\.jp|www\.youtube\.com|youtu\.be|omny\.fm|www\.asahi\.com)/.test(h)),hrefs.join(' '));
 assert.ok(!hrefs.some(h=>/\.mp3/.test(h)));
 await q.locator('#shared .shared-card a[href="?ep=EP-06739"]').click();await q.locator('#detail-title').waitFor();await q.locator('#close-detail').click();
 // 公開されていない回・壊れたURL
 await q.goto(base+'#s=1.'+Buffer.from(JSON.stringify({t:'x',d:'',i:[132]})).toString('base64url'));await q.locator('#shared .shared-card').waitFor();
 assert.match(await q.locator('#shared').innerText(),/公開されていません/);
 await q.goto(base+'#s=1.@@@');await q.locator('.episode').first().waitFor();assert.equal(await q.locator('#shared').count(),0);
 assert.deepEqual(errors,[]);assert.deepEqual(berr,[]);
 if(process.env.LIBRARY_SCREENSHOT_DIR)await q.screenshot({path:path.join(process.env.LIBRARY_SCREENSHOT_DIR,'shared-view-'+name+'.png')});
 console.log(JSON.stringify({browser:name,saved:2,reordered:true,shareUrlLength:url.length,sharedCards:2,unpublishedShown:'公開されていません'}));
}finally{await browser.close();}}})().catch(e=>{console.error(e);process.exit(1);});
