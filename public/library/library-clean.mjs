// Reused unchanged from LibraryV3.js (PR #234, 2026-10-18).
function libV3Clean_(text){
 // Mechanical rendering only: preserve words, URLs and names, never summarize.
 return String(text||'').replace(/<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi,(_,q,url,label)=>label===url?label:label+' '+url).replace(/\\r\\n|\\n|\\r|\r\n?|\n/g,' ').replace(/<br\s*\/?\s*>|<\/(?:p|div|li)>/gi,' ')
 .replace(/<(https?:\/\/[^<>\s]+)>/g,'$1').replace(/<[^>]*>/g,' ').replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g,x=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '})[x])
 .replace(/&#(x[0-9a-f]+|[0-9]+);/gi,(x,n)=>{const c=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return c>0&&c<=0x10ffff?String.fromCodePoint(c):x;}).replace(/\s+/g,' ').trim();
}

export { libV3Clean_ as cleanDescription };
