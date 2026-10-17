未本番反映。詳しくは同梱報告書。

ZIPルートで実行:
```sh
node --test access-v3/tests/access-v3.test.cjs tests/theme-v2.test.cjs tests/theme-write-gate.test.cjs tests/canary.test.cjs
```

GASへは access-v3/src の新規2ファイルとThemeRuntimeV2の1条件差分のみ適用。candidateはテスト用v71基準。全candidateを本番へ上書きしない。
