# mail-magazine-maker 仕様要約

詳細仕様の正本は `SPEC.md`。このファイルは、作業前に最低限確認する要点です。

## UI / デザイン (1.42–1.51 teal 再スキン・確定仕様)

> **確定仕様の正本は `SPEC.md` の「## 0. UI刷新 確定仕様」**。配色トークン・`is-active-red` の配色・データ可視化色・ロック対象(is_new/is_verifying)・削除済み要素（一括保存ボタン/件数サマリー/注記バー）を**無断で元に戻さない**。
> JOB_/USER_ のマスタ紐づけ複数選択は**実装済み(1.48)**: 地域系(app_pref_master)=target_address/user_desired_location/job_location、職種系(app_job_master)=user_experience_job/user_desired_job/job_type を大分類グルーピング＋チップの複数選択DDで描画。バックエンドは `DataService.gs` の `getPrefMaster()`/`getJobMaster()`（`prefMaster`/`jobMaster` を配信）、クライアントは `renderMasterMultiSelectInput_()`/`MASTER_MULTISELECT_KEYS_`。hidden は元値保持・変更時のみ「、」区切り化（override誤検知回避）。
> メルマガ一覧フィルタは**全項目が複数選択(1.49)**: 担当部署/形式/種別/担当者/曜日/時間/サイクル/地域系/職種系/年齢を配信編集モーダルと同じ複数選択部品（`renderMultiSelectMarkup_`/`groupMultiSelectOptions_` に共通化）で描画。選択値 `masterFilters.selections[key]`（配列・同一項目内OR・項目間AND）、絞り込みは `filterMasterRows_`、複数値判定は `isMasterMultiField_`、再描画は 120ms debounce。年齢は埋め込み候補。詳細 §0.4。
> カレンダー前日以前は列全体を薄暗く（`th.is-past`/`td.is-past-column` `#e7eaee`、過去 `.slot-item` opacity 0.78、境界線なし）で今日との境目を明暗差で表現(1.50)。
> カレンダーの「変更後初回＝変更あり」バッジは**実装済み(1.51)**: `getMasterChangeDates_()`(コメント`[マスタ変更]`集約)→`masterChangeDates` 配信、`getMasterChangeFirstOccMap_`/`renderMasterChangeBadge_` でセルに赤「変更あり」表示。モーダルのバナーと同基準。詳細 §0.3。
> 未実装の保留: app_pr_code_master は紐づく列が無く保留。


- 見た目の正本は `Styles.html`。デザイントークンは `:root`（Inter フォント / teal アクセント `--accent #0d9488` / 角丸 `--r8 6px`・`--r4 4px`）。
- トップバー（ナビ）はダーク背景 (`#0d1117` = `var(--text)`)。アクティブタブは teal 下線。配置・機能・HTML構造・クラス名は従来どおりで、`Styles.html` のみで外観を制御する。
- 主要 CTA（新規追加・一括保存・保存・送信・モーダル primary）とアクティブ状態は teal 系。バッジ/チップはピル型。デザイン見本は `UI/*_new.html`。
- 種別/サイクルの**データ可視化色（凡例・行背景チント・サイクル左線）の正本は `Client.html` のJS定数** `SCHEDULE_LINE_COLORS` / `SCHEDULE_BACKGROUND_COLORS`。`Styles.html` 側の `--color-month-end-bg` は `SCHEDULE_BACKGROUND_COLORS.monthEnd` と一致必須。サイクル左線は `--schedule-line-*` を JS が setProperty。

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
- **時間枠合計配信数ツールチップ**: 各時間枠（セル）にホバーすると、その時間帯の「N件の配信 / 合計 X万 (上限 16万)」をツールチップ（title属性）で表示。メルマガ名リストは非表示化。`occurrence_override` 適用後の実効値を使用 (1.40)。
- **設定後ロック強化**: 「設定」または「確認」がONのとき、配信編集モーダル内の全入力項目を `disabled` にし、CSS で `opacity: 0.45`, `pointer-events: none`, `cursor: not-allowed` を適用して編集不可を視覚化 (1.41)。


## 配信編集

- **カレンダー時間枠クリックで追加**: 空セル・既存エントリの隙間をクリックすると「メルマガ追加ピッカー」表示。既存メルマガから選択→値コピーでマスタ複製(ID新規採番)、または新規作成。日付・時間・曜日プリフィル、サイクル=単発デフォルト。移動モード中は無効 (1.39)。
- 配信編集モーダルは「その週の発生分」だけを扱う。
- モーダル上部に「この配信だけが修正されます。繰り返し設定のメルマガはマスタから編集してください。」と表示する。
- **変更スコープ**: 保存時に「この日だけ変更」か「●/●〜[日付]まで」を選択できる。後者は日付ピッカーで終了日を指定し、`computeOccurrenceDatesInRange_` がサイクル(毎週/隔週/毎月/月末/M1-M4等)に基づき範囲内の発生日を算出。`saveOccurrenceOverrideRange` (`DataCheckStatus.gs`) が単一ロック内で一括保存 (1.38)。
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
- 編集モーダル / マスタモーダルの形式タブは `抽出 → フリー → 自動求人特集 → その他` の順 (`index.html` `modal-tabs-container`)。実際に開かれるタブは `CURRENT_ENTRY.format` に基づいて `setModalFormatState` が active クラスを差し替えるので HTML 上の並び順は表示順だけを決める。**マスタ新規追加のデフォルトタブは「抽出」** (`row.format || '抽出'`、1.30)。
- `schedule_id` は新規マスタ作成時に `computeTentativeScheduleId_()` で `APP_DATA.schedule` の最大値+1 を `SCH_xxx` 形式で仮表示する（disabled=サーバー採番は不変）。`pr_id` も同様に `computeTentativePrId_()`（参照元は `APP_DATA.pr`）で仮番号表示。`collectNamedFormValues` は disabled を skip するためペイロードには含まれない (1.30/1.31)。`app_schedule`/`app_pr` に ID 列ヘッダーが無い場合でも欄を出すため `getVisibleMasterHeaders` が `schedule_id`/`pr_id` を force-add する (1.31)。
- コメント本文の URL は `linkifyText_` で `<a target="_blank" rel="noopener noreferrer">` に変換して表示する。`https?://` に加え `www.` 始まりも対象。生テキストをトークン分割し URL 以外は `escapeHtml`、URL部は `escapeAttribute(href)`+`escapeHtml(text)` でXSS対策（`&` を含むクエリ文字列も切れない）。表示は `.cbody a`＝`var(--blue)`+下線 (`ClientComments.html`/`Styles.html` 1.30/1.31)。
- マスタモーダルの「削除」ボタン (`.modal-row-actions`) は保存/キャンセル行 (`.modal-actions`) の**後ろ** = スクロール最下部に配置する。フッターとして追従させない (通常フロー配置・`index.html`) (1.26)。
- マスタ編集モーダルに「コピーして作成」ボタンあり。フォーム現在値をコピーし `__rowNumber`/ID/確定済み等を除外して新規モーダルとして開き直す。編集(既存行)時のみ表示 (1.34)。
- `app_schedule` のメルマガ新規作成・下書き保存(action==='insert')時に `saveCommentUnlocked_` でコメント「メルマガを新規作成しました」/「下書き保存しました」を自動投稿する。サーバ側1ロック内で完結。投稿失敗は保存をエラーにしない (1.34)。
- マスタ更新(update)時に旧行→新行の差分を `[マスタ変更]` プレフィックス付きコメントとして自動記録する (`logMasterChangeDiff_`)。マスタ編集モーダル(既存行)にはフォーム下部に「マスタ変更履歴」セクション (`#masterChangeHistory`) を表示。`getMasterChangeHistory(scheduleId)` で `[マスタ変更]` コメントを抽出 (1.35)。
- **最新構造 (1.29)**: 保存/下書き保存/キャンセル (`.modal-actions`) は**固定フッター**（カード最下部に追従）。フォーム (`#masterForm`) と削除 (`.modal-row-actions`) は新ラッパー `.master-scroll-body{flex:1 1 auto;min-height:0;overflow-y:auto}` に入れて一緒にスクロールし、削除はスクロール内コンテンツ最下部・追従させない。`#masterModal .modal-card{overflow:hidden}` でカードをクリップ、`#masterModal .form-grid{overflow-y:visible}` で二重スクロールを防ぐ (`index.html`/`Styles.html`)。1.28の単一スクロール（保存も一緒に流れる）は誤りだったため置き換え。
- ロックされたフィールドは `.form-group.disabled` で表現する。半透明フェード (opacity:0.4) は使わず、グレー背景 + 鍵アイコン (`Styles.html` 内に tabler ti-lock を SVG data URI で埋め込み) + `pointer-events:none` を組み合わせて「触れない」状態を視覚化する。チェックボックスは opacity 0.6 で代用。
- 設定済 / 確認済 時に mhead 内の `設定` / `確認` select はそれぞれ紫 (`#f0f0fa`) / 緑 (`var(--ok-bg)`) の塗りを維持する。`applySettingLock_` で disabled にされてもブラウザ既定の washout が出ないよう、`.hf-ctrl.setter:disabled` / `.hf-ctrl.checker:disabled` に `!important` で `color`/`background-color`/`border-color` を明示し、`opacity:1` + `-webkit-text-fill-color` で固定する (1.19)。
- フッターの「確認」ボタンは確認済み (`checkerActive=true`) 時に「確認取り消し」(赤系 `is-cancel-mode`) に切り替わり、クリックで checker=false にできる。setter は保持される。`handleModalToggleChecking_` が双方向で処理する (1.20)。
- **設定者(assignee)が `R` のとき editModal の「設定」ボタン (`#btnModalSetting`) は非活性。「確認」のみ押下可**。`applyRSetterButtonLock_(isR)` が制御し、`syncReviewerLock_('editModal')`(設定者select変更時)と `initEditModalCheckButtons_()`(モーダル展開直後)の双方から呼ばれる。R判定は**フォールバックパターン**: `effectiveAssignee = selectAssignee || entryAssignee` — select 値があればそちらを優先し、空(options再構築中)の時だけ `CURRENT_ENTRY` の `getValueByKeys(['assignee','設定者','setter'])` にフォールバック。`handleModalToggleSetting_` 冒頭にも同じフォールバックパターンの R ガードあり。`.modal-footer-btn:disabled` CSS で disabled 時は `opacity:0.4` + `pointer-events:none` (1.26, 1.36, 1.37)。**教訓: R 判定で OR (`selectVal==='R' || entryVal==='R'`) は禁止 — CURRENT_ENTRY は保存済みデータなので select を非R に変えても解除されない。フォールバック(`select || entry`)を使うこと (1.37)**。
- **設定者Rのメルマガで設定者・確認者を変更してから「設定」を押した場合は『設定済』止まり (確定済にしない)**。setter/checker トグルの確定判定 `isArchiveDiffConfirmed_`(`DataArchive.gs`)はアーカイブ行の assignee を見て `assignee==='R'→setter active で確定 / それ以外→checker active で確定` と分岐する。アーカイブ行 assignee はマスタ行から埋まるため、occurrence で設定者を変えてもマスタの旧 `R` を見て誤確定する不具合があった。対策として setter トグルを送る `saveCheckStatusFromModal_(...,'setter',true,payload)` の payload にフォームの実効 assignee/reviewer (`getCurrentPersonPayload_()`、Rなら reviewer 空) を載せ、`saveDailyArchiveDiffsUnlocked_` がアーカイブ行 assignee を非Rへ上書き→確認者基準の判定に切替させる (1.26)。**教訓: occurrence で設定者を変えるトグルは payload に実効値を必ず載せる**。
- **設定/確認の赤(`is-active-red`)のキーは `getCheckItemId` = `normalizeIdKey(schedule_id)|normalizeDateString(target_date)` が正本** (1.22)。ライブ(`app_schedule`)とアーカイブ(`app_schedule_archive`)で同じ発生分でも Sheets 表示値が `5`/`5.0` でブレるため、正規化しないと設定時の保存キーと確定後の描画キーが食い違い赤が消える。setter/checker の itemId を組む箇所 (`fillRForDay` 等) は必ず `getCheckItemId` を通すこと。`isCheckStatusActive` は厳密一致のみ (曖昧 includes 比較は誤検出するため禁止)。
- **`5.0` 形式の schedule_id はサーバー `getSourceRowByScheduleId_` が行を引けず、確定発生分のアーカイブ書き込み (`saveDailyArchiveDiffsUnlocked_`) が無言で失敗する**。クライアントが `getCheckItemId` で正規化して `5` で送ることで回避 (1.22)。
- **確定発生分の設定/確認 active はアーカイブシートの `check_setter_active`/`check_checker_active` 列が永続正本**。サーバー `getArchivedOccurrenceRows_` が両列を record に surface する (空欄は付与しない=セッション中の `APP_DATA.checkStatuses` 保持を短絡させない)。これがないとフルリロード後に赤が消える。サーバー `getCheckStatuses_` は setter/checker を返さない仕様なので、アーカイブ列がリロード後の唯一の根拠 (1.22)。
- 配信編集モーダルの項目は4セクションに分ける: `基本設定`(ID〜担当部署) / `メルマガ内容`(メルマガ内容〜パラメータ) / `ステータス`(新規〜検証中) / `抽出内容`(USER_年齢〜JOB_フリーワード)。`renderEditModalFields_` の `sectionMap` がキー→セクションを定義し、バケット振り分けでシート列順に依存せずグループ化する。見出しは `updateSectionHeadingVisibility_` が「そのセクションの可視フィールドが0件なら非表示」にする (入力制御で全部隠れた場合の空見出し防止)。新しい列を増やしたら `sectionMap` に必ず追記する (未登録キーは見出しなしで末尾にまとめて出る) (1.21)。
- 形式タブ (`.modal-tab`) は下線（アンダーライン）型: コンテナは背景/枠なし+下端区切り線、各タブ `flex:1` で等幅・全幅、アクティブは濃い文字+黒い下線。**タブCSSの正本は `Styles.html` 953-982 付近のみ**。配色/形状変更はここを編集 (1.21 → 1.23 で下線型)。**【注意】`Client.html` 冒頭に青 `#1a73e8` の重複 `.modal-tab` `<style>` ブロックがあり Styles.html を `!important` で上書きしていた → 1.24 で削除済み。タブ系CSSを別ファイルに重複定義しないこと（後勝ち＋!important で混乱する）。**
- mhead のメルマガ名 (`.name-text`) は折り返して全文表示 (`white-space:normal`/`overflow-wrap:anywhere`)。`.hf` (通数/設定/確認ボックス) は幅 84px・テキスト左寄せ (1.21)。
- 配信編集モーダルの固定フッター (`.mfoot`) ボタンは**右寄せのコンパクトボタン** (`UI/modal_linear.html` 準拠)。**配色の正本は §0.1（デザイン言語）、構成は §0.5**: `設定`(`.state-btn`)=インディゴ(`#eef2ff`/`#4338ca`)、`確認`(`.checking-btn`)=グリーン(ok系)、`保存して閉じる`(`.primary-btn`)=teal accent×白文字。取り消しモード(`.is-cancel-mode`)のみ赤系を維持。`.mfoot-btns` の並びは [配信停止/再開(`.stop-resume-row`)] → スペーサー `.fsp` → [設定 確認 保存]。**フッターボタンCSSの正本は `Styles.html` の「modal-footer-btn」ブロックのみ**。**【注意】旧 `.modal-action-footer` 用の `.modal-footer-btn`(flex:1/`.primary-btn{flex:2}`/padding:13px/border:none) が二重定義でコンパクトボタンを全幅セグメント化していた → 1.25 で削除。フッター/タブ系CSSを別ブロックに二重定義しないこと（後勝ち事故）。** フッターの進行表示は **`設定済 → 確認待ち → 確定済` の3段ステータス（`delivery-status-steps`）を常時表示 (1.44, §0.5)**。※1.25時点の「2段進捗未実装・単一ピル維持」は1.44で置き換え済み。
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
