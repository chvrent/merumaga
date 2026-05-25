# mail-magazine-maker 仕様要約

詳細仕様の正本は `SPEC.md`。このファイルは、作業前に最低限確認する要点です。

## 作業・Git (merumagaルール)

- 正しい作業場所は `C:\Users\ayana.yokoo\Desktop\mail-magazine-maker`。
- `merumaga` フォルダは廃止済み。作業・Git・デプロイ禁止。
- 検証GitHubは `origin`、本番GitHubは `prod`。
- 作業前に必ず `pwd`、`git status --short`、`git remote -v` を確認する。
- 仕様変更時は `SPEC.md`、`SPEC_SUMMARY.md`、`START_HERE.md`、`運用台帳.md` を同時更新する。

## デプロイ

- Apps Script検証は `scripts/deploy-gas.ps1 -Env staging`。
- Apps Script本番は `scripts/deploy-gas.ps1 -Env prod`。
- 本番は `clasp login --user ayana.yokoo` が必要。
- 既存のWebアプリURLを維持し、既存deployment idへ再デプロイする。

## カレンダー

- 火曜始まりの週で表示する。
- カレンダー移動時はマスタなど固定データの再取得を避け、必要な運用ログだけ更新する。
- 複数人作業を前提に、保存系はロック・差分保存・再読み込みタイミングに注意する。

## 配信編集

- 配信編集モーダルは「その週の発生分」だけを扱う。
- モーダル上部に「この配信だけが修正されます。繰り返し設定のメルマガはマスタから編集してください。」と表示する。
- 変更差分は `app_check_status.occurrence_override` に保存する。
- 変更済み項目は赤く表示する。元の値へ戻したら差分なしとして保存できる。
- マスタから新規追加された発生分は、注意喚起のためモーダル内の対象項目を赤く表示する。
- 確認済み・仮確定済みの発生分はマスタ更新から除外する。
- 既存マスタ編集モーダル上部に「確定済・確認済みではない同じメルマガ予定がすべて変更されます。」と表示する。

## 停止・削除

- 配信停止はシート行を残し、画面表示や配信対象から外す操作。
- 削除はマスタ一覧・PR管理など明示的な物理削除操作だけで使う。
- 停止/終了でフィルタ中は停止ボタンを出さず、二重停止を防ぐ。

## シート連携

- シートのヘッダー名を正とする。
- app_scheduleに列追加した場合は、モーダルだけでなくメルマガ一覧・PR管理・保存API・入力制御を同時確認する。
- `入力制御` シートが正本。`APP_DATA.inputControls`（`getInputControlRows_()` 読み込み）を参照し `applyDynamicInputControl` で適用する。
- `入力制御` は1枚の中に `タブ別入力制御`、`サイクル別入力制御`、`PR管理専用 入力項目・配置マトリクス` を縦に並べる。`getInputControlRows_()` が各行へ `__section` を付け、クライアント側でブロック別に読み分ける。
- 状態セルは `表示`、`ロック`、`非表示` を先頭語として判定する。`非表示(ボタンのみ表示)` などの補足は書いてよいが、判定は先頭語が正。
- 配信編集モーダルのロック対象（全形式）: `start_date`、`end_date`、`mail_name`、`mail_type`、`cycle`、`format`、`sub_category`、`is_new`、`weekday`、`is_verifying`。
- `is_fixed`・`is_inactive`・`is_draft` は全モーダルで常時フォーム非表示（ボタン/外部フロー管理）。
- シート照合は `row['モーダル']` 列（例: `配信編集モーダル`）を直接参照する。`画面`列と混同しないこと。
- PRは `app_pr` と `app_pr_targets` の整合を保つ。

## ドキュメント

仕様変更したら `SPEC.md`、`SPEC_SUMMARY.md`、`START_HERE.md`、`運用台帳.md` を必要に応じて更新する。次のAIが迷わないよう、注意点と確認方法も残す。
