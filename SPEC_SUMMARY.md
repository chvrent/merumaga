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

## PRラベル

- カレンダー上のPRラベルは、追加（add）、掲出中（active）、削除（remove）を一律でチップ（タグ）形式のスタイルに統一。
- PRラベル「開始」の表記を「追加」に変更。
- 「追加」「削除」は掲出中よりも目立つ配色とし、「削除」の打ち消し線は廃止。
- 同一カレンダースロット内に複数のメルマガがある場合、各メルマガごとに個別のPRラベルを表示する。「PR N件紐づき」というサマリー表示は廃止。

## シート連携

- シートのヘッダー名を正とする。
- 列名は `日本語/英語`（例: `設定者/assignee`）を推奨。サーバーは内部キー（英語）で保持し、UI・フィルター・ラベルは日本語で表示する（`SPEC.md` の列名統一仕様参照）。
- 配信編集の設定者・確認者は `app_schedule` マスタ行の値を表示する。`app_admin_master` は候補リスト用。
- app_scheduleに列追加した場合は、モーダルだけでなくメルマガ一覧・PR管理・保存API・入力制御を同時確認する。
- `入力制御` シートが正本。`APP_DATA.inputControls`（`getInputControlRows_()` 読み込み）を参照し `applyDynamicInputControl` で適用する。
- `入力制御` は1枚の中に `タブ別入力制御`、`サイクル別入力制御`、`PR管理専用 入力項目・配置マトリクス` を縦に並べる。`getInputControlRows_()` が各行へ `__section` を付け、クライアント側でブロック別に読み分ける。
- 状態セルは `表示`、`ロック`、`非表示` を先頭語として判定する。`非表示(ボタンのみ表示)` などの補足は書いてよいが、判定は先頭語が正。
- 配信編集モーダルのロック対象（全形式）: `start_date`、`end_date`、`mail_name`、`mail_type`、`cycle`、`format`、`sub_category`、`is_new`、`weekday`、`is_verifying`。
- `is_fixed`・`is_inactive`・`is_draft` は全モーダルで常時フォーム非表示（ボタン/外部フロー管理）。
- シート照合は `row['モーダル']` 列（例: `配信編集モーダル`）を直接参照する。`画面`列と混同しないこと。
- PRは `app_pr` と `app_pr_targets` の整合を保つ。
- **PR管理一覧の「紐づき先」バッジは必ず `APP_DATA.prTargets` を参照する** (`pr_id` 別にメルマガ名を集約 → `.mail-chips` / `.mc` バッジ表示)。旧 `app_pr.target_ids` カラムは廃止済み。`renderPrCards()` で同カラム経由の参照のみだと描画されないバグが2026-05-29に再発したため注意。
- ID参照は `normalizeIdKey()` で揃える。Sheetsが数値IDを `5.0` で返すケースで、片側が `5.0` 片側が `5` だとマップが引けず raw ID 表示になる (例: `getNewsletterNameMap_`)。
- サイクルの「毎月第1〜4週目」(内部コード `M1〜M4`) は `weekday` 一致 AND `isNthWeekOfMonth(date, n)` で判定。第N週は `Math.floor((date.getDate() - 1) / 7) + 1` で決定 (1日〜7日=第1週、8日〜14日=第2週…)。詳細は `SPEC.md` 4.3 参照。
- 編集モーダルの「通数(万)」は `mhead` 内の `<input type="number" name="delivery_count">` で直接編集する (動的フォーム body には出さない・`hiddenKeys` で抑止済)。`collectNamedFormValues` がそのまま回収する。
- 編集モーダルのヘッダー左端 `#mhead-id-time` は `YYYY/MM/DD/HH` 表示 (例: `2026/06/01/21`)。`CURRENT_ENTRY.target_date` を `-`→`/` 置換、`CURRENT_ENTRY.hour` の HH 部分のみ採用。スケジュールID (SCH_xxx) はメルマガ名 (`name-copy`) で識別するためヘッダーには出さない。
- 編集モーダル / マスタモーダルの形式タブは `抽出 → フリー → 自動求人特集 → その他` の順 (`index.html` `modal-tabs-container`)。実際に開かれるタブは `CURRENT_ENTRY.format` に基づいて `setModalFormatState` が active クラスを差し替えるので HTML 上の並び順は表示順だけを決める。
- ロックされたフィールドは `.form-group.disabled` で表現する。半透明フェード (opacity:0.4) は使わず、グレー背景 + 鍵アイコン (`Styles.html` 内に tabler ti-lock を SVG data URI で埋め込み) + `pointer-events:none` を組み合わせて「触れない」状態を視覚化する。チェックボックスは opacity 0.6 で代用。
- 設定済 / 確認済 時に mhead 内の `設定` / `確認` select はそれぞれ紫 (`#f0f0fa`) / 緑 (`var(--ok-bg)`) の塗りを維持する。`applySettingLock_` で disabled にされてもブラウザ既定の washout が出ないよう、`.hf-ctrl.setter:disabled` / `.hf-ctrl.checker:disabled` に `!important` で `color`/`background-color`/`border-color` を明示し、`opacity:1` + `-webkit-text-fill-color` で固定する (1.19)。
- カレンダーPRラベルは `.pr-labels-row` (flex) で横並びバッジ表示。`pr-label-add`=緑、`pr-label-remove`=赤、`pr-label-active`=ミュート。取り消し線は使わない。
- カレンダーのバッジ凡例とカレンダー本体のバッジは同じ CSS クラス (`pr-label pr-label-*`) を共有する。`SCHEDULE_LEGEND_ITEMS` の `type:'badge'` 項目で凡例側を生成し、`.legend-badge` で凡例内サイズだけ微調整する。色を変えるときは CSS 側 (`.pr-label-add`/`.pr-label-remove`/`.pr-label-active`) を1箇所だけ書き換える。
- 月末配信の色は CSS変数 `--color-month-end-bg: #d9d2e9` が正本。`.date-note` (ヘッダーの「月末配信期間」タグ) と JS の `SCHEDULE_BACKGROUND_COLORS.monthEnd` を同色に揃える (片方変えるとき他方も合わせる)。
- カレンダーの sticky thead は 1行目 `height: 70px` / 2行目 `top: 70px` で揃える。`.month-end-header` は背景を透明にしない (sticky 時に表が透けるため)。
- PR管理一覧は終了済みPRもマスタから隠さず表示する。PR保存時は `end_date` が本日より前なら `is_inactive=TRUE`、それ以外なら `FALSE` に同期し、一覧のデフォルト表示は「状態: すべて」。
- PR管理カードのアクションは「編集」のみ。終了処理は編集モーダル (`open-master-modal`) 経由で `end_date`/`is_inactive` を更新する。カード上の `終了` 赤ボタンは 1.17 で廃止 (`Client.html` `renderPrCards()`)。
- メルマガ一覧の `is_inactive` / `配信終了` 列は配信終了フラグとして扱い、`end_date` が本日以前なら `TRUE`、空または未来日なら `FALSE` に同期する。日別の手動停止は occurrence 側の停止データで管理し、この列とは別ロジックにする。

## ドキュメント

仕様変更したら `SPEC.md`、`SPEC_SUMMARY.md`、`START_HERE.md`、`運用台帳.md` を必要に応じて更新する。次のAIが迷わないよう、注意点と確認方法も残す。

## メンテナンス

- 同一HTML内に同名関数を複数残さない。古い定義は削除し、正本を1つにする。
- 行数分ループする描画処理では、日付・ヘッダー探索などの不変値をループ外で計算する。
- 入力制御の alias 探索は共通ヘルパーへ寄せ、同じロジックを複写しない。
