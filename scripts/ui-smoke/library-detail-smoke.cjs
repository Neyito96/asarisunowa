const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const out={};
for(const [n,vp] of [['pc',{width:1280,height:900}],['sp',{width:390,height:844}]]){
const p=await (await b.newContext({viewport:vp})).newPage();
await p.goto('http://localhost:8765/library/index.html',{waitUntil:'networkidle'});await p.waitForTimeout(1200);
const r={};
// sample 25 episodes across page 1, open detail and collect links + duplicates in cast
const titles=p.locator('#results .episode-title');const cnt=await titles.count();r.cnt=cnt;
const hosts={};let noLinks=0,dupCast=0,badHref=0,descEmpty=0,opened=0;const samples=[];
for(let i=0;i<Math.min(cnt,40);i++){
 await titles.nth(i).click();await p.waitForTimeout(250);
 const d=await p.evaluate(()=>{const dlg=document.querySelector('#detail');const links=[...dlg.querySelectorAll('a')].map(a=>a.href);return {open:dlg.open,links,text:dlg.innerText}});
 if(d.open)opened++;
 const ext=d.links.filter(h=>/^https?:/.test(h));if(!ext.length)noLinks++;
 ext.forEach(h=>{try{const u=new URL(h);hosts[u.hostname]=(hosts[u.hostname]||0)+1;if(/spotify/.test(u.hostname)&&!/\/episode\//.test(u.pathname))badHref++;}catch(e){badHref++}});
 const names=(d.text.match(/(?:出演|出演者)[^\n]*\n?([^\n]+)/)||[])[1];
 if(names){const arr=names.split(/\s*\/\s*/);if(new Set(arr).size<arr.length)dupCast++;}
 if(i===0){samples.push(d.text.slice(0,300));await p.screenshot({path:n+'-detail.png'});}
 await p.keyboard.press('Escape');
}
r.opened=opened;r.noLinks=noLinks;r.dupCast=dupCast;r.badSpotify=badHref;r.hosts=hosts;r.sample=samples[0];
// pagination
await p.click('#next');await p.waitForTimeout(700);r.page2=await p.textContent('#page-label');
// show filter
await p.selectOption('#show',{index:1});await p.waitForTimeout(1000);r.showFilter=await p.textContent('#status');
out[n]=r;}
console.log(JSON.stringify(out,null,1));await b.close();})();
