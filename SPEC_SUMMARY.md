# mail-magazine-maker 仕様要約

詳細仕様の正本は `SPEC.md`。このファイルは、作業前に最低限確認する要点です。

## 作業・Git

- 正しい作業場所は `C:\Users\ayana.yokoo\Desktop\mail-magazine-maker`。
- `merumaga` は廃止。作業・Git・デプロイ禁止。
- 検証GitHubは `origin`、本番GitHubは `prod`。
- 作業前に `pwd`、`git status --short`、`git remote -v` を確認する。

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
- 変更差分は `app_check_status.occurrence_override` に保存する。
- 変更済み項目は赤く表示する。元の値へ戻したら差分なしとして保存できる。
- マスタから新規追加された発生分は、注意喚起のためモーダル内の対象項目を赤く表示する。
- 確認済み・仮確定済みの発生分はマスタ更新から除外する。

## 停止・削除

- 配信停止はシート行を残し、画面表示や配信対象から外す操作。
- 削除はマスタ一覧・PR管理など明示的な物理削除操作だけで使う。
- 停止/終了でフィルタ中は停止ボタンを出さず、二重停止を防ぐ。

## シート連携

- シートのヘッダー名を正とする。
- app_scheduleに列追加した場合は、モーダルだけでなくメルマガ一覧・PR管理・保存API・入力制御を同時確認する。
- `入力制御` シートがある場合は、画面入力可否・必須・表示/非表示の制御元として扱う。
- PRは `app_pr` と `app_pr_targets` の整合を保つ。

## ドキュメント

仕様変更したら `SPEC.md`、`SPEC_SUMMARY.md`、`START_HERE.md`、`運用台帳.md` を必要に応じて更新する。次のAIが迷わないよう、注意点と確認方法も残す。
