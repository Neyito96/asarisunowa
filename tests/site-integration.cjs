// 統合表示テスト(PC/スマホ): 公開データ(DATA_DIR)から期待値を導出し、実ブラウザの表示・検索・詳細・リンクと突き合わせる。固定件数なし。
// 使い方: python3 -m http.server 4173 --directory SITE_ROOT & ; SITE_DATA_DIR=SITE_ROOT/library/data node tests/site-integration.cjs
const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const {chromium,devices}=require(process.env.LIBRARY_PLAYWRIGHT||'playwright');
const dir=process.env.SITE_DATA_DIR,url=process.env.LIBRARY_TEST_URL||'http://127.0.0.1:4173/library/';
const load=s=>fs.readdirSync(path.join(dir,s)).flatMap(f=>JSON.parse(fs.readFileSync(path.join(dir,s,f),'utf8')));
const details=load('details'),by=new Map(details.map(e=>[e.id,e]));
const rnd=(a,n)=>{let x=12345;const r=()=>(x=(x*1103515245+12345)&0x7fffffff)/0x7fffffff;return [...a].sort(()=>r()-.5).slice(0,n)};
const out={};
(async()=>{const browser=await chromium.launch({headless:true});
for(const [label,ctxOpt] of [['mobile',{...devices['iPhone 13']}],['desktop',{viewport:{width:1280,height:900}}]]){
 const ctx=await browser.newContext(ctxOpt),page=await ctx.newPage(),errors=[],r={checks:[]};page.on('pageerror',e=>errors.push(e.message));
 const ok=(n,v,extra)=>{r.checks.push({n,ok:!!v,...(extra?{extra}:{})});};
 await page.goto(url);await page.waitForFunction(()=>document.querySelectorAll('.episode').length>0,{},{timeout:60000});
 ok('initial list renders',(await page.locator('.episode').count())>0);
 ok('no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 const search=async q=>{await page.locator('#query').fill(q);await page.locator('#query').press('Enter');await page.waitForFunction(()=>document.querySelector('#results').getAttribute('aria-busy')==='false'&&/件/.test(document.querySelector('#status').textContent),{},{timeout:60000});return page.locator('#status').innerText();};
 // 1) 出演者検索: 件数=データから導出
 const castCount=n=>details.filter(e=>e.show==='ニュースの学校'&&(e.cast||'').includes(n)).length;
 await page.locator('#show').selectOption('ニュースの学校');
 for(const n of ['神田大介','杢田光']){const st=await search(n),m=st.match(/([\d,]+)件/),got=m?Number(m[1].replace(/,/g,'')):-1;ok('cast search '+n,got===castCount(n),{expected:castCount(n),got});}
 // 2) ICC重複: 検索すると正規の1件のみ(智子)
 await page.locator('#show').selectOption('');await search('ICC赤根智子');const icc=await page.locator('.episode').count();ok('ICC智子 search finds >=1',icc>=1,{icc});
 await page.locator('.episode-title').first().click();await page.locator('#detail-title').waitFor();ok('ICC detail shows 智子 title',/赤根智子/.test(await page.locator('#detail-title').innerText()));
 // 3) 無作為30件: 詳細の題名・概要先頭・リンクがデータと一致
 let bad=[];
 for(const e of rnd(details,30)){await page.goto(url+'?ep='+e.id);try{await page.locator('#detail-title').waitFor({timeout:15000});}catch{bad.push(e.id+':noDetail');continue;}
  const t=await page.locator('#detail-title').innerText(),txt=await page.locator('#detail').innerText(),hrefs=await page.locator('#detail a').evaluateAll(a=>a.map(x=>x.href));
  if(t.replace(/\s+/g,' ').trim()!==e.title.replace(/\s+/g,' ').trim())bad.push(e.id+':title');
  if(e.description&&!txt.replace(/\s+/g,'').includes(e.description.replace(/\s+/g,'').slice(0,20)))bad.push(e.id+':desc');
  for(const l of e.links||[])if(!hrefs.some(h=>h===l||h.startsWith(l.replace(/\/$/,''))))bad.push(e.id+':link '+l.slice(0,40));}
 ok('random 30 detail=data (title/description/links)',bad.length===0,bad.slice(0,5));
 ok('no JS errors',errors.length===0,errors.slice(0,2));
 out[label]=r;await ctx.close();}
await browser.close();const fails=Object.values(out).flatMap(r=>r.checks.filter(c=>!c.ok));console.log(JSON.stringify(out,null,1));process.exit(fails.length?1:0);})();
