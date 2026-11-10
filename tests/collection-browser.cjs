// 田「エピソード集」試作の実ブラウザ試験(iPhone 13 / PC)。期待値は公開データから導出。
// 使い方: python3 -m http.server 4173 --directory public & ; node tests/collection-browser.cjs
const assert=require('node:assert/strict');const fs=require('node:fs');
const {chromium,devices}=require(process.env.LIBRARY_PLAYWRIGHT||'playwright');
const base=process.env.COLLECTION_URL||'http://127.0.0.1:4173/collection/',dir=process.env.SITE_DATA_DIR||'public/library/data';
const details=fs.readdirSync(dir+'/details').flatMap(f=>JSON.parse(fs.readFileSync(dir+'/details/'+f,'utf8')));
const withSp=details.filter(e=>e.links.some(l=>/open\.spotify\.com\/episode\//.test(l))&&!e.links.some(l=>/podcasts\.apple\.com/.test(l))&&e.links.some(l=>/asahi\.com\/special\/podcasts\/item/.test(l)));
const pick=withSp.slice(0,2);const out={};
(async()=>{const browser=await chromium.launch({headless:true});
for(const [label,opt] of [['iphone13',{...devices['iPhone 13']}],['pc',{viewport:{width:1280,height:900}}]]){
 const ctx=await browser.newContext({...opt,permissions:['clipboard-read','clipboard-write']}),page=await ctx.newPage(),errors=[],r=[];page.on('pageerror',e=>errors.push(e.message));
 const ok=(n,v,x)=>r.push({n,ok:!!v,...(x?{x}:{})});
 await page.goto(base);await page.waitForFunction(()=>document.querySelectorAll('#show option').length>1,{},{timeout:30000});
 ok('no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 // 検索→追加(2件)
 for(const e of pick){await page.locator('#q').fill(e.title.slice(0,12));await page.locator('#go').click();await page.waitForFunction(()=>/件|ありません/.test(document.querySelector('#status').textContent)&&!/検索中/.test(document.querySelector('#status').textContent),{},{timeout:60000});
  const btn=page.locator('#results li',{hasText:e.title.slice(0,12)}).first().getByRole('button',{name:/追加/});await btn.click();}
 await page.waitForFunction(n=>document.querySelectorAll('#items li').length===n,pick.length,{timeout:20000});ok('items added',await page.locator('#items li').count()===pick.length);
 await page.waitForFunction(()=>/個別リンク:/.test(document.querySelector('#cov').textContent),{},{timeout:20000});
 ok('Spotify shows EXACT for both',(await page.locator('#items .badge.EXACT').count())===pick.length,await page.locator('#cov').innerText());
 await page.locator('#service').selectOption('apple');await page.waitForFunction(()=>!document.querySelector('#items .badge.EXACT'));
 const tx=await page.locator('#items').innerText();ok('Apple: missing is shown honestly with fallback',/未登録\(代替:朝日新聞/.test(tx),tx.slice(0,120));
 ok('no fabricated apple URL in preview',!/podcasts\.apple\.com/.test(await page.locator('#preview').textContent()));
 // 並べ替え
 const first=await page.locator('#items li b').first().innerText();await page.locator('#items li').first().getByRole('button',{name:'下へ'}).click();await page.waitForFunction(f=>document.querySelector('#items li b').textContent!==f,first);ok('reorder works',(await page.locator('#items li b').nth(1).innerText())===first);
 // コピー・共有・メール
 await page.locator('#service').selectOption('spotify');await page.locator('#title').fill('試験の集');
 await page.locator('#copy').click();await page.waitForFunction(()=>/コピー/.test(document.querySelector('#msg').textContent));const clip=await page.evaluate(()=>navigator.clipboard.readText());ok('copied text has titles+spotify urls',pick.every(e=>clip.includes(e.title)&&/open\.spotify\.com\/episode\//.test(clip)));
 await page.locator('#share').click();await page.waitForFunction(()=>/共有URL/.test(document.querySelector('#msg').textContent));const share=await page.evaluate(()=>navigator.clipboard.readText());ok('share url has hash token',/#c=/.test(share));
 ok('mail is mailto:',/^mailto:\?subject=/.test(await page.locator('#mail').getAttribute('href')));
 // 共有URLを別セッションで開く=同じ集/保存の再現
 const ctx2=await browser.newContext({...opt}),p2=await ctx2.newPage();await p2.goto(share.replace(/^https?:\/\/[^/]+/,'http://127.0.0.1:4173'));await p2.waitForFunction(n=>document.querySelectorAll('#items li').length===n,pick.length,{timeout:20000});
 ok('shared link reproduces collection in a fresh browser',(await p2.locator('#title').inputValue())==='試験の集'&&(await p2.locator('#items li').count())===pick.length);await ctx2.close();
 await page.reload();await page.waitForFunction(n=>document.querySelectorAll('#items li').length===n,pick.length,{timeout:20000});ok('local save survives reload',true);
 // ?add= 導線
 await page.goto(base+'?add='+details[0].id);await page.waitForFunction(()=>document.querySelectorAll('#items li').length>0);ok('?add= adds from library/universe links',(await page.locator('#items').innerText()).includes(details[0].title.slice(0,8)));
 ok('no JS errors',errors.length===0,errors.slice(0,2));out[label]=r;await ctx.close();}
await browser.close();const bad=Object.values(out).flat().filter(c=>!c.ok);console.log(JSON.stringify(out,null,1));process.exit(bad.length?1:0);})();
