'use strict';
/** Phase15 W cleaner — retained related articles, without promotional sections. */
function cleanDescriptionRetainArticles(html) {
  const entities = {'&nbsp;':' ','&amp;':'&','&hellip;':'…','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'",'&darr;':'↓'};
  const decode = s => s.replace(/&(?:nbsp|amp|hellip|lt|gt|quot|darr);|&#39;/gi, m => entities[m.toLowerCase()] || m);
  const lines = decode(String(html).replace(/<p(?:\\s[^>]*)?>/gi,'\\n\\n').replace(/<\\/p>/gi,'\\n\\n')
    .replace(/<br\\s*\\/?>/gi,'\\n').replace(/<a\\b[^>]*>/gi,'').replace(/<\\/a>/gi,'')
    .replace(/<[^>]*>/g,'')).replace(/\\r/g,'').split('\\n').map(x=>x.trim()).filter(Boolean);
  let mode='body';const body=[], related=[];
  for (const line of lines) {
    if (/^【関連記事】/.test(line)) {mode='articles';related.push('【関連記事】');continue;}
    if (/^【(?:出演|出演・スタッフ|おねがい|朝ポキ情報)/.test(line)) mode='skip';
    if (mode==='skip') continue;
    if (mode==='body') {
      if (/^(?:★Q&Aのご感想|★朝日新聞アプリ|【朝日地球会議への申し込み|有料会員が選定！)/.test(line)) {mode='skipUntilArticles';continue;}
      if (/吹奏楽のほかの回はこちら/.test(line)) {const m=line.match(/※\\d{4}年\\d{1,2}月\\d{1,2}日に収録しました。/);if(m)body.push(m[0]);continue;}
      body.push(line);
    } else if (mode==='articles') {
      if (/ニュースレター.*登録はこちら/.test(line)) {mode='skip';continue;}
      related.push(line);
    }
  }
  return body.join('\\n')+(related.length?'\\n\\n'+related.join('\\n'):'');
}
if (typeof module !== 'undefined') module.exports={cleanDescriptionRetainArticles};
