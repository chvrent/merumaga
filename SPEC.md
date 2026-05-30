# メルマガ配信マスタ管理アプリ 仕様書

最終更新: 2026-05-30

## 改訂履歴

| 日付 | 版 | 概要 | 担当者 |
| :--- | :--- | :--- | :--- |
| 2026-05-30 | 1.42 | **UI刷新（teal 再スキン）** — `UI/*_new.html` のデザイン見本を踏襲し `Styles.html` のデザイントークン・コンポーネント外観を刷新。配置・機能・HTML構造・クラス名は原則不変。Inter フォント、teal アクセント (`--accent #0d9488`)、角丸 (`--r8 6px`/`--r4 4px`)、ピル型バッジ/チップを導入。トップバー（ナビ）をダーク背景 (`#0d1117`) 化し、アクティブタブを teal 下線に。主要ボタンと各種アクティブ状態を teal 系へ統一。基準フォント 13px（カレンダーは 11px 固定で密度維持）。種別/サイクルのデータ可視化色を更新（正本は `Client.html` の `SCHEDULE_LINE_COLORS`/`SCHEDULE_BACKGROUND_COLORS`）。**モーダル配色統一**: PR関連は一覧と揃え teal、変更表示(occurrence override)は pink→赤(alert)。**`#masterModal[data-mode="master"]`（PR/マスタ新規追加）の赤テーマを廃止しクリーンな teal 配色へ**（新規作成時のみ適用される mode。広域変更警告は既存編集の amber `.modal-impact-note` が担う）。モーダル余白を見本へ、コピー/閉じる/保存/停止等の絵文字を Tabler アイコン化。 | Claude Opus |
| 2026-05-30 | 1.41 | **配信編集モーダルの設定後ロック強化** — 「設定」または「確認」がON時、配信編集モーダル内の全入力項目を `disabled` 化。CSSセレクタ修正で `opacity: 0.45`, `pointer-events: none`, `cursor: not-allowed` を確実に適用し、編集不可を視覚化。 | Claude Opus |
| 2026-05-30 | 1.40 | **⑬ カレンダー時間枠ホバーで合計配信数ツールチップ表示** — 各時間枠(セル)にホバーすると、その時間帯の「N件の配信 / 合計 X万 (上限 16万)」をツールチップ(title属性)で表示。メルマガ名リストは非表示化。`occurrence_override` 適用後の実効値を使用。 | Claude Opus |
| 2026-05-29 | 1.15 | **PR管理一覧の「紐づき先」バッジ表示を復旧** (`APP_DATA.prTargets` を `pr_id` 別に集約しメルマガ名バッジを `.mail-chips`/`.mc` で描画)。**`getNewsletterNameMap_()` のキーを `normalizeIdKey` に統一** (Sheets `5.0` → `5` の表記揺れ吸収)。**毎月第1〜4週目サイクル(M1〜M4)を追加** — `SCHEDULE_CYCLE_OPTIONS`、`normalizeCycleLabel`、`getScheduleCycleType`、配信判定ループ、`isNthWeekOfMonth(date, n)` ヘルパーを実装。 | Claude Sonnet (Gemini作業の取り込み含む) |

| 2026-05-11 | 1.0 | 初期版作成。3ペインUI、カレンダー基本機能。 | Antigravity CLI |
| 2026-05-14 | 1.1 | PRラベル、コメント日付別化、確定ロック、手動停止、求人数アラート追加。 | Codex |        
| 2026-05-15 | 1.2 | ドラッグ＆ドロップ移動、PR 2.0 (ID紐付け方式)、火曜始まりサイクル刷新、Stickyヘッダー実装。 | Codex / Antigravity CLI |
| 2026-05-21 | 1.3 | モーダル制御の責任分割、特殊項目描画の共通化、色・凡例ルールの定数化、マスタ編集ロックの一部解除。 | Codex |
| 2026-05-22 | 1.4 | 仕様書の構造再編、運用ルール・連休アラートの明文化、入力制御マトリクスの完全復元。 | Gemini CLI |
| 2026-05-23 | 1.5 | ファイル分割リファクタリング、用語の統一（担当部署、USER_*等）、編集差分ハイライト実装、R枠確認者任意化の徹底。 | Codex / Gemini CLI |
| 2026-05-25 | 1.6 | 入力制御シート反映: 配信編集ロック対象に weekday・is_verifying を追加、is_fixed/is_inactive/is_draft を全モーダルで常時非表示化、シート行照合バグ修正（モーダル列の参照先修正）、Section 4.1 を全面刷新。 | Claude Sonnet |
| 2026-05-25 | 1.7 | 最新の「入力制御」シート構成を仕様へ再整理。タブ別・サイクル別・PR管理専用の3ブロックを同一シートで管理し、`__section` で読み分けるルールを明文化。 | Codex |
| 2026-05-26 | 1.8 | 配信編集・マスタ編集モーダルに変更影響範囲の注意書きを追加。 | Codex |
| 2026-05-26 | 1.9 | メンテナンス方針を追記。重複関数の削除、入力制御ヘルパー共通化、一覧描画中の日付再計算削減を反映。 | Codex |
| 2026-05-27 | 1.10 | 配信編集（設定者等）の保存・別名解決・複数ハイライト不具合を修正。`CHECK_STATUS_FIELD_ALIASES` 同期、`addCanonicalObjectFields_` のセグメント対応、`getMasterFieldAliases_` への追加、`override_fields` マージ処理実装。本番デプロイ済み（@570）。 | Gemini |
| 2026-05-27 | 1.11 | マスタ新規・編集モーダルに入力制御（設定者R時の確認者ロック）を追加。`syncReviewerLock_` の汎用化、マスタモーダルへの適用。本番デプロイ済み（@571）。 | Gemini |
| 2026-05-27 | 1.12 | `confirmed_by` / `confirmed_at` フィールドの廃止。アプリ内で使用されていないため、ロジックから削除。本番デプロイ済み（@572）。 | Gemini |
| 2026-05-27 | 1.13 | PR管理「紐づいたメルマガ」バグ修正。`savePRDataUnlocked_` を delete-and-reinsert 方式に変更し、チェックを外したメルマガが残存し続ける問題を解消。`app_pr_targets` スキーマ・採番仕様・PRラベル紐付けロジックを仕様書に明文化。 | Claude Sonnet |
| 2026-05-28 | 1.14 | 下書き機能の仕様整備。一覧に「下書きのみ」フィルターチップを追加。「配信中」ビューから下書きを除外（これまで混入していた）。カレンダー・PR判定への非掲出は既存仕様を維持。 | Claude Sonnet |
| 2026-05-30 | 1.39 | **⑫ カレンダーの時間枠クリックで新規メルマガ追加** — 空セル・既存エントリ間の隙間をクリックすると「メルマガ追加ピッカー」を表示。既存メルマガ一覧(検索・下書き含む)から選択→値コピーでマスタ複製(ID新規採番)、または「新規メルマガを作成」で空モーダル。日付・時間・曜日プリフィル、サイクル=単発デフォルト。移動モード中は無効。staging @287。 | Claude Opus |
| 2026-05-30 | 1.38 | **⑨ 配信編集モーダルの変更スコープに「●/●〜まで」期間選択を追加** — スコープモーダルに日付ピッカー付き「〜まで」オプションを新設。`computeOccurrenceDatesInRange_` がエントリのサイクル定義(毎週/隔週A・B/毎月/月末/M1-M4/3週サイクル/毎日/単発)に基づき範囲内の配信発生日を算出し、プレビュー件数を表示。「適用」で `saveOccurrenceOverrideRange` (`DataCheckStatus.gs`) が単一ロック内で全発生日に `occurrence_override` を一括保存。staging @285。 | Claude Opus |
| 2026-05-30 | 1.37 | **R→非R変更時に設定ボタンが活性化しない問題を修正** — `syncReviewerLock_` と `handleModalToggleSetting_` の R 判定が OR ロジック (`selectVal==='R' \|\| entryVal==='R'`) だったため、select で非R に変更しても `CURRENT_ENTRY`(保存済みデータ) が R のまま → `isR=true` が解除されなかった。**フォールバックパターン** (`effectiveAssignee = selectAssignee \|\| entryAssignee`) に変更し、select 値があればそちらを優先、空(options再構築中)の時だけ CURRENT_ENTRY にフォールバック。staging @284。 | Claude Opus |
| 2026-05-30 | 1.36 | **配信編集モーダルの「設定」ボタンがR設定者で非活性にならない／反応しない二重バグを修正** — (1) `applyRSetterButtonLock_` が `isR=false` 時に `btnModalSetting.disabled = false` を戻していなかった（一度Rエントリを開くと以降全エントリで設定ボタンが押せない）。`else` 分岐で `disabled=false` を追加。(2) `syncReviewerLock_` が `requestAnimationFrame` → `finalizeEditModalContent_` → `refreshAdminSelects_` 経由で**後から呼ばれ**、select options 再構築中で `assigneeEl.value` が空 → `isR=false` → `disabled=false` に上書きしていた（「後勝ち」パターン）。select 値だけでなく `CURRENT_ENTRY` の `getValueByKeys(['assignee', '設定者', 'setter'])` も OR で R 判定するよう修正。(3) `handleModalToggleSetting_` 冒頭に R ガード追加。(4) `.modal-footer-btn:disabled` に `opacity:0.4; cursor:not-allowed; pointer-events:none` を追加（disabled でも見た目が変わらなかった問題を解消）。staging @281、本番 @591。 | Claude Opus |
| 2026-05-29 | 1.35 | **③ マスタ変更履歴の記録と表示** — マスタ更新(update)時に `saveMasterDataUnlocked_` 内で旧行→新行の差分を検出し、`[マスタ変更]\nフィールド名: 旧値 → 新値` 形式でコメントに記録 (`logMasterChangeDiff_`、`DataMasterCRUD.gs`)。管理フィールド(`source_sheet`/`source_row`/`schedule_action`/`current_job_count`/`job_count_updated_at`)は除外、最大10件まで表示、それ以上は「他N件」で省略。新サーバ関数 `getMasterChangeHistory(scheduleId)` で `[マスタ変更]` コメントを抽出し新しい順に返す。クライアント: マスタ編集モーダル(既存行)の表示時に `loadMasterChangeHistory_` で非同期ロードし、フォーム下部・削除ボタン上に変更履歴セクション(`#masterChangeHistory`)として表示 (`ClientModals.html`)。新規作成時・履歴なし時はセクション非表示。スタイルは `Styles.html` に `.master-change-history`/`.history-entry`/`.history-meta`/`.history-diff` を追加。staging @270。 | Claude Opus |
| 2026-05-29 | 1.34 | **⑧⑩ コピーして作成ボタン＋新規作成時コメント自動投稿** — ⑧マスタ編集モーダルのスクロール領域（削除ボタン上）に「コピーして作成」ボタンを追加 (`index.html`)。押下時: 未保存変更の破棄確認 → `collectNamedFormValues` でフォーム現在値を取得 → `__rowNumber`/`schedule_id`/`pr_id`/`is_fixed`/`is_inactive` を除外 → `closeMasterModal` → `openMasterModal`(新規モード)で開き直す (`ClientModals.html` `copyCreateMaster`)。既存行(編集)時のみ表示、新規追加時は非表示 (`updateMasterActionButtons_`)。⑩ `saveMasterData` の `withScriptLock_` 内で、`action==='insert'` かつ `app_schedule` の場合に `saveCommentUnlocked_` で「メルマガを新規作成しました」/「メルマガを下書き保存しました」を自動投稿 (`DataMasterCRUD.gs`)。`target_date` は `start_date`→`delivery_date`→今日のフォールバック。コメント投稿失敗はメルマガ保存をエラーにしない(try-catch)。staging @267。 | Claude Opus |
| 2026-05-29 | 1.33 | **⑦ 移動モードを「OFF押下時に一括移動」へ変更** — 従来はカレンダーD&Dの `onEnd` ごとに `updateItemDate` を即時送信し**毎回フルリロード**していた（1件ずつ処理）。移動結果をクライアントの `PENDING_MOVES`（キー `scheduleId\|originalDate`、同一アイテムの再移動は最終移動先で上書き）に貯め、移動モードOFF時に `flushPendingMoves_` が新サーバ関数 `updateItemDates(moves)` へ一括送信→1回だけリロードするよう変更 (`Client.html`)。サーバ `updateItemDates` は単一 `withScriptLock_` 内で各件を `updateItemDateUnlocked_` で順次処理（シートを都度読むため逐次整合）し、1件でも失敗すれば `成功/全件` を添えて throw (`DataScheduleOps.gs`)。保留件数をトグルへ表示（`移動: ON (N件保留)`・黄色 `#moveModeToggle.has-pending`）、未送信アイテムに枠線 `.delivery-row.is-pending-move`(`Styles.html`)。staging @262。 | Claude Opus |
| 2026-05-29 | 1.32 | **⑭仮IDが描画後に空文字で上書きされていた真因を修正** — 1.30/1.31 で `getMasterSpecialFieldConfig_` が `<input name="schedule_id"/"pr_id" value="仮ID">` を生成しても、直後の `populateModalFields`（`modal.querySelectorAll('[name]')` 全件に `input.value = row値 ?? ''` を代入）が新規時は空の row 値で**仮IDを消去**していた。さらに `openAndInitModalWithTab` 後の `applyPrMasterControls_` も placeholder「保存時に自動採番」を再設定。結果メルマガ一覧IDは空欄、PR IDは placeholder のみ表示だった。`renderMasterEditModal` の表示直前（`populateModalFields`/`openAndInitModalWithTab` の**後**）で `mode==='master'` 時のみ `schedule_id`/`pr_id` の空欄に `computeTentativeScheduleId_()`/`computeTentativePrId_()` を再設定するよう修正 (`ClientModals.html`)。**教訓: 描画HTMLの value は後続の populate 系で上書きされる。disabled 表示専用の算出値は populate の後に設定する**。staging @259。 | Claude Opus |
| 2026-05-29 | 1.31 | **1.30 の⑭仮ID表示と⑪URLリンク化の不具合を修正** — ⑭PR: `computeTentativePrId_` が存在しない `APP_DATA.prData` を参照し常に `1` を返していた（正しくは `APP_DATA.pr`）。⑭スケジュール: マスタ新規モーダルは `getVisibleMasterHeaders` のヘッダーを列挙して項目を出すが、`app_schedule` に `ID` 列が無い場合は `schedule_id` 欄自体が描画されず仮ID(`SCH_NNN`)が出なかった。PRと同様に `app_schedule` でも ID系エイリアスが無ければ `schedule_id` を force-add するよう修正 (`ClientUtils.html`)。⑪: `linkifyText_` を堅牢化 — `https?://` に加え `www.` 始まりも対象化、`escapeHtml` で `&`→`&amp;` 後に正規表現が途中で切れていたクエリ文字列問題をトークン分割方式（URL以外を逐次エスケープ、URL部は `escapeAttribute(href)`+`escapeHtml(text)`）で解消、末尾句読点をリンクから除外。`.cbody a` を本文同色→`var(--blue)`+下線でリンクと判別可能に (`Styles.html`)。staging @257。 | Claude Opus |
| 2026-05-29 | 1.30 | **小粒4件まとめて修正** — ①`.date-header` の `max-height:70px`・`overflow:hidden` を削除し、月末配信期間ノートやサイクルラベルが見切れない構造に (`Styles.html`)。⑤マスタ新規追加モーダルの既定タブを「フリー」→「**抽出**」に変更 (`row.format \|\| '抽出'`、`ClientModals.html` 2箇所)。⑭`schedule_id` を `isHiddenMasterInputHeader` の hiddenKeys から外し、新規時は `APP_DATA.schedule` の既存IDから `SCH_xxx` 形式の仮採番IDをロック枠に表示 (`computeTentativeScheduleId_`)。`pr_id` も同様に `computeTentativePrId_` で仮番号を表示 (`Client.html`)。disabled フィールドは `collectNamedFormValues` のスキップ対象なのでサーバー採番ロジックは不変。⑪コメント本文の `https?://...` をリンク化 — `linkifyText_` でまず `escapeHtml` してから URL 正規表現で `<a target="_blank" rel="noopener">` に置換 (`ClientComments.html`)。XSS対策済み。リンクスタイルに `.cbody a` を追加 (`Styles.html`)。staging @255。 | Claude Opus |
| 2026-05-29 | 1.29 | **マスタモーダルの「保存/キャンセル」を固定フッター化し、削除はスクロール内最下部へ** — 1.28でカード全体を単一スクロールにした結果、保存ボタンが固定されず削除が回り込んでいた。`index.html` でフォーム(`#masterForm`)と削除(`.modal-row-actions`)を新ラッパー `.master-scroll-body` に入れて一緒にスクロールさせ、`.modal-actions`(下書き保存/保存/キャンセル)をカード最下部の固定フッターに戻した。CSSは `#masterModal .modal-card{overflow:hidden}`・`#masterModal .form-grid{overflow-y:visible}`・`.master-scroll-body{flex:1 1 auto;min-height:0;overflow-y:auto}`(`Styles.html`)。`.modal-actions` の `flex-shrink:0`(既存)でフッター追従を担保。削除はスクロール領域の最下部に位置し追従しない。staging @253。 | Claude Opus |
| 2026-05-29 | 1.28 | **マスタモーダルの「削除」ボタンが追従エリアに張り付く問題を修正** — 1.26③で削除 (`.modal-row-actions`) をDOM最下部へ移したが、`.master-modal-card` が flex 列で `.form-grid{overflow-y:auto}` を持つため、flex でフォームだけが内部スクロール領域となり、後続の `.modal-actions`(保存/キャンセル) と `.modal-row-actions`(削除) が下部に張り付く（=追従するフッター化）状態が残っていた。`#masterModal .form-grid{overflow-y:visible;flex-shrink:0}` でフォームの内部スクロールを止め、**カード全体を単一スクロール領域**に変更（`Styles.html`）。これで フォーム→保存/キャンセル→削除 が一体でスクロールし、削除はスクロール内コンテンツ最下部に位置・追従しない。HTMLの順序変更は不要（1.26で既に最下部）。staging @251。 | Claude Opus |
| 2026-05-29 | 1.27 | **`getSourceSpreadsheet_` 未定義による全データ読み込み失敗 (`ReferenceError`) を修正** — マージ取り込みコミット `45be46e`(feat: 検証内容の適用)が `DataUtils.gs` の `getSourceSpreadsheet_()` を `getSheetValuesAndHeaders_` 追加時に誤って削除し、約25箇所の呼び出しが `ReferenceError` となって全画面が「データの読み込みに失敗しました」で停止。元実装 `SpreadsheetApp.openById(getSourceSpreadsheetId_())` を復元。**教訓: 共通ヘルパーを置換/リネームするリファクタは全呼び出し元の移行を `grep` で確認してからマージする**。staging @249。 | Claude Opus |
| 2026-05-29 | 1.26 | **設定者R対応の編集モーダル修正3点** — ①設定者(assignee)が `R` のとき editModal の「設定」ボタン (`#btnModalSetting`) を非活性化し「確認」のみ押下可に (`applyRSetterButtonLock_` を `syncReviewerLock_('editModal')` / `initEditModalCheckButtons_` から呼ぶ・`ClientModals.html`)。②設定者Rのメルマガで設定者・確認者を変更してから「設定」を押すと**確定済**になる不具合を修正（本来は設定済のみ）。真因は setter トグルが payload 空で送られ、サーバー `isArchiveDiffConfirmed_` (`DataArchive.gs`) がアーカイブ行のマスタ由来 `assignee=R` を見て「R かつ setter active → 確定」と誤判定していたこと。`getCurrentPersonPayload_()` でフォームの実効 assignee/reviewer（Rなら reviewer 空）を `saveCheckStatusFromModal_(...,'setter',true,payload)` に載せ、`saveDailyArchiveDiffsUnlocked_` がアーカイブ行 assignee を非Rへ上書き→確認者基準の判定へ切替させて解消。③マスタモーダルの「削除」ボタン (`.modal-row-actions`) を保存/キャンセル行 (`.modal-actions`) の後ろ=スクロール最下部へ移動し追従させない (`index.html`/`Styles.html`)。staging @246。 | Claude Opus |
| 2026-05-29 | 1.25 | **配信編集モーダルのフッターボタンが全幅セグメント化していた不具合を修正（UI案のコンパクト形へ復帰）** — `Styles.html` に旧 `.modal-action-footer` + `.modal-footer-btn` の全幅セグメント定義（`flex:1` / `.primary-btn{flex:2}` / `padding:13px` / `border:none` / `#btnModalSave,#btnModalClose{border-right:none}`）が残存。コンテナ `.modal-action-footer` はHTML未使用だが、ボタンに付いた `.modal-footer-btn` クラス経由で `flex`/`padding`/`border` がコンパクトフッター（`.mfoot`）のボタンへ漏れ、UI案 `UI/modal_linear.html` の右寄せコンパクトボタンが全幅に引き伸ばされていた（タブ1.24と同じ「重複CSS後勝ち」パターン）。死んだブロックを削除し**フッターボタンCSSの正本を `.mfoot` ブロックに一本化**。あわせて `index.html` で配信停止/再開を `.mfoot-btns` 左端へ移動し `.fsp` を `設定` の前に置いて `設定/確認/保存` を右へまとめ（画像どおりの配置）、`.stop-resume-row` の独立バンドchrome（padding/border-top/bg）を除去しインライン化。ステータスピルは現状の単一ピル（確定済/配信停止中/配信予定）を維持（ユーザー判断）。staging @236。 | Claude Opus |
| 2026-05-29 | 1.24 | **形式タブが青背景のまま変わらない不具合の真因を除去** — `Client.html` 冒頭に `.modal-tabs-container` / `.modal-tab` を `!important` 付き青（`#1a73e8`）背景で再定義した重複 `<style>` ブロックがあり、`Styles.html` より後に読み込まれるため 1.21〜1.23 のタブCSS変更がすべて上書き無効化されていた。重複ブロックを丸ごと削除し、**タブCSSの正本を `Styles.html` に一本化**。これで下線型（1.23）が実際に反映される。 | Claude Opus |
| 2026-05-29 | 1.23 | **形式タブを下線（アンダーライン）型に変更** — 1.21 のセグメントコントロール型（角丸グレー枠+白背景）はユーザー意図と異なっていたため、画像指定の下線型に変更。コンテナ（`.modal-tabs-container`）は背景/枠なし+下端区切り線、各タブ（`.modal-tab`）は `flex:1` で等幅・全幅、アクティブは濃い文字+黒い下線（`Styles.html`）。 | Claude Opus |
| 2026-05-29 | 1.22.1 | **仕様書本文の整備（1.21/1.22 のあるべき姿を明文化）** — 4.5.2「設定・確認の赤塗りキー体系 ※あるべき姿」を新設し、`getCheckItemId` 正規化キーの正本・厳密一致のみ・`5.0` のサーバー書込失敗・アーカイブ列がフルリロード後の永続正本である点・検証手順を記載。3.2/3.3 にモーダルの4セクション分け（`sectionMap` 正本・空見出し非表示・新列は要追記）、形式タブのセグメントコントロール型、ヘッダーのメルマガ名全文表示と `.hf` 左寄せ/幅84pxを明文化。挙動変更なしのドキュメントのみ。 | Claude Opus |
| 2026-05-29 | 1.22 | **確定(is_fixed)後に「確認」赤(`is-active-red`)が消える不具合をキー体系の整合で修正** — 根本原因は2つ。①クライアント `getCheckItemId` (`ClientCheckStatus.html`) が `schedule_id`/`target_date` を正規化せず、ライブ(`app_schedule`)とアーカイブ(`app_schedule_archive`) で同じ発生分でも Sheets 表示値が `5`/`5.0` のようにブレるとキーが食い違い、設定時に保存したキーと確定後の描画時に検索するキーが不一致になっていた。さらに `5.0` 形式の itemId はサーバー `getSourceRowByScheduleId_` (getValues で `5`、`normalizeScheduleIdForMove_` は `.0` 非除去) で行を引けず、`saveDailyArchiveDiffsUnlocked_` のアーカイブ書き込み自体が失敗していた。→ `getCheckItemId` を `normalizeIdKey(schedule_id)` + `normalizeDateString(target_date)` の正規化キーに統一し、`fillRForDay` (`Client.html`) の raw キー構築も `getCheckItemId` 経由に変更。WIPの曖昧フォールバック (`key.includes`) は誤検出リスクのため撤去し厳密一致へ戻した。②サーバー `getArchivedOccurrenceRows_` (`DataArchive.gs`) がアーカイブシートの `check_setter_active`/`check_checker_active` を archive-specific 列として除外しており、フルリロード後 (メモリ上の `APP_DATA.checkStatuses` 保持が消える) に赤の唯一の根拠が失われていた。→ 両列のインデックスを引いて record に surface (空欄は付与せずクライアントの短絡を防ぐ)。①②は相補的で両方必須。 | Claude Opus |
| 2026-05-29 | 1.21 | **配信編集モーダルの①セクション再編 / ②形式タブ刷新 / ③ヘッダー調整** — ①`renderEditModalFields_` (`ClientModals.html`) の `sectionMap` を実キーで全面再定義 (旧定義は `user_age`/`user_area` 等の存在しないキーで大半が見出しなしだった)。`基本設定`(ID〜担当部署) / `メルマガ内容`(メルマガ内容〜パラメータ) / `ステータス`(新規〜検証中) / `抽出内容`(USER_年齢〜JOB_フリーワード) の4セクションへバケット振り分け方式で確実にグループ化 (シート列順非依存)。各 form-group に `data-section`、見出しに `data-section-head` を付与し、入力制御で全フィールド非表示になったセクションは `updateSectionHeadingVisibility_` で見出しごと隠す (`applyDynamicInputControl` 末尾で実行)。②形式タブを下線型からセグメントコントロール型 (角丸コンテナ + アクティブ白背景 + 微影、`.modal-tabs-container` / `.modal-tab` 刷新, `Styles.html`)。③`.name-text` を `white-space:normal` + `overflow-wrap:anywhere` でメルマガ名全文折り返し表示、`.hf` 幅 66→84px、`.hf-label`/`.hf-ctrl` を `text-align:left` に。 | Claude Sonnet |
| 2026-05-29 | 1.20 | **確認取り消し機能を追加** — 配信編集モーダルフッターの「確認」ボタンを確認済み時に「確認取り消し」(赤系) に切り替えられるよう変更。`initEditModalCheckButtons_` の `btnChecking.disabled` を撤廃し `is-cancel-mode` クラスで表現。`handleModalToggleChecking_` を新設し checker=false を保存（setter は保持）。`Styles.html` に `.checking-btn.is-cancel-mode` を追加 (通常サイズ・タブレットサイズ両方)。 | Claude Sonnet |
| 2026-05-29 | 1.19 | **設定済 / 確認済 時にヘッダー `設定`・`確認` 塗りが消える問題を修正** — `applySettingLock_` は設定済/確認済になると mhead 内の `.hf-ctrl.setter` / `.hf-ctrl.checker` を含む全 select に `disabled` を付けるが、ブラウザ既定の disabled スタイルが背景塗りを washout してしまい「設定の塗りが保持されない」状態になっていた。`Styles.html` に `.hf-ctrl.setter:disabled` / `.hf-ctrl.checker:disabled` セレクタを追加し、`color` / `background-color` / `border-color` を `!important` で固定、`opacity:1` と `-webkit-text-fill-color` (Safari の disabled select 文字色対策) でロック中も塗りを維持。`cursor:default` で操作不能を視覚化。 | Claude Sonnet |
| 2026-05-29 | 1.18 | **編集モーダル UIをUI/modal_linear.html 寄りに整える** — ①形式タブの並びを `抽出 → フリー → 自動求人特集 → その他` に変更 (`index.html` editModal/masterModal 両方)、②ロック表現を `opacity:0.4` の半透明フェードから「グレーボックス + 鍵アイコン(tabler ti-lock SVG を background-image)」に刷新 (`Styles.html` `.form-group.disabled` 配下 input/select/textarea。チェックボックスは引き続き opacity 0.6 で表現)、③`.modal-section-head` のはみ出し量を `form-grid` padding(12px) に合わせて `-12px` に補正、font-weight を 500→600 で視認性向上、Japanese 用に `text-transform:uppercase` を撤去。 | Claude Sonnet |
| 2026-05-29 | 1.17 | **編集モーダル ヘッダーの日付化**: `#mhead-id-time` の表示を `#SCH_xxx · HH:MM` から `YYYY/MM/DD/HH` (例: `2026/06/01/21`) に変更 (`ClientModals.html` `openEditModal_` 内, `target_date` の `-` を `/` に置換 + `hour` の HH 部分のみ採用)。**PR管理カードの「終了」ボタン削除** — 終了処理は編集モーダル経由のみに統一し、`renderPrCards()` 内のインライン `終了` 赤ボタンを撤去 (`Client.html` 1456-1461)。**ヘッダー凡例 + カレンダーバッジ統一** — `SCHEDULE_LEGEND_ITEMS` に `type:'badge'` を追加して PR 追加(緑)/削除(赤)/掲出中(ミュート) を凡例にも表示、`renderScheduleLegend_` で `pr-label` クラスをそのまま使用しカレンダー本体と完全同色化。`.legend-badge` CSS を追加。 | Claude Sonnet |
| 2026-05-29 | 1.16 | **Fix 4 を main へ取り込み** (モーダル通数(万)を `<input type="number" name="delivery_count">` で編集可能化、`.hf` 幅 46→66px、編集モーダルPR行に `pr-row-body` で本文表示、PR行ステータスマップ `'start'/'end'` → `'add'/'remove'` 修正、カレンダーPRラベル `div`→`span` + `.pr-labels-row` 横並びバッジ化・取り消し線廃止・追加=緑/削除=赤/掲出中=ミュート、`.month-end-header { background: transparent !important }` 削除でsticky時の透け解消、sticky thead 1行目 `height:70px` / 2行目 `top:70px`、CSS変数 `--color-month-end-bg` 導入で `.date-note` と `SCHEDULE_BACKGROUND_COLORS.monthEnd` を同色 `#d9d2e9` で連動、`.modal-scroll-body { overflow-x: hidden }` で横スクロール抑止)。staging `@208` 反映済み。 | Claude Sonnet |

## 1. 目的

スプレッドシート `【ウキ】新メルマガスケジュール` の `app_*` シート群をデータソースとして、メルマガ配信予定を週次カレンダーで確認・編集し、PR作業状態、進捗管理（設定・確認）、マスタ管理、および実績データの保全をWebアプリ上で一元管理する。
本システムは、「ヒューマンエラーをシステム構造によって物理的にゼロにする」ことを最優先事項とする。

## 2. 技術構成

- **実行基盤**: Google Apps Script (GAS) Webアプリ
- **サーバー側**: `Code.js` (エントリポイント), `DataService.gs` (コアロジック), `DataCommentService.gs` (コメント機能), `DataExceptionService.gs` (停止・例外制御)
- **画面側**: `Index.html` (ベース), `Styles.html` (CSS), 以下のJavaScriptコンポーネント:
    - `Client.html`: メイン制御・ルーティング
    - `ClientUtils.html`: ユーティリティ（日付、サイクル計算、正規化）
    - `ClientModals.html`: モーダル制御・入力制御ロジック
    - `ClientCheckStatus.html`: 設定・確認（赤塗り）状態管理・保存
    - `ClientComments.html`: コメント機能UI制御
- **デプロイ**: `clasp` による push およびバージョン管理された redeploy
- **主要データソース**:
    - `app_schedule`: 配信マスタ（繰り返しのスケジュール）
    - `app_pr`, `app_pr_targets`: PR本文と配信枠の紐付け
    - `app_comments`: 配信枠・日付ごとのコメント履歴
    - `app_schedule_archives`: 確定済み実績、設定・確認のチェック状態
    - `app_exceptions`: 日付単位の配信停止（例外）
    - `app_check_status`: 日付別の個別編集および移動（オーバーライド）

## 3. 画面構成とUI機能

### 3.1 配信カレンダー (メインビュー)
- **週次表示**: 7日間単位。火曜始まり〜月曜終わりを基本とする。
- **当日強調**: 今日の日付列を淡いブルーで強調し、ヘッダーに下線を表示。
- **サイクル表示**: `A1`, `B2`, `A3` 等のチップ表示。`3` の週は「(関西オープン)」を付記。
- **配信行 (delivery-row)**: `内容 / 通数 / 設定 / 確認` の4カラム Flexbox 構造。
- **一括操作**: 日別ヘッダーのボタンから「全停止」「再開」「R一括設定」が可能。
- **移動モード**: 「移動: ON/OFF」ボタンで切り替え。ON の間は Sortable.js によるドラッグ＆ドロップで配信枠を移動できる。移動完了時は `app_schedule` を直接更新せず、`app_check_status` の `move_override` に日付別移動情報を保存する。確定済みの枠は移動不可。
  - 元の配信日・元の時間へ戻した場合は `move_override` を解除し、変更アラートや日付別変更扱いにしない。
  - 移動後の再描画では、同一スロット内の同一配信枠を重複表示しない。元スロットには移動済みの元発生分を残さない。
  - **【移動→内容編集→再移動 複製禁止】**: 移動後に内容を個別編集（`occurrence_override`）し、さらに別の日へ再移動した場合、カレンダー上に同じメルマガが複製されてはならない。`move_override` の `delivery_date` を更新する際は、同一 `item_id` の `occurrence_override` が保持する `delivery_date` も新しい移動先に同期すること（旧移動先のスロットにゴースト表示が残ることを防ぐ）。
  - **【移動→配信編集（時間/曜日変更）複製禁止】**: 移動後に配信編集モーダルで時間または曜日を変更した場合、`occurrence_override.delivery_date` が `move_override.delivery_date` と異なる値になる。この場合、エントリーは `occurrence_override.delivery_date` の位置のみに表示し、`move_override.delivery_date` の元移動先スロットには表示しないこと。
  - **【編集後移動 内容引き継ぎ】**: 配信編集後（`occurrence_override.delivery_date = original_date` の状態）に移動した場合、移動先でも編集内容（`override_fields`）を引き継いで表示すること。
  - `end_date` を超えた配信枠は、PR紐付き状態や日付別移動・編集情報が残っていてもカレンダー上に表示しない。
  - 確認者が未設定の配信枠は、カレンダー上の確認者セルを赤塗り対象にしない。
  - 確定済みアーカイブ行の時間は、通常マスタと同じ時刻正規化でカレンダースロットへ復元する。
- **処理中表示 (Busy Overlay)**: 保存・更新・一括処理などサーバー通信を伴う操作中は、画面全体に「処理中...」のオーバーレイを表示し、二重操作を物理的に防止する。

### 3.2 モーダルUI/UX設計仕様
本システムのモーダル（配信編集およびマスタ新規追加）は、基本的に共通の入力項目セットをベースとする。**配信編集モーダルは、マスタ新規追加モーダルの基本項目をすべて網羅した上で、特定の日付・配信枠に特化した「独自機能」を付加した構成**となっている。

オペレーションのミス防止のため、共通して上・中・下の3層構造を採用する。

#### ［最上部：固定ヘッダーエリア（基本項目）］
- **メルマガ名（`mail_name`）**: テキスト表示。`readonly`（完全編集不可）。枠内またはアイコンクリックでクリップボードへコピー（`navigator.clipboard.writeText`）。
    - **全文表示**: メルマガ名は省略（`…`）せず**全文を折り返して表示**する（`.name-text` = `white-space:normal` / `overflow-wrap:anywhere`）。長名でも内容を隠さない（2026-05-29 / SPEC 1.21）。
- **設定者（`assignee`） / 確認者（`reviewer`）**: ドロップダウン（`<select>`）。`app_admin_master` から同期。
    - 設定者が `R` の場合、確認者は空欄にし、`disabled` かつ `required=false` とする。R枠は確認者入力を要求しない。
    - 設定者が `R` 以外の場合、確認者は有効化し、通常の必須選択に戻す。
- **ヘッダーボックス（`.hf` = 通数 / 設定 / 確認）**: 幅 84px・ラベルと値は**左寄せ**（`text-align:left`）。設定済/確認済で `applySettingLock_` により `disabled` になっても、設定は紫（`#f0f0fa`）・確認は緑（`var(--ok-bg)`）の塗りを `!important` + `-webkit-text-fill-color` で維持する（SPEC 1.19）。
- **日時表示（`#mhead-id-time`）**: `YYYY/MM/DD/HH` 形式（例 `2026/06/01/21`）。スケジュールID（`SCH_xxx`）はヘッダーに出さない（メルマガ名で識別）。

#### ［中央部：2カラム・グリッドエリア (`.form-grid`)（基本項目）］
- **新規（`is_new`）**: **【重要】必ずチェックボックス（`<input type="checkbox">`）として実装。** テキストエリアやテキストボックスは禁止。ラベルは「新規」。内部キー名は `is_new` とし、スプレッドシートの `is_new` 列と連動させる。
- **メルマガ内容 / 備考**: テキストエリア（`textarea`）。`grid-column: span 2;` で全幅表示。
- **その他項目**: 曜日、時間、通数、サイクル、形式、開始日、終了日、ターゲット属性等。
- **【項目のセクション分け】**（2026-05-29 / SPEC 1.21）: 配信編集モーダルの項目は次の4セクションに分けて見出し（`.modal-section-head`）付きで表示する。実装は `ClientModals.html` の `renderEditModalFields_` 内 `sectionMap`（キー→セクション名）が正本。
    1. **基本設定**: ID 〜 担当部署（`schedule_id` / `mail_type` / `format` / `cycle` / `weekday` / `hour` / `start_date` / `end_date` / `sub_category`）
    2. **メルマガ内容**: メルマガ内容 〜 パラメータ（`mail_content` / `mail_content_extract` / `mail_content_free` / `notes` / `pr` / `job_url` / `auto_job_feature_id` / `parameter`）
    3. **ステータス**: 新規 〜 検証中（`is_new` / `is_verifying`）
    4. **抽出内容**: USER_年齢 〜 JOB_フリーワード（`target_age` ほか USER_* / JOB_* / `current_job_count` / `auto_job_other_condition`）
    - **グループ化はシート列順に依存しない**: 各フィールドを所属セクションのバケットへ振り分けてから `sectionOrder` 順に描画する。
    - **空セクションの見出しは隠す**: 入力制御で全フィールドが非表示になったセクションは、見出しごと非表示にする（`updateSectionHeadingVisibility_` を `applyDynamicInputControl` 末尾で実行。form-group に `data-section`、見出しに `data-section-head` を付与して照合）。
    - **【注意】新しい列を追加したら `sectionMap` に必ず追記する**。未登録キーは見出しなしで末尾にまとめて出る（旧実装では存在しないキー名で大半が見出しなしになっていた）。

#### ［最下部：独自機能エリア（配信編集モーダル専用）］
配信編集モーダルでは、マスタ項目に加えて以下の動的・操作的機能が追加される。
1. **紐付いているPR**: 該当枠に紐づくPR情報を非同期表示。自由入力不可。
2. **コメント機能**: タイムスタンプ付きの申し送り履歴と新規入力枠。
3. **緊急コントロール**: 保存ボタン左に「配信停止」（赤）/「配信再開」（緑）ボタンを設置。
4. **アラート表示**: 自動求人特集などで求人数が 0 件の場合、モーダル内やカレンダー上に警告アイコン（`[!]`）を表示する。

### 3.3 各モーダルの個別仕様
- **形式タブの共通デザイン**（配信編集・マスタ共通 / 2026-05-29 SPEC 1.21）:
    - 並び順は `抽出 → フリー → 自動求人特集 → その他`（`index.html` の `modal-tabs-container`）。HTML 上の並びは表示順のみを決め、実際に開くタブは `setModalFormatState` が `CURRENT_ENTRY.format` に基づき active クラスを差し替える。
    - スタイルは**下線（アンダーライン）型**: コンテナ（`.modal-tabs-container`）は背景・枠なしで下端に区切り線（`border-bottom`）。各タブ（`.modal-tab`）は `flex:1` で**等幅・全幅**に並べる。アクティブタブ（`.modal-tab.active`）= 濃い文字 + 下に黒い下線（`border-bottom-color: var(--text)`）、非アクティブ = グレー文字・下線なし。配色/形状を変える場合は `Styles.html` の `.modal-tabs-container` / `.modal-tab` を編集する。
- **フッターボタンの共通デザイン**（配信編集モーダル / 2026-05-29 SPEC 1.25）:
    - 固定フッター `.mfoot` は上段にステータス行（`.mfoot-status`）、下段にボタン行（`.mfoot-btns`）。ボタンは**全幅セグメントではなく、右寄せのコンパクトボタン**（`UI/modal_linear.html` 準拠）。`設定`=薄紫（`.state-btn`）、`確認`=薄緑（`.checking-btn`）、`保存して閉じる`=濃色（`.primary-btn`）。
    - 配置: `.mfoot-btns` の左端に配信停止/再開（`.stop-resume-row`、JSがIDで表示制御）、続いて伸縮スペーサー `.fsp`、右側に `設定 / 確認 / 保存して閉じる` をまとめる。
    - **フッターボタンCSSの正本は `Styles.html` の「Compact modal footer (.mfoot)」ブロックのみ**。`.modal-footer-btn` を別ブロックで二重定義しないこと。過去 `.modal-action-footer` 用の旧定義（`flex:1` / `.primary-btn{flex:2}` / `padding:13px` / `border:none`）が残り、後勝ち＋ボタンへの `flex` 漏れでコンパクトボタンが全幅化する不具合が起きた（タブ1.24と同型の重複CSS事故）。
    - ステータスピル（`#delivery-status-pill`）は**単一ピル**（`確定済` / `配信停止中` / `配信予定`）。UI案 `modal_linear.html` の「設定済 → 確認待ち」2段進捗は実装しない（確定/停止という運用上重要な状態を優先するユーザー判断 / SPEC 1.25）。
- **マスタ新規追加 (#addMasterModal)**:
    - 最上部に「形式」タブ（上記共通デザイン）を配置。
    - **タブクリック時の連動ルール**:
        1. タブクリック時、即座に該当タブの名称を内部キー `format` に書き込む。
        2. 入力制限関数 `applyDynamicInputControl(format)` を即座に実行し、形式に応じたグレーアウト（有効/無効）を再評価する。
    - モーダルを開いた際はすべての項目をリセット（空に）し、強制的に「フリー」タブをアクティブにする。
- **配信編集モーダル (#editModal)**:
    - マスタ新規追加モーダルと同じ項目構成をベースとし、さらに最下部の「独自機能エリア」を有効化する。
    - モーダル上部に「この配信だけが修正されます。繰り返し設定のメルマガはマスタから編集してください。」と表示し、配信単位の変更であることを明示する。
    - メルマガ名はマスタから引き継ぎ、編集不可（コピー専用）とする。
    - **【配信編集専用ロック】**: 配信実績の整合性を保つため、スプレッドシート「入力制御」シートの指定に従い、以下の項目を全形式で編集不可（グレーアウト）とする。
        - **配信編集専用ロック対象**（全形式共通）: `start_date`、`end_date`、`mail_name`、`mail_type`、`cycle`、`format`、`sub_category`、`is_new`、`weekday`、`is_verifying`。実装は `ClientModals.html` の `applyInputControlMatrix_` 関数が正。
    - 編集内容は `app_check_status` の `occurrence_override` に保存される。
    - **【個別編集の永続化】**: 変更された項目名（内部キー）は `override_fields` 列にカンマ区切りで記録される。サーバー側で既存の `override_fields` とマージして保存するため、時間移動の後に設定者を変更するなど、複数回の編集を行っても過去の変更が消失することはない。
    - 保存時はスコープ確認モーダルを表示する（変更項目が0件の場合はスキップ）。選択肢は「この日だけ変更」と「●/●〜[日付]まで」の2つ。後者は日付ピッカーで終了日を選択し、エントリのサイクル定義に基づいて範囲内の発生日を算出→プレビュー件数を表示→`saveOccurrenceOverrideRange` で一括保存。編集内容は各発生日の `occurrence_override` に保存される (1.38)。
    - マスタ由来の元値（`CURRENT_ENTRY_BASE`）と入力値を比較し、値が異なる項目は赤系ハイライト（`.is-overridden`）で表示する。
    - 比較キーは保存時と同じ正規化に合わせ、`setter` は `assignee`、`checker` は `reviewer`、`new_flag` は `is_new` として扱う。チェックボックス値は `TRUE` / `FALSE` 相当、時間は `H:00`、曜日・日付は正規化値で比較する。
    - `時間` はカレンダー表示用の一時値ではなく、`app_schedule` のマスタ行を元値とする。配信回ごとの時間変更がある場合だけ差分として赤表示し、`occurrence_override` へ保存する。
- **マスタ編集モーダル (#masterModal)**:
    - 既存マスタ編集時はモーダル上部に「確定済・確認済みではない同じメルマガ予定がすべて変更されます。」と表示し、未確定・未確認の予定へ影響することを明示する。PR管理および新規追加では表示しない。
    - モーダルのラベルは、内部キー名ではなく `app_schedule` の実ヘッダー名を優先して表示する。
    - `担当部署`、`自動求人特集_ID/_URL/_求人数`、`USER_*`、`JOB_*` などは、マスタ保存・配信編集差分・カレンダー再読込後の表示が同じ内部キーで連動する。
    - マスタ新規・編集モーダルは青系の見出し・左ラインで表示し、配信編集の赤い日付別差分と視覚的に区別する。
- **PR管理モーダル**: 入力制御シートの「PR管理専用 入力項目・配置マトリクス」に従う。形式タブと配信停止操作は非表示。メルマガ専用項目（通数・サイクル・曜日・時間・確認者等）は排除。PR IDは `readonly` とし、保存時にGAS側で最大値から自動採番。PRタイトル・PR本文・PRが入るメルマガ選択を編集対象とする。
- **PR ID表示必須**: PR管理では、一覧列と新規/編集モーダルの両方に必ず PR ID を表示する。値は編集不可とし、ヘッダー名が `PR ID` / `pr_id` / `PR_ID` 系のいずれでも同じ PR ID として扱う。
- **PR紐付け**: `app_pr.PR ID` と `app_pr_targets.PR ID` が一致する場合に紐づいたメルマガとして扱う。`app_pr_targets` 側では行自体の `ID` / `id` をPR IDとして代用しない。
- **マスタ停止/再開**: マスタ編集では停止済み行に再開ボタンを表示する。停止・再開・削除は保存/キャンセルと同じ行に置かず、誤操作を避けるため独立した操作行に配置する。
- **下書き保存**:
  - **作成**: 新規追加モーダルにのみ「下書き保存」ボタンを表示する。既存行の編集モーダルには表示しない。
  - **保存値**: 下書き保存時は `is_draft = TRUE`、通常保存時は `is_draft = FALSE`（下書き状態を解除）。
  - **一覧での表示**: 下書き行はメルマガ一覧に表示する。ただし「配信中」ステータスフィルターでは除外し、「すべて」または「下書きのみ」フィルター時に表示する。
  - **下書きフィルター**: 一覧フィルターに「下書きのみ」チップを用意する。ON にすると下書き行のみ表示（他フィルター：キーワード・担当部署・形式・種別は引き続き AND 条件で効く）。
  - **カレンダー**: 下書きはコンテンツの内容にかかわらずカレンダーに掲出しない。
  - **PR判定**: 下書きはPR紐付け判定の対象外とする。
- **一覧列**: メルマガ一覧・PR一覧はスプレッドシートのヘッダー順を基準に表示する。アプリが補助的に生成する独自列（例: `target_mails`）は右端へ追加する。

### 3.4 一覧検索・フィルタ機能設計仕様
「メルマガ一覧」タブにおける検索エリアは、膨大な配信データの中から「今チェックすべき対象」を1クリックで瞬時に絞り込めることを目的とする。

#### ［レイアウト・UI構造］
画面上部の見出し下部に、すべてのフィルタ項目を同じデザインのチップ（インライン・プルダウン形式）で統一して綺麗に横並びで配置する。
`［状態: ▼］ ［新規のみ］ ［検証中のみ］ ［下書きのみ］ ［担当部署: ▼］ ［形式: ▼］ ［種別: ▼］`

#### ［フィルタ項目マトリクス］
状態、サブカテゴリ、形式、種別は `<select>` 要素（チップ）として、新規のみ・検証中のみ・下書きのみは `<button>` 要素（アクティブ時に青背景）として実装する。

| フィルタ項目名 | UIの型 | 選択肢 | 初期値 | ロジック（GAS/JS連動） |
| --- | --- | --- | --- | --- |
| **状態** | `select` | 配信中 / すべて / 配信終了 | 配信中 | `end_date` を過ぎているか `is_inactive=TRUE` のものを「配信終了」とする。`is_draft=TRUE` の行は「配信中」から除外し、「すべて」でのみ表示する。 |
| **新規のみ** | `button` | (トグル式) | OFF | 有効時、`is_new` 列が「TRUE」のレコードだけを抽出。 |
| **検証中のみ** | `button` | (トグル式) | OFF | 有効時、`is_verifying` 列が「TRUE」のレコードだけを抽出。 |
| **下書きのみ** | `button` | (トグル式) | OFF | 有効時、`is_draft` 列が「TRUE」のレコードだけを抽出。ON 時は状態フィルターを無視し、他の AND 条件（キーワード・担当部署・形式・種別）は引き続き有効。 |
| **担当部署** | `select` | すべて / 商品 / (各個別名) | すべて | `担当部署`（旧 `サブカテゴリ`）列と連動。「商品」選択時は部分一致、その他は完全一致。 |
| **形式** | `select` | すべて / フリー / 抽出 / 自動求人特集 / その他 | すべて | 「形式」列で絞り込み。 |
| **種別** | `select` | すべて / (各種別名) | すべて | 「種別」列（MA/イレギュラー/隔週等）と連動。 |

#### ［検索・連動ロジックの共通仕様］
- **AND検索（掛け算切り替え）の保証**: すべてのチップおよびキーワード入力は、「すべて掛け算（AND条件）」で即座に作動すること。
- **自動トリガー**: チップの選択が変更された瞬間（change イベント）、再読込ボタンを押さずとも即座に一覧の再描画（フィルタリング）が走る仕様とする。

## 4. 内部ロジック・データ詳細仕様

### 4.1 入力制御シート仕様

入力制御の正本はスプレッドシート `入力制御` シート。アプリ側はこのシートを `DataService.gs` の `getInputControlRows_()` で読み込み、`APP_DATA.inputControls` としてクライアントへ渡す。入力制御を変更するときは、コードに条件を直書きする前に、まずこのシートへ行・列として表現できるかを確認する。

#### シート全体の構成

`入力制御` は、1枚のシート内に以下のブロックを縦に並べる。各ブロックのタイトル行は左端セルだけに文字を入れ、次の行に `画面` / `モーダル` から始まる見出し行を置く。

| ブロック名 | 役割 | 実装側の読み分け |
| --- | --- | --- |
| `タブ別入力制御` | メルマガ配信系モーダルの、形式タブ別の表示・ロック・非表示を定義する。 | `getInputControlStateFromSheet_()` が `__section` に `タブ別` を含む行だけを見る。 |
| `サイクル別入力制御` | サイクル値による追加ロックを定義する。例: 単発、月末増発。 | `getInputControlCycleStateFromSheet_()` が `__section` に `サイクル別` を含む行だけを見る。 |
| `PR管理専用 入力項目・配置マトリクス` | PR管理の新規・編集モーダルの専用項目を定義する。 | PR管理モーダル時のみ `getInputControlStateFromSheet_()` が `__section` に `PR管理専用` を含む行を見る。 |

`getInputControlRows_()` は、ブロックタイトルを `__section` として各データ行へ付与する。これにより、同じ `画面` / `モーダル` 見出しを複数ブロックで使っても、タブ別・サイクル別・PR管理専用が混ざらない。

#### ブロック共通の読み取りルール

- 見出し行は `画面`、`モーダル` で始める。ここをブロック開始として扱う。
- データ行は、次の空行または次の `画面` / `モーダル` 見出し行までを同一ブロックとして読む。
- `画面` 列は人間向けの画面名、`モーダル` 列は実際の照合に使うモーダル名。コード上の照合は `row['モーダル']` を優先し、`画面` 列と混同しない。
- `タブ` 列は `フリー`、`抽出`、`自動求人特集`、`その他` の形式別制御に使う。PR管理専用では空欄でよい。
- 項目列の値は `表示`、`ロック`、`非表示` のいずれかを先頭に書く。`非表示(ボタンのみ表示)` や `ロック/開始日を入れたら...` のような補足付き表記も、先頭語で状態を判定する。

#### 状態語の意味

| 状態語 | UI上の動作 | 実装の扱い |
| --- | --- | --- |
| `表示` | 入力欄を表示し、編集可能にする。 | `hidden=false`、`disabled=false`、`readOnly=false`。 |
| `ロック` | 入力欄を表示したまま編集不可にする。 | `disabled=true`、可能な要素は `readOnly=true`。 |
| `非表示` | 入力欄を画面から隠す。 | `hidden=true`、`display:none`、`disabled=true`。 |

英語表記の `show`、`editable`、`lock`、`locked`、`readonly`、`hidden`、`hide`、`none` も互換として扱えるが、仕様書・シート上の正規表記は日本語の `表示`、`ロック`、`非表示` とする。

#### タブ別入力制御

`タブ別入力制御` は、メルマガ配信系の `配信編集モーダル`、`マスタ新規追加モーダル`、`マスタ編集モーダル` を、形式タブごとに制御する横長のマトリクスである。

| 列 | 内容 |
| --- | --- |
| `画面` | 例: `配信カレンダー`、`メルマガ一覧`。人間向けの分類。 |
| `モーダル` | 例: `配信編集モーダル`、`マスタ新規追加モーダル`、`マスタ編集モーダル`。コード照合の主キー。 |
| `タブ` | `フリー`、`抽出`、`自動求人特集`、`その他`。 |
| 以降の項目列 | `ID`、`曜日`、`時間`、`開始日`、`終了日`、`メルマガ名`、`通数`、`種別`、`サイクル`、`形式`、`担当部署`、`メルマガ内容(抽出)`、`メルマガ内容(フリー)`、`備考`、`新規`、`検証中`、`設定者`、`確認者`、`USER_*`、`JOB_*`、`自動求人特集_*`、`確定済`、`配信停止`、`下書き`。 |

配信編集モーダルは配信実績の整合性を守るため、全形式で `start_date`、`end_date`、`mail_name`、`mail_type`、`cycle`、`format`、`sub_category`、`is_new`、`weekday`、`is_verifying` をロック対象とする。シート上の指定がある場合はシート値を優先し、コード側の初期値は安全側のデフォルトとして扱う。

`is_fixed`、`is_inactive`、`is_draft` はボタンや外部フローで管理するため、全モーダルのフォーム入力欄としては常時非表示とする。シートには `非表示(ボタンのみ表示)` のように運用意図を書いてよいが、入力欄としては表示しない。

#### 形式別の主な表示差

| 項目 | フリー | 抽出 | 自動求人特集 | その他 |
| --- | :---: | :---: | :---: | :---: |
| `mail_content_extract` | 非表示 | 表示 | 表示 | 表示 |
| `mail_content_free` | 表示 | 非表示 | 非表示 | 表示 |
| `auto_job_feature_id`、`job_url`、`current_job_count`、`auto_job_other_condition` | 非表示 | 非表示 | 表示 | 表示 |
| `job_location`、`job_type`、`job_keyword` | 表示 | 表示 | 非表示 | 表示 |

`current_job_count` は自動取得値のため、自動求人特集で表示する場合もロックする。

#### サイクル別入力制御

`サイクル別入力制御` は、形式タブではなく `cycle` の値による追加制御を定義する。現行の主なルールは以下。

| サイクル値 | 追加制御 |
| --- | --- |
| `単発` | `weekday` をロック。開始日が入ったら終了日も同日に自動補完する。 |
| `毎日配信` | `weekday` をロック。 |
| `月末増発` | `start_date`、`end_date` をロック。月末から1週間前までの配信期間として扱う。 |

空欄のセルは「変更なし」として扱う。タブ別制御で決まった状態を、サイクル別制御が必要な項目だけ上書きする。

#### PR管理専用入力制御

PR管理はメルマガ配信系モーダルとは項目体系が異なるため、`PR管理専用 入力項目・配置マトリクス` ブロックを正とする。形式タブは表示しない。

| 項目 | 制御 |
| --- | --- |
| `PR ID` (`pr_id`) | 表示するがロック。保存時にサーバー側で自動採番する。 |
| `PRタイトル` (`name`) | 表示。 |
| `開始日` / `終了日` | 表示。 |
| `PR本文` (`pr_text`) | 表示。 |
| `備考` (`notes`) | 表示。 |
| `紐づいたメルマガ` / `PRが入るメルマガを選択` | 表示。チェックリストで `app_pr_targets` と同期する。 |
| `配信終了` / `削除` | 一覧・操作ボタン側で扱う。入力欄として扱わない。 |

#### 実装の適用順

制御関数の呼び出し順は以下を正とする。

1. `applyDynamicInputControl(format, modalId)`
2. `resetModalFieldStates_(modal)`
3. `applyInputControlMatrix_(modal, format)`
4. `getInputControlStateFromSheet_(key, modalKey, formatKey)`
5. `applyAutoJobFieldControls_(modal, isAutoJob)`
6. `applyEditModalLockedFieldControls_(modal)`
7. `applyCurrentJobCountControls_(modal, isAutoJob)`
8. `applyValidationCycleControls_(modal)`
9. `applyCycleInputControlMatrix_(modal)`
10. `applyPrMasterControls_(modal)`

入力制御シートの構成を変えた場合は、`DataService.gs` の `getInputControlRows_()`、`ClientModals.html` の `getInputControlSectionRows_()`、`getInputControlStateFromSheet_()`、`getInputControlCycleStateFromSheet_()` が同じ前提で読めることを確認する。

#### カレンダー色分けルール

| 条件 | 種別 | 色コード |
| --- | --- | --- |
| `is_verifying = TRUE` または サイクル = 「単発」 | 行背景色 | `#d9e6fc`（水色） |
| サイクル = 「月末増発」 | 行背景色 | `#d9d2e9`（薄紫） |
| `sub_category` が「商品」系 | 行背景色 | `#d9ead3`（薄緑） |
| サイクル = 「隔週A」 | 左端ライン | `#9bd283`（緑） |
| サイクル = 「隔週B」 | 左端ライン | `#e171c0`（ピンク） |
| 特殊サイクル（ポジションマッチ等） | 左端ライン | `#8e7cc3`（紫） |

色ルールの正本は `Client.html` の `SCHEDULE_BACKGROUND_COLORS` / `SCHEDULE_LINE_COLORS` / `SCHEDULE_LEGEND_ITEMS`。色変更時は必ず凡例も同時更新する。

### 4.2 PR管理専用 入力項目・配置マトリクス
PR管理画面の新規追加・編集における専用の制御ルール。

| 項目名 (内部キー) | 要素の型 | 配置 | 制御ルール |
| --- | --- | --- | --- |
| **PR ID** (`pr_id`) | `input[text]` | グリッド左上 | 🚫 **入力不可（readonly）**。保存時にGASが自動採番。 |
| **PRタイトル** (`name`) | `input[text]` | グリッド右上 | 🟢 必須入力。管理用タイトル。 |
| **PR本文** (`pr_text`) | `textarea` | グリッド中段 | 🟢 必須入力。実際のPRテキスト文章。 |
| **挿入位置** | `input[text]` | グリッド中段 | 🟢 任意入力。メモ欄。 |
| **紐づいたメルマガ** | `div` | グリッド下段 | 🚫 手入力不可。下部チェックリストの選択内容が自動同期。一覧画面では、紐付けられたメルマガ名をカンマ区切りで表示する。 |

### 4.3 サイクル判定ロジック
- **単発**: `cycle` が「単発」の場合、開始日の1日限りで配信する。開始日が入力されたら終了日も同日に自動補完し、GAS保存時も同じルールを適用する。
- **基準日**: `2026/04/28 (火)`。
- **計算**: 基準週からの経過週数 `diffWeeks` を使用。
    - A/B週: `diffWeeks % 2` (0=A, 1=B)
    - 1/2/3週: `diffWeeks % 3` (0=1, 1=2, 2=3)
- **毎月第N週目サイクル (M1〜M4)** *(2026-05-29 追加)*:
    - `cycle` 列に「毎月第1週目」〜「毎月第4週目」(または「第1週」〜「第4週」を含む値) を入れると、内部コード `M1`〜`M4` に正規化される (`normalizeCycleLabel`)。
    - 配信判定は **`weekday` 一致 AND その日が月の第N週**で成立 (`isNthWeekOfMonth(date, n) === (Math.floor((date.getDate() - 1) / 7) + 1 === n)`)。
    - 第N週の数え方: 1日〜7日 = 第1週、8日〜14日 = 第2週、15日〜21日 = 第3週、22日〜28日 = 第4週。29日以降は第4週扱いではなく対象外 (第5週相当)。
    - 例: `cycle = '毎月第2週目'`、`weekday = '火'` → 各月の 8日〜14日にあたる火曜日のみ配信。
- **優先順位（マニュアル上書き）**:
    1. **今週サイクル(内部)**: スプレッドシートの該当列に値がある場合、計算式の結果を無視してその値が優先される。
    2. **今週非配信(内部)**: 該当列に `TRUE`（または `1`, `済` 等）がある場合、その週の配信は強制的に非表示となる。
- **複数指定の許容**: `cycle` 列に `A,B` や `1,3` のように複数指定がある場合、`cycleContains` ロジックにより「いずれかに合致すれば配信」と判定される。

### 4.4 PRラベル判定と優先順位

#### スキーマ（app_pr / app_pr_targets）

**`app_pr` シート列順序（変更禁止）**

| 列ヘッダー | 内部キー | 型 | 説明 |
| --- | --- | --- | --- |
| `PR ID/pr_id` | `pr_id` | 数値文字列 | 自動採番。1始まりの連番。読取専用。 |
| `PRタイトル/name` | `name` | 文字列 | 管理用タイトル。 |
| `開始日/start_date` | `start_date` | 日付文字列 (YYYY-MM-DD) | PR掲出開始日。 |
| `終了日/end_date` | `end_date` | 日付文字列 | PR掲出終了日。 |
| `PR本文/pr_text` | `pr_text` | 文字列 | メルマガに挿入するPR文章。 |
| `備考/notes` | `notes` | 文字列 | 運用メモ。 |
| `配信終了/is_inactive` | `is_inactive` | `TRUE`/`FALSE` | 終了日が過去の場合 GAS 側で自動設定。手動不可。 |

**`app_pr_targets` シート列順序（変更禁止）**

| 列ヘッダー | 内部キー | 型 | 説明 |
| --- | --- | --- | --- |
| `ID/pr_id` | `pr_id` | 数値文字列 | `app_pr.pr_id` と一致する値。外部キー。 |
| `メルマガ名/mail_name` | `mail_name` | 文字列 | `app_schedule.mail_name` と完全一致する値。 |

> **重要**: `app_pr_targets` に列を追加・削除・並び替えしてはならない。上記 2 列のみが唯一の正規構造。`is_inactive` 列は持たない（不要なため）。

#### PR保存時の紐付け更新ルール

- UI 上のチェックボックスにチェックした `mail_name` だけが `app_pr_targets` に保持される。
- **チェックを外したメルマガ行は即時削除**される（is_inactive 方式は使わない）。
- 実装: `savePRDataUnlocked_` が該当 `pr_id` の既存行をすべて削除し、チェック済みのものだけ再挿入する。

#### 紐付け判定ロジック（クライアント側 `getPrRecordsForSchedule`）

| 優先順位 | 判定方法 | 実装 |
| --- | --- | --- |
| 1 | `app_pr_targets.mail_name` ＝ `app_schedule.mail_name` | `targetsByMailName` ルックアップ |
| 2 | `app_schedule.pr` 列に PR ID が直接記入 | 旧方式。直接 `pr`/`PR` フィールドを参照 |

> **旧仕様の廃止**: `app_pr.target_ids`（`schedule_id` のカンマ区切り文字列）による紐付け方式は廃止。同列はシートに存在せず、コード上でも参照しない。
>
> **PR管理一覧の「紐づき先」バッジ表示** *(2026-05-29 修復)*: `renderPrCards()` も同様に `APP_DATA.prTargets` を `pr_id` 別に集約して使用する。冒頭で `prTargets` を `pr_id → [mail_name, ...]` の Map に変換し (inactive/draft 除外)、各カードで `pr_id` を `normalizeIdKey` 経由で引いて `.mail-chips` / `.mc` バッジ表示する。掲出中PRは `.mc.live` (ピンク)、それ以外はミュート。重複除去 + ロケール順ソート。旧 `target_ids` カラム経由の参照は後方互換 fallback として残置 (新方式で空のときのみ)。**「紐づき先」が描画されないバグは過去に発生済み — 必ず `APP_DATA.prTargets` を正本として参照すること**。

- **状態ラベルの判定**: カレンダーおよび配信編集モーダルでは、紐づいた PR ごとに開始日・終了日を個別判定し、同じメルマガに複数 PR が紐づく場合も該当する PR をそれぞれ表示する。
    - `add` (追加): 開始日を含み、開始日から7日間。表示ラベルは「PR[ID] 追加」。
    - `active` (掲出中): 開始日から終了日まで。終了日当日は掲出中として表示する。表示ラベルは「PR[ID] 掲出中」。
    - `remove` (削除): 終了日を含まず、終了日の翌日から7日間。表示ラベルは「PR[ID] 削除」。
- **表示スタイル**: すべての PR ラベルは一貫したチップ（タグ）形式のスタイルで表示され、状態（追加・掲出中・削除）に応じた配色が適用される。特に「追加」「削除」は掲出中よりも目立つ配色とする。
- **カレンダー表示の個別化**: カレンダーの同一スロット内に複数のメルマガが存在し、それらが同じ PR に紐づいている場合、各メルマガの下に個別に PR ラベルが表示される。以前存在した「PR N件紐づき」というサマリー表示は廃止した。
- **表示対象外**: 開始日前、および終了日の翌日から7日を過ぎた PR は、カレンダーにも配信編集モーダルにも表示しない。開始日・終了日の両方が未設定で状態判定できない PR も表示しない。

### 4.5 状態管理（設定・確認）と確定保存ロジック
- **ローカル保存**: カレンダー上の「設定」「確認」セルをクリックすると、赤塗り（済み）/白塗り（未）が切り替わる。この変更は即座にサーバーへは送信されず、ブラウザの `localStorage` に一時保存される。
- **【設定・確認は内容編集で外れない】**: 「設定」または「確認」が赤塗りの状態で配信編集モーダルを開き、**設定・確認以外の内容**（メルマガ名・メール内容・時間など）を変更・保存しても、設定・確認の赤塗り状態は変化してはならない。設定・確認自体を変更した場合のみ、その変更が反映される。（実装上の注意: モーダル保存後の `loadData` 再取得では、サーバーは setter/checker 状態を返さないため、クライアントはローカルの setter/checker 状態を `loadData` 前後で維持すること。）
- **一括確定保存**: 画面右上の「保存」ボタン（未保存がある場合のみ表示）を押すことで、変更内容がサーバーへ一括送信される。
- **確定済みの定義**:
    - 通常枠（設定者が人間）: 「確認」が赤塗りの場合、その枠は「確定済み（Fixed）」とみなされる。
    - R枠（設定者が R）: 「設定」が赤塗りの場合、その枠は「確定済み（Fixed）」とみなされる。
- **保存先**: 確定した配信枠のデータ（設定者・確認者の状態を含む）は、`app_schedule_archives` に保存される。これにより、将来的にマスタが変更されても、過去の配信実績が保全される。
- **時間値の扱い**: スプレッドシートやアーカイブから `1899/12/30 13:00` のような日付時刻形式で時間が返っても、カレンダー上では時刻部分のみを正として扱う。確認済み/R設定によるアーカイブ後も、時刻形式の揺れだけで枠を非表示にしてはならない。

### 4.5.1 設定者・確認者連動ロジック
- 「設定者（`setter`）」プルダウンで `R` を選択した場合、システムは即座に「確認者（`checker`）」を入力不可（`disabled`）にし、選択値をクリアする。
- R選択時の確認者は必須入力ではない。`required` は必ず外し、保存時バリデーションでブロックしてはならない。
- 「設定者」が `R` 以外に変更された場合、確認者のロックを解除し、通常の必須選択に戻す。

### 4.5.2 設定・確認の赤塗り（`is-active-red`）キー体系 ※あるべき姿（2026-05-29 追記 / SPEC 1.22）

設定・確認の赤塗りは「キーで状態を引く」仕組みのため、**保存時のキーと描画時のキーが完全一致**していなければ赤が消える。過去、確定（is_fixed）後にキーが食い違って赤が消える不具合が発生したため、以下を正本として固定する。

- **キーの正本は `getCheckItemId(row)` （`ClientCheckStatus.html`）**: `normalizeIdKey(schedule_id) + "|" + normalizeDateString(target_date)` を返す。設定/確認の itemId を組むあらゆる箇所（カレンダー描画・モーダル・`fillRForDay` 等）は**必ずこの関数を通す**こと。`` `${scheduleId}|${dateStr}` `` のような raw 連結を新規に書かない。
    - **理由**: 同じ発生分でも、ライブ（`app_schedule`）とアーカイブ（`app_schedule_archives`）で Sheets の表示値が `5` / `5.0` のようにブレる。正規化しないと「設定時に保存したキー」と「確定後にアーカイブ由来エントリで描画する際に検索するキー」が食い違い、`active=TRUE` なのに赤くならない。
    - **`normalizeIdKey`**: `5.0` → `5` のように末尾 `.0` を除去。**`normalizeDateString`**: 日付表記を `YYYY-MM-DD` に統一。
- **判定は厳密一致のみ**: `isCheckStatusActive` は `LOCAL_CHECK_CHANGES` → アーカイブ → `APP_DATA.checkStatuses` の順に**完全一致キー**で引く。`key.includes(itemId)` のような部分一致フォールバックは**禁止**（`5` が `15|...` に誤マッチするため）。キーがずれるなら正規化側を直す。
- **`5.0` はサーバー書き込みも壊す**: 設定/確認保存は payload 空で itemId のみ送るため、サーバーは `itemId` から `schedule_id` を導く。`5.0` 形式だと `getSourceRowByScheduleId_`（`getValues()` で `5`、`normalizeScheduleIdForMove_` は `.0` を除去しない）が行を引けず、`saveDailyArchiveDiffsUnlocked_` のアーカイブ書き込みが**無言で失敗**する。クライアントが `getCheckItemId` で正規化して `5` で送ることでこの経路も成立する。
- **確定発生分の active はアーカイブ列が永続正本**: サーバー `getCheckStatuses_` は `setter` / `checker` を返さない（仕様）。セッション中はクライアントが `APP_DATA.checkStatuses` をメモリ保持して維持するが、**フルリロード（F5）するとメモリ保持は消える**。そのため確定後の赤の唯一の根拠は `app_schedule_archives` の `check_setter_active` / `check_checker_active` 列となる。
    - サーバー `getArchivedOccurrenceRows_`（`DataArchive.gs`）はこの2列を各 record に surface すること。これらは archive-specific 列のため `scheduleColumnIndices` から除外されており、明示的にインデックスを引いて付与する必要がある（surface しないとフルリロード後に赤が消える）。
    - **空欄は付与しない**: 明示的な diff 未保存（空セル）の発生分には `check_*_active` プロパティを付けない。付けるとクライアント `getArchivedCheckStatusActive` が `false` 確定で短絡し、セッション中の `APP_DATA.checkStatuses` 保持を隠してしまう。
- **検証手順**: ①設定/確認を赤にする → ②確定 → ③ブラウザを完全リロード → ④赤が維持されること。`5.0` になりやすい数値ID枠でも消えないこと。

### 4.6 停止・例外制御ロジック
- **例外データ管理**: 特定の日付・配信枠の停止状態は `app_exceptions` シートで管理される。
- **ユニークキー**: `schedule_id` + `target_date` の組み合わせを内部キーとして使用。
- **一括処理**: 日別ヘッダーからの「全停止」「再開」は、スプレッドシートへのバルク書き込み（`setValues`）により高速に処理される。
- **優先順位**: 確定済みの枠は、個別停止・一括停止のいずれの操作も受け付けない。

### 4.7 コメントシステム
- **スレッド管理**: `app_comments` シートに `schedule_id` + `target_date` 単位で保存。同じ配信枠でも週が変わればコメントはリセットされる（過去分は履歴として保持）。
- **キャッシュ利用**: `CacheService` (ScriptCache) を使用し、コメント一覧および件数バッジの読み込みを高速化。有効期限は300秒。
- **自動通知**: コメント投稿時、UI側へ即座に反映される。

### 4.8 自動求人件数と数式自動挿入
形式が「自動求人特集」かつURL入力がある場合、GAS側（`saveMasterData`等）で「現在求人数」セルに以下の数式を動的に生成して書き込む。
```excel
=IFERROR(IMPORTXML([URLセル], "/html/body/form/div[1]/div[3]/main/div/div/div[2]/div/span[1]"))
```
※定期実行トリガー（毎週火曜4時）による数値の直接更新も併用可能。

### 4.9 クライアント側状態同期と永続化
- **localStorage による保護**: 設定・確認セルの赤塗り状態は、変更のたびに `localStorage` (`mailMagazineMaker.pendingCheckStatuses.v1`) へ一時保存される。これにより、ブラウザのクラッシュや誤操作によるリロード後も未保存状態を復元できる。
- **離脱防止ガード**: 未保存の変更がある状態でタブを閉じようとすると、`beforeunload` イベントによりブラウザの警告ダイアログが表示される。また、ページ終了時に自動的に `localStorage` への最終書き込み（Flush）が実行される。

### 4.10 ID自動採番仕様
新規マスタ追加時、以下のルールでIDが自動生成される：
- **メルマガ (`app_schedule`)**: `SCH_` + 3桁連番 (例: `SCH_001`)。
- **PRターゲット (`app_pr_targets`)**: `PRT_` + 3桁連番 (例: `PRT_001`)。ただし現行シートには `pr_target_id` 列が存在しないため採番されない。
- **PRマスタ (`app_pr`)**: 連番の数値文字列 (例: `165`, `166`)。プレフィックスなし。
- **採番ロジック**: 該当シートの全行を走査し、現在の最大値 + 1 を採用。`x.0` 形式の数値も正規化して比較する。

### 4.11 システム安全策と保全
- **排他制御 (LockService)**: スプレッドシートへの全書き込み処理（マスタ保存、コメント、停止操作等）は `withScriptLock_` 関数を経由し、30秒間のスクリプトロックを取得して競合を防止する。
- **自動アーカイブ**: 90日を経過した運用ログ（赤塗り履歴、コメント、停止例外）は、毎月1日の定期実行トリガーにより各 `_archive` シートへ自動退避される。
- **外部連携**: 日本の祝日情報は Google カレンダー API から取得し、6時間キャッシュすることでAPI制限と速度低下を回避。

### 4.12 内部データ構造の原則（Header-based Mapping）
- **プロパティ名の同期**: 全てのデータ操作（取得・保存）において、スプレッドシートの1行目（ヘッダー名）をオブジェクトのキーとして直接使用する。
- **エイリアス禁止**: 実装コード内での独自の英語名への変換やハードコーディングを避け、シート構成の変更に強い構造を維持する。
- **現行列名と旧列名の互換**: 現行の `担当部署` は旧 `サブカテゴリ` と同じ内部キー `sub_category` として扱う。`自動求人特集_ID/_URL/_求人数`、`USER_*`、`JOB_*`、`配信終了` はマスタ保存・配信編集差分・カレンダー再読込後の表示が同じ内部キーで連動する。
- **ラベル表示**: マスタ編集・配信編集モーダルでは、内部キー名よりも `app_schedule` の実ヘッダー名を優先してラベル表示する。列名を変更した場合は、表示名、エイリアス、`app_check_status` の保存列を同時に確認する。

#### 列名の `日本語/英語` 統一仕様（2026-05-26 追記）

| 層 | ルール |
| --- | --- |
| スプレッドシート | ヘッダーは `日本語/英語`（例: `設定者/assignee`、`種別/mail_type`）または日本語のみ（例: `設定者`）を許容する。運用の正はシート上のヘッダー行。 |
| サーバー内部 | `SCHEDULE_FIELD_ALIASES` 等でヘッダーを **内部キー（英語）** に正規化して読み書きする。`getMasterData` / `getScheduleRows_` の返却オブジェクトは原則として内部キーのみを持つ。 |
| 画面表示 | ユーザー向けラベル・フィルター名・凡例は **日本語** を正とする。`DISPLAY_NAMES` またはヘッダー文字列の `/` より前（日本語側）を表示名に使う。内部キー名（`mail_type` 等）をそのまま UI に出さない。 |
| メルマガ一覧フィルター | データ照合は内部キー（`sub_category`、`format`、`mail_type` 等）で行い、ラベルは `担当部署`・`形式`・`種別` 等の日本語を表示する。 |
| 配信編集の設定者・確認者 | 値の正本は **`app_schedule` マスタ行** の `assignee` / `reviewer`（設定者・確認者列）。配信編集モーダルは `APP_DATA.schedule` の該当 `schedule_id` 行から取得し、日付別上書き（`occurrence_override`）がある場合のみ発生分の値を優先する。管理者マスタ（`app_admin_master`）は select の候補リスト用であり、初期表示値の正本ではない。 |

#### `app_check_status` 列順序ルール（2026-05-27 追記）

`app_check_status` シートの列は、以下の順序で自動構成される。右側への不要な空列挿入を防ぐため、システムは末尾の空ヘッダーを無視して追加を行う。

1. **メタデータ列（固定順）**: `項目ID/item_id`, `ID/schedule_id`, `フィールド/field`, `有効/is_active`, `更新日時/updated_at`, `元の日付/original_date`, `配信日/delivery_date`, `上書きフィールド/override_fields`
2. **マスタ同期列**: `app_schedule` のヘッダー順（`曜日`, `時間`, `開始日`, `終了日`, `メルマガ名` ... `確定済`, `配信終了`, `下書き`）に準拠。

#### `app_comments` 列順序ルール（2026-05-27 追記）

`app_comments` シートの列は、以下の固定順で自動構成される。

1. `ID/schedule_id`
2. `投稿日時/timestamp`
3. `投稿者/user`
4. `コメント/comment_text`
5. `対象日/target_date`


#### `app_comments` 列順序ルール（2026-05-27 追記）

`app_comments` シートの列は、以下の固定順で自動構成される。

1. `ID/schedule_id`
2. `更新日時/timestamp`
3. `投稿者/user`
4. `コメント本文/comment_text`
5. `対象日/target_date`



### 4.13 過去データの編集制限（14日ルール）
- **サーバー側ロック**: 当日より14日以上前の日付に属する配信データは、サーバー側（GAS）で更新が拒否される。
- **クライアント側表示**: 14日以上前の枠はグレーアウトされ、編集・移動・ステータス変更が不可となる。

### 4.14 エラーハンドリングと監視
- **処理中オーバーレイ (Busy Overlay)**: `google.script.run` によるサーバー通信中は、`BUSY_COUNT` でカウント管理されたオーバーレイが表示される。通信失敗時には `withFailureHandler` によりエラーメッセージが通知され、操作ロックが解除される。
- **ログ確認**: システム全体の動作ログは Google Apps Script の「実行数」ダッシュボードで確認可能。重大な書き込み競合（LockService タイムアウト等）もここで追跡する。

## 5. 運用・保守・デプロイルール

### 5.1 開発・デプロイフロー (clasp)
- **merumagaルール**:
    - 正しい作業場所は `C:\Users\ayana.yokoo\Desktop\mail-magazine-maker` のみ。
    - `merumaga` フォルダは廃止済み。作業・Git・デプロイに絶対に使用しない。
    - 作業前に必ず `pwd`, `git status --short`, `git remote -v` を確認すること。
    - 仕様変更時は `SPEC.md`, `SPEC_SUMMARY.md`, `START_HERE.md`, `運用台帳.md` を更新すること。
- **バージョン管理**: `clasp push` 実行後、必ず新バージョンを作成し、既存のWebアプリデプロイIDに対してそのバージョンを紐付ける（`clasp deploy --versionNumber <N>`）。
- **反映漏れ防止**: 新しい `.gs` や `.html` ファイルを追加した際は、`.claspignore` の許可リスト（`!` 付きの行）へ必ず追記すること。
- **検証手順**: デプロイ後は必ずシークレットブラウザ等でWebアプリへアクセスし、最新の修正（`運用台帳.md` の `@番号` と一致すること）が反映されているか目視確認する。

### 5.2 システムメンテナンス
- **定期実行トリガー**: 以下の自動処理が設定されている。
    - **求人数更新**: 毎週火曜4時。全「自動求人特集」のURLから最新件数を取得。
    - **ログアーカイブ**: 毎月1日3時。90日経過したログを退避。
- **手動メンテナンス用関数**: 必要に応じて `DataService.gs` 内の `clearScheduleFixedFlags()` 等を実行し、誤って付与された確定フラグの解除などを行う。

### 5.3 仕様確認・変更時の横断チェックルール

UI仕様を変更する場合は、該当箇所の近傍だけで判断してはならない。実装変更前に `SPEC.md` 全体から関連語を検索し、画面構成・入力制御・一覧フィルタ・PR管理など複数セクションの記載を照合する。

- 形式タブや形式選択を変更する場合は、少なくとも `形式`、`タブ`、`マスタ新規`、`マスタ編集`、`配信編集`、`PR管理`、`select` を検索して確認する。
- `<select>` の placeholder / required ルールを変更する場合は、フォーム系入力と一覧フィルタを分けて確認する。一覧フィルタの初期値仕様をフォーム系の必須選択ルールで上書きしてはならない。
- 同じUI要素に関する記載が複数箇所にある場合は、より具体的な画面別仕様を優先する。矛盾がある場合は、実装を変更する前に仕様のどちらを正とするか確認する。
- マスタ新規追加・マスタ編集・配信編集の `形式` は形式タブで選択する。PR管理では形式タブを表示しない。このルールは、select 一般ルールより優先する画面別仕様とする。
- 仕様変更・機能追加・制御条件の追加が発生した場合は、実装と同じコミットで必ず `SPEC.md` に変更点を追記する。ユーザーから明示されていない場合も、今後の挙動確認に必要な仕様差分は自動的に記録する。

### 5.4 指摘対応時の再発防止ルール

案件全体において、仕様ずれ・実装不備・確認漏れ・運用上の問題などの指摘を受けた場合は、修正だけで完了としてはならない。必ず原因を整理し、同種の問題を再発させないための対策を考案して追加する。

- 再発防止策は、`SPEC.md`、`ANTIGRAVITY.md`、運用台帳、チェック手順、テスト、実装上のガードのいずれかに反映する。
- 指摘対応の完了報告では、修正内容に加えて「原因」と「追加した再発防止策」を明示する。
- 再発防止策を追加しない場合は、その理由を明確に記録する。
- 仕様の見落としが原因の場合は、関連語検索・横断確認・優先順位ルールなど、次回の確認手順を具体化する。

### 5.5 色設定・廃止項目の保守ルール

- 配信行の背景色は `Client.html` の `getBgColor()` を正とする。現在の追加指定は、隔週B `#FFF5F7`、種別MA `#FFF8D6`。特殊配信およびサイクル数値系は薄紫 `#E6E6FA`、水色 `#E0FFFF` は `その他` と `検証` に使う。形式が `自動求人特集` であること自体では背景色を付けない。
- 配信行の背景色・左端ライン・ヘッダー凡例は `Client.html` の `SCHEDULE_BACKGROUND_COLORS` / `SCHEDULE_LINE_COLORS` / `SCHEDULE_LEGEND_ITEMS` を正とする。色ルールと凡例は同じ定義から描画し、片方だけを変更してはならない。
- 配信行の左端ラインは `担当部署`（内部キー `sub_category`）による補助分類とする。ただし種別が `MA` の配信行は、MA背景色のみで識別し、左端ラインを付けない。`特殊` を含む場合は紫 `#800080`、`商品` を含む場合は青緑 `#008080`、`その他` または `他部署` を含む場合、および空欄以外で上記に該当しない場合はオレンジ `#FFA500`。ヘッダー凡例の表示名は `担当部署: その他(他部署)` とする。空欄の場合は左端ラインを付けない。
- 左端ラインの分類・色を変更した場合も、必ず同じ変更でヘッダー凡例を更新する。
- 廃止したシート列は、既存シートに列が残っていてもアプリの返却データ・一覧・フォーム・ツールチップへ再表示しない。廃止列を増やす場合は、サーバー返却側とクライアント表示側の両方に除外ガードを追加する。
- `job_count_updated_at` / `求人数最終取得日時` は廃止項目。求人件数アラートは `current_job_count` のみを使い、最終取得日時は表示しない。
- マスタ編集の `mail_type` / `種別`、`sub_category` / `担当部署`（旧 `サブカテゴリ`）、`cycle` / `サイクル` は編集可能項目とし、配信編集専用ロックの対象に含めない。ロック対象を変更する場合は、`EDIT_MODAL_LOCKED_FIELDS` を変更し、項目描画時の `disabled` 指定と動的入力制御が同じ定数を参照していることを確認する。
- マスタ編集・配信編集の select 項目は `Client.html` の `getMasterSelectConfig_()` を経由して描画する。select 項目を増減する場合は、個別分岐を増やす前に同関数へ設定を追加し、初期値・候補・編集可否が既存ルールと矛盾しないか確認する。
- マスタ編集・配信編集のテキスト/日付/日時/長文項目は `Client.html` の `getMasterTextInputConfig_()` と `renderTextInputFromConfig_()` を経由して描画する。入力タイプを増減する場合は、個別HTMLを追加する前に同設定関数へ集約できるか確認する。
- マスタ編集・配信編集の特殊項目（メルマガ名、PR ID、設定者、確認者、新規、求人件数、PR、形式非表示）は `Client.html` の `getMasterSpecialFieldConfig_()` / `renderMasterSpecialFieldInput_()` を経由して描画する。特殊扱いを追加・解除する場合は、select/text の共通描画に入る前の同関数を更新する。
- `applyDynamicInputControl()` のモード別制御は `resetModalFieldStates_()`、`applyAutoJobFieldControls_()`、`applyEditModalLockedFieldControls_()`、`applyCurrentJobCountControls_()`、`applyPrMasterControls_()` に分かれている。モーダル状態の条件を増減する場合は、同じ責務の関数へ寄せてから変更する。
- 形式タブは `Client.html` の `setModalFormatState()` と `setModalFormatTabLockState()` を正とし、`dataset.mode === 'edit'` のモーダルではタブをロック状態にする。編集時はタブの有効/無効と `format` の値が必ず同期しているか確認する。

### 5.6 メンテナンス・高速化ルール

- 同じHTMLファイル内に同名の `function` 定義を複数残さない。後勝ち上書きで動いていても、保守時に古い実装へ修正が入り事故につながるため、不要な旧定義は削除する。
- 一覧描画など行数分ループする処理では、`formatDate(new Date())`、ヘッダー探索、DOM検索などの不変値をループ外で計算する。
- 入力制御シートの行値取得は `getInputControlValueByAliases_()` のような共通ヘルパーを使い、同じ alias 探索ロジックを複数箇所へ複写しない。
- 小さいコード分割は、責務が明確で既存の呼び出し元を減らせる場合に行う。単なる名前付けだけで呼び出し階層を増やす分割は避ける。

## 6. セレクトボックス（プルダウン）におけるプレースホルダー制御ルール

本システム内の入力フォーム系画面（マスタ新規追加、配信編集、PR管理）における `<select>` 要素について、以下の実装ルールを厳格に適用する。ただし、配信編集で設定者が `R` の場合の確認者 select は例外であり、空欄・disabled・required=false を正とする。
一覧画面の検索フィルタはこのルールの対象外とし、運用上の初期表示に必要な値（例: `状態: 配信中`、`サブカテゴリ: すべて`、`形式: すべて`、`種別: すべて`）を初期選択してよい。
1. **「文字通りの空白肢」の禁止とプレースホルダーの設置**
   - オプションの先頭に、値を持たない空行（例: `<option value=""> </option>`）を配置することは一律禁止する。
   - 代わりに、初期状態を示すプレースホルダーとして、値が空の **「-- 選択してください --」**（または項目名に応じた「-- 曜日を選択 --」等）を必ず1行目に設置する。

2. **初期選択と必須バリデーション（required）**
   - このプレースホルダーには、必ず `selected disabled hidden` 属性を付与する。
   - 【効果】画面を開いた瞬間は「-- 選択してください --」と表示されるが、ユーザーが一度プルダウンを開くとその選択肢は消え（非表示）、二度と選べなくなる。
   - 現時点では、フォーム系の `<select>` に一律で `required` を付与しない。項目ごとの必須指定は未確定であり、赤表示や差分表示は注意喚起であって保存ブロック条件ではない。
   - 必須化する場合は、`入力制御` シートまたは仕様書で項目単位に明示してから実装する。R設定時の確認者、検証中配信のサイクルなど、既存の任意入力例外を上書きしてはならない。

## 7. 文字コード・文字化け防止ルール

- Markdown文書はUTF-8で保存する。エディタは `.editorconfig` の `charset = utf-8` を尊重し、Shift_JIS/CP932で保存しない。
- PowerShellの `Get-Content` 表示だけが文字化けしている場合があるため、表示崩れを見つけたら即保存せず、まず `git diff -- SPEC.md` とファイル先頭のバイト列を確認する。UTF-8の日本語は `# メルマガ...` が `23-20-E3-83-A1...` のようなUTF-8バイト列になる。
- コミット前に `Select-String -LiteralPath SPEC.md,SPEC_SUMMARY.md,ANTIGRAVITY.md,運用台帳.md -Pattern '\u7e5d|\u7e3a|\u8b5b|\u9082|\u9a5f|\u870a|\u8373|\u87b3|\u9036|\u8b28|\u9aea|\u86f9'` を実行し、文字化け特有の文字列が混入していないことを確認する。
- 文字化けが保存済みになった場合は、正常だった直近コミットと照合して復元し、追加された正常な追記は保持する。復元後は原因と再発防止策を `運用台帳.md` に記録する。

## 8. 運用ルール (あるべき姿)

本セクションは、運用者からの希望に基づき、ミスを物理的に防ぐための「システムとしての振る舞い」を明文化したものである。

### 8.1 配信パターンの分類と管理
システムは、各配信枠を以下のパターンとして識別し、それぞれに最適な入力制御と描画ルールを適用する。

| カテゴリ | 具体的な種類 | 運用上の意図・システム対応 |
| :--- | :--- | :--- |
| **定例系** | 毎週、隔週A/B、3週サイクル | 配信日のズレを物理的に防ぐため、計算ロジックを絶対とする。 |
| **非定例系** | イレギュラー（突発の差し込み） | 定例枠と重複しないように配置し、カレンダーで一元管理する。 |
| **期限系** | 期間限定配信 | 終了日を過ぎた枠は自動的に非表示とし、情報の陳腐化を防ぐ。 |
| **特別枠** | 月末配信 | 月末付近の特別運用を、期間・サイクル判定で確実に描画する。 |
| **実験系** | 検証中の配信 | 本番と誤認しないよう水色で識別し、実績集計から除外する。 |

検証中の配信は定例サイクルに乗らない確認用枠として扱うため、配信編集モーダルでは `サイクル` を必須入力にしない。種別または担当部署が「検証」の場合、サイクル未選択を保存前バリデーションのエラーにしてはならない。

### 8.2 日次配信確定の締め切り運用
ミスを物理的にゼロにするため、翌日の全配信枠は以下のプロセスを経て「確定（Fixed）」させる。

1. **二重チェック体制**: 「設定者」が入力/設定チェックを行い、「確認者」が内容妥当性を確認して「確認」セルを赤塗りする。
2. **物理的確定**: 「確認」セルが赤塗りされた行は即座に `is_fixed` 状態となり、編集・移動・停止・再開などの操作を一切遮断する。
3. **退社時の物理ガード**: 未確定枠がある場合、保存時または退社時のUIで警告を表示する。

### 8.3 休日前の型の先読み締め切り運用
金曜日の作業時には、週末を挟んで週明けまでの配信ミスがないように、以下の運用を強制する。

- **先読み確定範囲**: 金曜日の作業では、翌週月曜日（祝日を含む場合はその先の最初の平日）までの全配信枠を確定対象とする。
- **金曜日の責務**: 金曜日中に翌週月曜分までの全枠を `is_fixed` 状態にすることを、週末を迎えるための必須終了条件とする。
- **連休前アラート (2週間前警告)**: 3連休以上の長期連休前は、2週間前から画面上部に警告を表示し、調整漏れを防ぐ。特に「他部署依頼枠」については、調整が完了するまで全体保存を物理的にブロックする。
## 2026/05/24 復元追記: 最新運用仕様

この節は、2026/05/24 のファイル破損後に、検証 Apps Script 側から復元した実装内容と直近の会話内容をもとに再作成した最新仕様メモである。既存本文に古い記述や文字化けが残っている場合は、この節を優先して読む。

### 復元状況

- Apps Script にデプロイされる本体12ファイルは、検証環境の最新版から復元済み。
- 検証 Apps Script は既存デプロイID `AKfycbwBER-C0zjRd1piXcqvC-LHNFYP-b9zBitXxAsoaCfeJgWFjf7uxktzjdzpun3PIzdz` を `@34` に更新済み。
- GitHub 本番リポジトリ `cdc-a-yokoo/mail-magazine-maker` は commit `ecef9e9` まで push 済み。
- 検証 GitHub リポジトリ `chvrent/merumaga` も commit `ecef9e9` まで push 済み。
- 本番 Apps Script は `ayana.yokoo` の clasp 認証がなく未デプロイ。`chvrent18` では本番 Apps Script への push 権限がなく `The caller does not have permission`。

### 停止と削除

- メルマガ一覧/PR管理では「停止」と「削除」を別操作として扱う。
- 停止は `stopMasterData()` を使い、`配信停止` / `配信終了` / `is_inactive` 系の列へ true を書く。シート行は残す。
- 削除は `deleteMasterData()` を使い、スプレッドシート上の行を物理削除する。
- 一覧では停止ボタンと削除ボタンを別に表示する。
- 停止済み/終了済み行では二重停止を避けるため停止ボタンは出さない。ただし削除ボタンは表示する。
- マスタ編集モーダルにも既存行用の「停止」「削除」ボタンを表示する。新規追加モーダルでは表示しない。
- PR本文を削除する場合は、同じPR IDに紐づく `app_pr_targets` 行も物理削除する。
- PR紐付け編集で外された `app_pr_targets` 行は削除せず停止扱いにし、再選択時は停止解除して再利用する。

### 読み込みタイミング

- 週データのクライアントキャッシュTTLは5分。
- 画面復帰/ウィンドウフォーカス時の再読み込みは `silent: true` で行い、「データを読み込み中」のオーバーレイを出さない。
- モーダル操作中は画面復帰/フォーカスによる自動再読み込みを行わない。
- 保存・停止・削除・移動など、ユーザーが明示的に書き込み操作をした場合は従来通りオーバーレイを出し、対象週や固定データを強制再取得する。

### 入力制御

- 検証スプレッドシートの `入力制御` シートを、表示/ロック/非表示の正とする。
- 実装では `ClientModals.html` の `applyInputControlMatrix_()` を中心に、マスタ新規追加・マスタ編集・配信編集で同じ `data-field` 単位の制御を使う。
- 自動求人特集では `JOB_勤務地` / `JOB_職種` / `JOB_フリーワード` を非表示にする。
- `自動求人特集_求人数` は表示するがロックする。
- `確定済` は自動求人特集では非表示にする。
- 項目ごとの `required` 必須指定はまだ未確定。赤表示は注意喚起・差分可視化であり、必須入力指定ではない。

### 配信編集差分

- 配信編集モーダルの変更は、日付×メルマガ単位で `app_check_status.occurrence_override` に保存する。
- `occurrence_override` は何度でも再編集・上書きできる。
- 入力値をすべてマスタ元値へ戻した場合は差分なしとして保存し、カレンダー上の赤表示・変更バッジ・差分ハイライトを消す。
- 時間を変更した場合は、カレンダー上でも変更後の時間帯へ移動する。
- 配信編集モーダルはその週の発生分だけを扱うため、変更時にマスタ値を保存対象として見てはいけない。ただし差分判定の元値としてはマスタ行を参照する。

### 新列連携

- `メルマガ内容(抽出)` / `メルマガ内容(フリー)` / `USER_その他条件` / `自動求人特集_その他条件` は、マスタ編集、配信編集、カレンダー差分表示、変更バッジ、保存エイリアス、`app_check_status` 差分保存で同じ内部キーへ揃える。
- `app_schedule` の列を追加・改名した場合は、`DataService.gs` のエイリアス、`ClientModals.html` の正規化、`Client.html` の一覧/差分判定、`ClientUtils.html` の変更バッジをセットで確認する。

### 次のAI向け注意

- この案件に手を入れたら、仕様書・要約・AI引き継ぎ・運用台帳へ変更点を残す。
- Apps Script から復元できるのはデプロイ対象ファイルだけ。`SPEC.md` などのドキュメントはGitまたは手元ファイルからしか戻らない。
- 本番 Apps Script デプロイには `clasp login --user ayana.yokoo` が必要。
