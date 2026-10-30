# Phase16 W列欠損・14:06分類結果

実行：`p16ClassifyMissingWReadOnly`。書込0、全件READ_ONLY。

- 分類合計224：CLEAN_CANDIDATE 5、ARTICLE_REVIEW 126、PARSER_HOLD 93、EMPTY_RESULT 0。
- AJW 14件は従来の除外対象にもかかわらず、今回分類に混入。補填対象から除外すると210件：CLEAN 5、ARTICLE 126、PARSER_HOLD 79。
- CLEAN候補：EP-00574、EP-00631、EP-00782、EP-00872、EP-01069。
- ARTICLE_REVIEWはニュースの学校126件。関連記事URLの見出し・URLの対応を確認するまでW書込保留。
- 保留理由：RESIDUE 80、RELATED_TITLE_MISSING_VERIFIED_URL 10、UNPAIRED_URL 10、EMPTY_BODY 3（AJWを含み、同一行に複数理由あり）。
- EP-06642（ドーナツ）は既知のRESIDUE、キャンペーン・URL連結破損のため書込禁止。

次：候補5件のVとclean()全文を個別検品し、Wに保存してよいか確認。既存WとVは上書きしない。分類コードはAJW除外を補正し、同じ分類の繰り返しに留まらず、検品・小規模補填を優先。