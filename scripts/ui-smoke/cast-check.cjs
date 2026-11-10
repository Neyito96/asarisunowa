const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8765/library/index.html',{waitUntil:'networkidle'});await p.waitForTimeout(1200);
await p.fill('#query','キューバ');await p.click('#search-form button[type=submit]');await p.waitForTimeout(1200);
console.log(await p.$eval('#results',e=>e.innerText.slice(0,200)),JSON.stringify(errs));await b.close()})()
