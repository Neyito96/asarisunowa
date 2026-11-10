const {chromium}=require('playwright');
(async()=>{
const b=await chromium.launch();const out={};
for(const [name,vp] of [['pc',{width:1280,height:900}],['sp',{width:390,height:844}]]){
  const ctx=await b.newContext({viewport:vp,deviceScaleFactor:1,isMobile:name==='sp'});const p=await ctx.newPage();
  const errs=[];p.on('pageerror',e=>errs.push('pageerror '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push('console '+m.text().slice(0,120));});
  const bad=[];p.on('response',r=>{if(r.status()>=400)bad.push(r.status()+' '+r.url().replace('http://localhost:8765',''))});
  await p.goto('http://localhost:8765/library/index.html',{waitUntil:'networkidle'});
  await p.waitForTimeout(1500);
  const r={};
  r.status=await p.textContent('#status');r.snapshot=await p.textContent('#snapshot');
  r.cards=await p.locator('#results > *').count();r.shows=await p.locator('#shows > *').count();
  r.hscroll=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  r.pageLabel=await p.textContent('#page-label');
  r.firstTitles=await p.$$eval('#results h2, #results h3',e=>e.slice(0,3).map(x=>x.textContent.trim().slice(0,40)));
  r.platformLinks=await p.$$eval('#results a',a=>{const h={};a.forEach(x=>{try{const d=new URL(x.href).hostname;h[d]=(h[d]||0)+1}catch(e){}});return h});
  r.brokenImgs=await p.evaluate(()=>[...document.images].filter(i=>i.complete&&i.naturalWidth===0).length);
  await p.screenshot({path:name+'-top.png'});
  // search
  await p.fill('#query','キューバ');await p.click('#search-form button[type=submit]');await p.waitForTimeout(1500);
  r.searchStatus=await p.textContent('#status');r.searchCards=await p.locator('#results > *').count();
  await p.screenshot({path:name+'-search.png'});
  await p.fill('#query','zzzzqqq存在しない');await p.click('#search-form button[type=submit]');await p.waitForTimeout(1200);
  r.noHit=await p.textContent('#status');r.noHitCards=await p.locator('#results > *').count();
  await p.click('#clear-filters');await p.waitForTimeout(1000);
  // detail
  const first=p.locator('#results button, #results article').first();
  try{await first.click({timeout:3000});await p.waitForTimeout(800);r.dialogOpen=await p.evaluate(()=>document.querySelector('#detail').open);await p.screenshot({path:name+'-detail.png'});}catch(e){r.dialogOpen='n/a '+e.message.slice(0,60)}
  r.errs=errs.slice(0,5);r.bad=bad.slice(0,5);out[name]=r;await ctx.close();
}
console.log(JSON.stringify(out,null,1));await b.close();})();
