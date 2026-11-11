// 清掃品質の回帰fixture（すべて合成文。実在番組の書式だけを模している。実在の本文は含めない）。
// expect: 監査が見つけるべき誤り（bad 候補）と、清掃器が守るべき条件。
const omnyFoot = '<p>【おねがい】<br>朝日新聞ポッドキャストは、みなさまからの購読料で配信しています。<br>番組継続のため、会員登録をお願いします！&nbsp;<a href="http://t.asahi.com/x">http://t.asahi.com/x</a></p> <p>【朝ポキ情報】<br>アプリで記者と対話&nbsp;<a href="http://t.asahi.com/y">http://t.asahi.com/y</a><br>交流はdiscord&nbsp;<a href="https://bit.ly/z">https://bit.ly/z</a></p><p>See <a href="https://omnystudio.com/listener">omnystudio.com/listener</a> for privacy information.</p>';
const megaFoot = '<p>ご意見・感想・リクエスト <a href="https://bit.ly/d">https://bit.ly/d</a>&nbsp;<br>\nほかにも多彩な番組を配信中！&nbsp;<a href="http://t.asahi.com/w">http://t.asahi.com/w</a>&nbsp;</p><p>Learn more about your ad choices. Visit <a href="https://megaphone.fm/adchoices">megaphone.fm/adchoices</a></p>';
const A1 = 'https://www.asahi.com/articles/ASZZ0000AAAA0000001.html', A2 = 'https://www.asahi.com/articles/ASZZ0000BBBB0000002.html';
export const FIXTURES = [
  { id: 'omny-standard', raw: `<p>合成番組の本文一行目です。カメラマンの山田さんがスタジオで「合成の話」を語ります。</p> <p>※2026年1月1日に収録しました。3人のトークは毎週月曜日に配信します</p> <p>【関連リンク】<br>合成記事の見出しその一<br><a href="${A1}?iref=omny">${A1}?iref=omny</a>&nbsp;</p> <p>【出演・スタッフ】<br>合成太郎（記者）&nbsp;<a href="https://bit.ly/a">https://bit.ly/a</a><br>MC 合成花子（編集者）</p> ${omnyFoot}`,
    keep: ['合成番組の本文一行目です', '山田さん', '「合成の話」'], related: [{ url: A1, title: '合成記事の見出しその一' }], staff: ['合成太郎', '合成花子'] },
  { id: 'megaphone-matome', raw: `<p>合成の解説本文です。専門用語「ナントカ効果」を説明します。</p>\n\n<p>【まとめてわかる】合成の見出し？　その背景は<br>\n<a href="${A1}?iref=omny">${A1}?iref=omny</a>&nbsp;</p> \n\n${megaFoot}`,
    keep: ['合成の解説本文です', '「ナントカ効果」'], related: [{ url: A1, title: '合成の見出し？ その背景は' }], staff: [] },
  { id: 'body-looks-like-boilerplate', raw: `<p>リスナーからのおたよりを紹介しながら、配信中の番組づくりの裏側を語ります。</p><p>ご意見の多かった「長さ問題」にも答えます。</p>${megaFoot}`,
    keep: ['リスナーからのおたよりを紹介しながら', '「長さ問題」'], related: [], staff: [] },
  { id: 'multi-articles-and-url-only', raw: `<p>本文の段落です。合成の話題を二つ扱います。</p><p>【関連記事】<br>見出しA<br><a href="${A1}">${A1}</a><br>見出しB<br><a href="${A2}">${A2}</a></p><p><a href="https://bit.ly/only">https://bit.ly/only</a></p>${omnyFoot}`,
    keep: ['本文の段落です'], related: [{ url: A1, title: '見出しA' }, { url: A2, title: '見出しB' }], staff: [] },
  { id: 'schedule-in-body', raw: `<p>この連載の第3回です。次回の配信では合成の続きを話します。</p><p>前半は合成市の取材、後半はスタジオトークです。</p>${omnyFoot}`,
    keep: ['この連載の第3回です', '前半は合成市の取材'], related: [], staff: [] },
  { id: 'entities-cdata', raw: `<![CDATA[<p>A&amp;Bの合成対談&hellip;「X」と&quot;Y&quot;の関係</p>]]>${megaFoot}`,
    keep: ['A&Bの合成対談'], related: [], staff: [] },
  { id: 'very-short', raw: '<p>合成の一言。</p>', keep: ['合成の一言'], related: [], staff: [] },
  { id: 'same-name-roles', raw: `<p>合成の本文です。</p><p>【出演・スタッフ】<br>佐藤一郎（記者）<br>佐藤一郎（音源編集）<br>MC 鈴木二郎</p>${omnyFoot}`,
    keep: ['合成の本文です'], related: [], staff: ['佐藤一郎', '鈴木二郎'] },
  { id: 'multi-paragraph-body', raw: `<p>第一段落は合成の導入です。</p><p>第二段落では合成の経緯を説明します。</p><p>第三段落で合成の今後を考えます。</p><p>第四段落は合成のまとめです。ここまでで二百字を超えるように少し長めの文を書いておきます。合成の文章をさらに続けて、段落の区切りが失われたかどうかを確かめられるようにします。さらにもう少しだけ文を足して長さを確保します。</p>${megaFoot}`,
    keep: ['第一段落', '第二段落', '第三段落', '第四段落'], related: [], staff: [] },
];
