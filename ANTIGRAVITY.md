# 配信カレンダー開発・保守の絶対ルール (ANTIGRAVITY.md)

本プロジェクトにおけるカレンダー表示・編集機能の保守における絶対的な制約事項を以下に定める。

## 1. UI・レイアウトの絶対ルール
- **構造の厳守**: 各配信データを描画する際は、必ず `div.delivery-row` クラス（`display: flex`）を使用し、`col-name`, `col-count`, `col-setter`, `col-checker` の 4 カラム構成を守ること。
- **重なりの禁止**: `position: absolute` 等の絶対配置は絶対禁止。必ず Flexbox を使用し、項目が縦に積み上がる構造を維持すること。
- **ヘッダーの重複禁止**: ヘッダー（「内容・通数・設定・確認」）の出力は、必ずデータ行ループ（`entries.forEach`）の「外側」かつ「ヘッダーが未出力の場合のみ」の条件で制御すること。
- **列の整列**: 各カラムには必ず固定幅または `flex: 1` を設定し、全行で縦ラインが一致するようにすること。

## 2. ロジックの絶対ルール
- **色判定 (getBgColor)**: 「区分」列の値に基づき、以下のカラーコードを強制適用すること。
    - 毎週：#ffffff (白)
    - 特殊：#e6e6fa (薄紫)
    - 毎月：#fff0f5 (薄ピンク)
    - 隔週A：#e0ffe0 (薄緑)
    - 隔週B：#ffd1dc (ピンク)
    - その他：#e0ffff (水色)
- **フィルタリング**: 「隔週A/B」「3週サイクル」「月末1週間判定」のロジックは厳密に守り、既存の条件を上書きして消さないこと。

## 3. デプロイ・同期の絶対ルール（全AI共通）
- **URLの固定と更新**: 修正を反映する際は、単に `clasp push` するだけでなく、必ず新しい「バージョン」を作成し、**既存のWebアプリURL（デプロイID）がその最新バージョンを指すように更新（redeploy）すること。**
- **自動化の徹底**: ユーザーに「最新版にしてください」と言わせず、AI側でデプロイ作業まで完結させること。
- **デプロイIDの維持**: 特段の理由がない限り、新しいURLを発行せず、既存のURL（例: `AKfycbzfuy...`）を維持したまま中身を最新化すること。

## 4. Data Operation Conventions
- **Header-based Property Mapping**: All future data operations (fetching/saving) MUST use the spreadsheet's 1st row (header) values as the canonical property names in the application code. Avoid relying on hardcoded language aliases or dynamic translation maps where the header itself can be used directly as the object key. This ensures code remains maintainable and consistent with the spreadsheet structure.
1. **修正前**: `read_file` で現状のコード全体を必ず確認する。
2. **修正時**: 影響範囲（特に HTML 構造とループ処理）を最小限にする `replace` を優先し、全体の `write_file` は最小限に抑える。
3. **デプロイ前**: 
    - ブラウザコンソールでエラーが出ていないか確認。
    - ヘッダーが重複していないか目視確認。
    - 色分けが正しく適用されているか確認。
4. **記録**: デプロイ後は必ず `運用台帳.md` に日時、作業内容、デプロイバージョンを追記する。

## 開発・運用ルール

- **構造の厳守**: 配信カレンダーの Flexbox 構造を崩さないこと。
- **デプロイ記録**: デプロイ後は必ず `運用台帳.md` に日時、作業内容、デプロイバージョンを追記すること。
- **Git運用**: 重要な機能追加やUIの大幅変更時には、必ず `git push` を実行し、リモートリポジトリに反映すること。
- **変更の記録**: あらゆる重要な変更履歴は `運用台帳.md` に最新の仕様と整合性を保つよう追記すること。
- **仕様更新の記録**: コードや運用ルールを変更した場合は、`SPEC.md`、`SPEC_SUMMARY.md`、`運用台帳.md` を同時に更新すること。
- **ルール確認**: 修正前には必ず本ルールおよび `運用台帳.md` を読み込み、最新の仕様を確認すること。
