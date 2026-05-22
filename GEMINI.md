# mail-magazine-maker プロジェクトルール

## 文字化け防止ルール
このプロジェクトの仕様書やドキュメント（SPEC.mdなど）は必ず **UTF-8 (BOMなし)** で作成・保存すること。
Shift-JISなどで編集・保存すると文字化けの原因となる。

- エディタ設定: UTF-8 に設定すること。
- 保存時: エンコーディングが UTF-8 であることを確認すること。
- 万が一文字化けした場合は、以下のコマンド（PowerShell）で復元を試みること。
  ```powershell
  $content = Get-Content SPEC.md
  Set-Content -Path SPEC.md -Value $content -Encoding UTF8
  ```
