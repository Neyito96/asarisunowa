// 投稿入力検証

function validatePostInputLengths_(values) {
  const limits = {
    url: 2048,
    title: 200,
    maker: 100,
    comment: 2000,
    introducedDate: 32,
    artwork: 2048,
    kind: 32,
    securityAnswer: 20,
    updateType: 100,
    inviteUrl: 2048,
    keywords: 500,
    ruleNote: 2000
  };

  const labels = {
    url: "URL",
    title: "タイトル",
    maker: "作成者",
    comment: "コメント",
    introducedDate: "紹介日",
    artwork: "画像URL",
    kind: "投稿種別",
    securityAnswer: "セキュリティ回答",
    updateType: "更新方式",
    inviteUrl: "共同編集URL",
    keywords: "キーワード",
    ruleNote: "ルール"
  };

  for (const key in values) {
    if (
      Object.prototype.hasOwnProperty.call(values, key) &&
      limits[key] &&
      String(values[key] || "").length > limits[key]
    ) {
      return labels[key] + "が長すぎます";
    }
  }

  return "";
}
