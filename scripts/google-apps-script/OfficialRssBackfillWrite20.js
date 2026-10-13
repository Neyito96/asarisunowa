/** Explicit manual backfill, test copy ONLY. No triggers, Spotify or production sheets.
 * Run one bounded batch at a time. Every run re-fetches RSS and rechecks ledger/exclusions.
 * Requires OfficialRssDeltaPreview.js and OfficialRssLibraryPreview.js.
 */
function runNewsSchoolBackfillWrite20() {
  const show = 'ニュースの学校';
  const ss = SpreadsheetApp.openById('1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4');
  const ledger = ss.getSheetByName('エピソード台帳');
  const source = ss.getSheetByName('取得元一覧');
  const history = ss.getSheetByName('削除・除外履歴');
  if (!ledger || !source || !history) throw new Error('Missing required test sheet');
  const rows = source.getDataRange().getValues().slice(1).filter(r => String(r[0]).trim() === show);
  const feed = 'https://feeds.megaphone.fm/TASC5851398719';
  if (rows.length !== 1 || String(rows[0][7]).trim() !== feed) throw new Error('RSS source mismatch');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('Another import is running');
  try {
    const all = ledger.getDataRange().getValues();
    if (all[0][0] !== '台帳ID' || all[0][6] !== '外部ID' || all[0][38] !== '人間除外') throw new Error('Ledger columns changed');
    const known = all.slice(1).filter(r => String(r[1]).trim() === show).map(r => ({
      externalId: r[6], title: r[2], pubDate: r[3], link: r[8],
      enclosureUrl: r[14], excluded: !['','未指定','なし','false','0','no'].includes(String(r[38] || '').trim().toLowerCase())
    }));
    const excluded = history.getLastRow() > 1
      ? rssLibraryExcludedHistory_(history.getRange(2, 1, history.getLastRow() - 1, 9).getValues(), show) : [];
    const preview = previewOfficialRssDelta_(feed, known.concat(excluded), 100);
    const candidates = preview.items.filter(x => x.status === 'new' && x.guid);
    // Refuse duplicate IDs, even across other shows.
    const ids = new Set(all.slice(1).map(r => String(r[0])));
    const guids = new Set(all.slice(1).map(r => String(r[6]).trim()).filter(Boolean));
    const maxId = all.slice(1).reduce((n,r) => {
      const m = String(r[0]).match(/^EP-(\d+)$/);
      return m ? Math.max(n, Number(m[1])) : n;
    }, 0);
    const batch = candidates.filter(x => !guids.has(x.guid)).slice(0,20);
    if (!batch.length) {
      const result = {status:'NO_NEW', inspected:preview.inspected, counts:preview.counts, written:0};
      Logger.log(JSON.stringify(result)); return result;
    }
    const values = batch.map((item,i) => {
      const id = 'EP-' + String(maxId+i+1).padStart(5,'0');
      if (ids.has(id)) throw new Error('ID collision: ' + id);
      const date = new Date(item.pubDate);
      if (isNaN(date.getTime())) throw new Error('Invalid RSS date: ' + item.title);
      const r = Array(51).fill('');
      r[0]=id; r[1]=show; r[2]=item.title;
      r[3]=Utilities.formatDate(date,'Asia/Tokyo','yyyy/MM/dd HH:mm');
      r[4]='音声'; r[5]='Megaphone RSS'; r[6]=item.guid;
      r[8]=item.link || ''; r[14]=item.enclosureUrl || '';
      r[16]='未確認'; r[17]=item.enclosureUrl?'記載あり':'未確認';
      r[18]='未確認'; r[20]='未確認'; r[24]='未確認'; r[27]='未確認';
      r[35]='RSSメタデータ解析のみ'; r[36]='未確認'; r[38]='未指定';
      r[39]='過去回補充（RSS照合済）。音声未再生・Spotify未照合。';
      r[44]=feed;
      return r;
    });
    ledger.getRange(ledger.getLastRow()+1,1,values.length,51).setValues(values);
    const result = {status:'WROTE', inspected:preview.inspected, counts:preview.counts,
      written:values.length, firstId:values[0][0], lastId:values[values.length-1][0],
      remainingAtScan:candidates.length-values.length};
    Logger.log(JSON.stringify(result)); return result;
  } finally { lock.releaseLock(); }
}
