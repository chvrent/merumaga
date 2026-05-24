# mail-magazine-maker 開発・運用ルール

このファイルは、他AI・将来の担当者が壊さず作業するための共通ルールです。

## 作業場所

- 正しい作業場所は `C:\Users\ayana.yokoo\Desktop\mail-magazine-maker` のみ。
- `merumaga` フォルダは廃止。編集・Git操作・デプロイに使わない。
- 作業前に必ず `pwd`、`git status --short`、`git remote -v` を確認する。
- Gitが壊れている、または作業場所が違う場合は作業を止める。

## ドキュメント更新

コード、シート列、仕様、デプロイ手順、運用ルールを変えたら必ず追記する。

- `SPEC.md`: 仕様の正本
- `SPEC_SUMMARY.md`: 重要仕様と注意点の要約
- `START_HERE.md`: 作業開始時の入口
- `運用台帳.md`: 日付別の作業履歴

追記時は「何を変えたか」「なぜ変えたか」「次のAIが確認すべきこと」を残す。

## デプロイ

- GitHub検証: `git push origin main`
- GitHub本番: `git push prod main`
- Apps Script検証: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy-gas.ps1 -Env staging`
- Apps Script本番: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy-gas.ps1 -Env prod`
- 本番Apps Scriptは事前に `clasp login --user ayana.yokoo` が必要。
- Apps ScriptのURLを変えない。既存deployment idを更新する。

## データ操作

- スプレッドシートのヘッダー名を正として読み書きする。列番号固定や古い別名に頼らない。
- `DataService.gs` にスプレッドシートIDを直書きしない。Script Propertiesで環境ごとに管理する。
- 保存処理は同時作業を前提に `LockService` や差分保存を維持する。
- 行削除と配信停止は別概念。停止はシート行を残し、画面上の表示対象から外す。削除はマスタ一覧・PR管理で明示操作した場合だけ使う。

## カレンダー・配信編集

- 日付別の配信編集は、その週・その発生分だけの変更として扱う。
- 配信編集モーダルで保存する差分は `app_check_status.occurrence_override` を優先する。
- 変更済み項目は赤く表示し、元の値へ戻した場合は差分なしとして扱う。
- カレンダーのDnD移動はマスタの定例スケジュールを不用意に書き換えない。
- 確認済み・仮確定済みの発生分は、マスタ変更による自動上書きから除外する。

## PR・マスタ

- app_scheduleに列を追加したら、配信編集モーダル、メルマガ一覧、PR管理、保存処理、入力制御を同時に確認する。
- PR管理では `app_pr` と `app_pr_targets` の整合を崩さない。
- 削除列、配信停止列、入力制御シートの仕様変更は一覧・モーダル・サーバー処理を同時に反映する。
