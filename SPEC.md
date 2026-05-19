# メルマガ配信マスタ管理アプリ 仕様書

最終更新: 2026-05-18

## 1. 目的

スプレッドシート `【ウキ】新メルマガスケジュール` の `app_*` シート群をデータソースとして、メルマガ配信予定を週次カレンダーで確認・編集し、PR作業状態、コメント履歴、マスタ管理、確定済みデータの保全をWebアプリ上で扱う。

## 2. 技術構成

- 実行基盤: Google Apps Script Webアプリ
- サーバー側: `Code.js`, `DataService.gs`
- 画面側: `Index.html`, `Client.html`, `Styles.html`
- デプロイ: `clasp push -f` 後、既存WebアプリデプロイIDを最新バージョンへ紐付け（redeploy）
- 主データソース: `app_schedule`, `app_pr`, `app_pr_targets`, `app_comments`, `app_schedule_archives`, `app_exceptions`, `app_check_status`

## 3. 画面構成

画面上部にタブを置く。

- 配信カレンダー
- メルマガ一覧
- PR管理

### 配信カレンダー

- 表示単位は7日間。
- 運用週は火曜始まり、月曜終わりを基本とする。
- カレンダー左端の日付ヘッダーに開始日入力を配置する。
- **当日ハイライト**: 今日の日付列を淡いブルーで強調し、ヘッダーに青い下線を表示する。
- **一括操作ボタン**: 各日付ヘッダーに「全停止」「再開」ボタンを配置。その日の全配信（確定済みを除く）を一括で停止・再開できる。
- **サイクル表示**: 2週サイクル（A/B）と3週サイクル（1/2/3）を組み合わせた名称（例: `A1`, `B2`, `A3`）をチップ形式で表示。`A3` または `B3` の週には「(関西オープン)」の注釈を表示する。
- `今週` ボタンは当日を含む週の火曜日へ移動する。
- 色凡例は `今週` ボタンの左に表示する。
- メルマガ名は省略せず、画面全体の横スクロールで確認できるようにする。
- 時間帯は8:00〜21:00。
- セル内の配信行は `内容 / 通数 / 設定 / 確認` の4カラムで表示する。
- 配信行クリックで編集モーダルを開く。

### マスタ管理タブ

マスタ管理画面では、対象シートのヘッダーから表と編集フォームを自動生成する。

- メルマガ一覧: `app_schedule`
- PR管理: `app_pr`, `app_pr_targets`

編集対象シートはサーバー側でホワイトリスト制限する。

メルマガ一覧の編集は `app_schedule` のマスタ行を更新するため、確定していない同じメルマガ予定すべてに反映される。日付単位で修正したい場合は配信カレンダーの配信編集モーダルを使う。

## 4. データ取得・保存

### 初期取得

`getInitialData()` は以下を取得する。

- `schedule`: `app_schedule`
- `pr`: `app_pr`
- `prTargets`: `app_pr_targets`
- `commentCounts`: `app_comments` の日付別件数集計
- `fixedOccurrences`: `app_schedule_archives` から算出した確定済み発生分
- `adminMaster`: `app_admin_master` または `app_name_master`

### 配信編集

配信編集では、対象日・対象メルマガの発生分だけを保存対象とする。`app_schedule` 本体は更新せず、`app_check_status` の `occurrence_override` として差分を保存する。

- 通数
- 設定者
- 確認者
- 備考
- 曜日、時間、開始、終了
- 種別、サブカテゴリ、PR、形式
- 対象年齢、対象現住所
- 自動求人特集ID
- 自動求人特集URL
- 新規、サイクル

メルマガ名は編集不可とし、クリック時にメルマガ名をクリップボードへコピーする。設定者が `R` の場合、確認者は空欄のまま選択不可とする。

コメントは `app_schedule` には保存せず、`app_comments` に履歴として保存する。

## 5. ID管理

ユーザーはPR以外のIDを入力・編集しない。

### UI

マスタ管理UIではPR以外のID列を非表示にする。保存時は既存IDを保持する。

### 自動採番

新規追加時にIDが空の場合、サーバー側で採番する。

- `app_schedule`: `SCH_001`
- `app_pr`: `PR_001`
- `app_pr_targets`: `PRT_001`

既存の日本語IDを英語連番へ移行するために `migrateLegacyIdsToEnglish()` を用意している。デフォルトはdry-runであり、本実行は `migrateLegacyIdsToEnglish(false)` とする。

## 5.1 配信停止・再開

手動の配信停止は `app_schedule` 本体を変更せず、`app_exceptions` に日付別例外として保存する。

### `app_exceptions` ヘッダー

- `schedule_id`
- `target_date`
- `status`

`status` は停止中の場合 `stopped` とする。

### 挙動

- 停止キーは `schedule_id + target_date`。
- `stopDelivery(scheduleId, targetDate)` は `app_exceptions` に停止行を追加する。
- `resumeDelivery(scheduleId, targetDate)` は一致する停止行を削除する。
- `isStopped(scheduleId, targetDate)` は停止中かどうかを返す。
- 停止中の配信はカレンダー上でグレーアウトし、メルマガ名などを打ち消し線で表示する。
- 停止中の配信編集モーダルでは停止ボタンではなく再開ボタンを表示し、編集フォームをグレーアウトする。
- 確定済み配信は停止・再開できない。
- 確定済み判定はUIだけでなくサーバー側の `stopDelivery()` / `resumeDelivery()` でも行い、直接呼び出しでも停止・再開を拒否する。

### 当日一括停止・再開

カレンダーの日付ヘッダーにある「全停止」「再開」ボタンにより、その日の配信予定を一括操作できる。

- **一括停止**: 指定日の表示されている全配信（確定済みを除く）を `app_exceptions` に `stopped` として一括追加する。
- **一括再開**: 指定日の `app_exceptions` にある `stopped` 行を一括削除する。
- **安全策**: 実行前に確認ダイアログを表示し、確定済みの配信は一括操作の対象外（保護）とする。

## 5.2 サイクル判定と表示

配信スケジュールは、2週間サイクルの A/B判定 と、3週間サイクルの 1/2/3判定 を組み合わせて管理される。

### 表示チップ（サイクルラベル）

カレンダーヘッダーおよび各セルには、以下のルールで生成されたサイクルラベルが表示される。

- **生成規則**: `{A/B週}{3週番号}` (例: `A1`, `B2`, `A3`)
- **関西オープン**: 3週サイクルが `3` の週（`A3` または `B3`）には、自動的に「(関西オープン)」の注釈が付与される。

### 判定ロジック

- **基準日**: `2026-04-28 (火)` を起点とする。
- **週の区切り**: 火曜始まり、月曜終わりの7日間を1週とする。
- **A/B週**: 経過週数を2で割った余りにより判定。
- **1/2/3週**: 経過週数を3で割った余りにより判定。
- **優先順位**: スプレッドシート側の「今週サイクル(内部)」に値がある場合は、それを最優先で表示・判定に利用する。

## 5.2 自動求人件数チェック

`自動求人` の配信事故を防ぐため、`app_schedule` の自動求人特集URLから現在求人数を取得し、カレンダー上に警告を表示する。

### `app_schedule` 利用列

- P列 `job_url`: 自動求人特集URL。ユーザー入力。
- Q列 `current_job_count`: GASが取得した最新求人数。システム自動書き込み。

### GAS処理

- `fetchJobCountFromUrl(url)` は `UrlFetchApp` でHTMLを取得し、旧 `IMPORTXML(job_url, "/html/body/form/div[1]/div[3]/main/div/div/div[2]/div/span[1]")` と同等の階層をGAS側で辿って件数を抽出する。XPath相当箇所で取れない場合だけ、ページ全体の `全 ... 件` から数字を抽出する。ページ全体から任意の `0件` を拾わないよう、XPath相当箇所以外では `全 ... 件` パターンだけを採用する。
- 取得できた場合は数値を返す。
- 取得失敗、HTTPエラー、数字未検出の場合は `null` を返し、既存の `current_job_count` は上書きしない。
- `updateAllJobCounts()` は `app_schedule` を走査し、`job_url` がある行だけ `current_job_count` と `job_count_updated_at` を更新する。
- `setupWeeklyJobCountTrigger()` / `setupHourlyJobCountTrigger()` は互換名として残し、どちらも「毎週火曜4時」に `updateAllJobCounts()` を実行する時間主導型トリガーを作成する。
- 初回のトリガー作成はGASエディタから `setupHourlyJobCountTrigger()`（互換名）を実行する。
- `app_schedule` のマスタ保存時にも `updateAllJobCounts()` を実行する。

### カレンダー警告

`current_job_count` が空欄、null、非数値の場合は未取得としてアラートを表示しない。取得結果が数値の `0` の場合だけ、赤色太字 `[!]` の `job-alert-icon` を表示する。

警告アイコンはメルマガ名の直前に表示し、`title` 属性で `最終取得日時：yyyy/MM/dd HH:mm、件数：●件 / メッセージ` を表示する。

## 5.3 設定・確認チェック状態

カレンダー上の `設定` / `確認` セルはクリックで赤塗りを切り替えられる。クリック時はGAS通信を行わず、ブラウザ内メモリと `localStorage` に一時保存する。

保存は「本日の状態を一括保存」ボタン、またはマスタ/配信内容保存前の自動保存で実行する。保存先は `app_schedule_archives` で、同じ `source_row + target_date` の行がある場合は新規追加せず上書きする。

### `app_schedule_archives` の設定/確認差分列

- `check_setter_active`: 設定セルの最終赤塗り状態
- `check_checker_active`: 確認セルの最終赤塗り状態

`app_check_status` は設定/確認の保存には使わない。現在は `move_override`（ドラッグ移動）と `occurrence_override`（日付別の配信内容編集）専用とする。

### 挙動

- カレンダー描画時は `app_schedule` をベースに、`app_schedule_archives` の日別行を優先して重ねる。
- `設定` / `確認` セルクリック時は `.is-active-red` と未保存件数だけを更新し、通信しない。
- 一括保存時は未保存の最終状態だけを `saveDailyArchiveDiffs()` に渡す。
- `saveDailyArchiveDiffs()` は `source_row + target_date` で既存行を探し、存在する場合は上書き、存在しない場合だけ追加する。
- マスタ保存・配信内容保存の直前に未保存の設定/確認状態があれば自動で一括保存する。失敗時は本体保存を中止する。
- 保存・更新・一括処理など書き込みを伴う操作中は、処理中オーバーレイを表示し、重複操作を避ける。
- `.is-active-red` は `background-color: #ffcccc !important;` とする。

## 6. PRラベル仕様

PRは `app_pr_targets.mail_name` と `app_pr.pr_id` を突き合わせて、配信行に紐付ける。配信行に直接PR情報がある場合も補助的に対応する。

PR期間は `start_date / end_date` または `開始日 / 終了日` から自動計算する。`copy_add_date` / `copy_remove_date` は参照しない。

### 表示条件

1つのPRにつき、以下の優先順位で1つだけ表示する。

1. 追加: `targetDate` が `start_date` から7日間以内
2. 削除: `targetDate` が `end_date` の7日前〜当日
3. 掲出中: 上記以外で `targetDate` が `start_date`〜`end_date` の間

### 表示文言

- 追加: `└PR[ID]追加`
- 削除: `└PR[ID]削除`
- 掲出中: `└PR[ID]掲出中`

### 表示スタイル

- 追加: 黄色背景、赤枠、太字
- 削除: グレー背景、打ち消し線
- 掲出中: 控えめな通常表示

同一セル内では同じPR IDを1回だけ表示する。複数PRがある場合は1件1行で縦に並べる。

## 7. コメント仕様

コメントは `app_comments` に履歴として保存する。紐付けキーは `schedule_id` だけではなく、表示中の配信日 `target_date` も含める。

### `app_comments` ヘッダー

- `schedule_id`
- `timestamp`
- `user`
- `comment_text`
- `target_date`

### 機能

- 配信編集モーダル内にコメントスレッドを表示する。
- 新規コメント投稿後、スレッドを再読込し、最新コメントまで自動スクロールする。
- カレンダー行には、その配信日のコメント件数バッジを表示する。
- 確定済み配信でもコメントの読み書きは可能。

コメントは `schedule_id + target_date` に紐付く。同じメルマガ枠を翌週以降に使い回しても、別日のコメントは累計表示しない。

## 8. 確定・バックアップ仕様

### 運用週

週次バックアップは廃止済み。過去日・確定日・設定/確認差分の保護は `app_schedule_archives` の日別行で行う。

`backupAndLockTwoWeeksAgo()` は互換用の no-op とし、`setupWeeklyBackupTrigger()` は既存の週次トリガー削除だけを行う。

`app_schedule` の行は繰り返しマスタなので、行全体をロックしてはいけない。確定判定は `app_schedule_archives` の `source_row` と `fixed_week_start / fixed_week_end` から、表示中の日付単位で判定する。

### `app_schedule_archives` 追加列

- `archived_at`
- `fixed_week_start`
- `fixed_week_end`
- `source_row`
- 以降に `app_schedule` の全列スナップショット
- `check_setter_active`
- `check_checker_active`

### ロック挙動

- 確定済みの発生分だけカレンダー上でグレーアウトする。
- 確定済みバッジを表示する。
- 配信編集モーダルでは保存ボタンを非表示にする。
- 配信編集欄は読み取り専用にする。
- コメント欄だけは操作可能にする。
- サーバー側でも `source_row + target_date` で確定済み発生分の更新を拒否する。

### 表示優先順位

カレンダー上の状態表示は以下の優先順位で決まる。

1. 確定済み: `app_schedule_archives` に該当発生分がある場合。グレーアウトし、編集不可。
2. 手動停止: `app_exceptions` に `schedule_id + target_date` の `stopped` がある場合。グレーアウトし、打ち消し線。
3. 通常: 上記以外。

### 復旧補助

過去実装で `app_schedule.is_fixed` にTRUEが入った場合でも、現行仕様ではロック判定に使わない。不要なフラグを消す場合は `clearScheduleFixedFlags()` を実行する。

## 9. 色分け仕様

配信行の背景色は `category / cycle / format` をもとに判定する。行全体の文字列検索では判定しない。

- 毎月: 薄ピンク
- 特殊/特段: 薄紫
- 隔週A: 薄緑
- 隔週B: ピンク
- 自動求人: 水色
- その他: 白

## 10. 日本語表示名

マスタ管理画面では、英語キーをユーザーに直接見せない。`DISPLAY_NAMES` により、テーブルヘッダーと編集フォームラベルを日本語表示へ変換する。

保存時は元のキーを維持し、シート更新に必要な列名は変更しない。

## 11. デプロイ・検証

変更時は以下を行う。

1. `DataService.gs` の構文チェック
2. `Client.html` 内JavaScriptの構文チェック
3. `git diff --check`
4. `clasp push -f`
5. 既存デプロイIDを `clasp deploy -i ...` で更新
6. `運用台帳.md` に作業内容とデプロイ番号を記録

## 12. 注意事項

- `app_schedule` は繰り返しマスタであり、特定日の実績行ではない。
- 過去週の確定は `app_schedule_archives` で管理する。
- コメントは配信マスタ本体ではなく `app_comments` に保存する。
- PRラベルは `copy_add_date` / `copy_remove_date` を使わず、開始日・終了日から自動計算する。
- IDはユーザー入力させず、サーバー側で自動採番する。

## 13. コードから逆算した実挙動

この章は `DataService.gs` と `Client.html` の実装から逆算した、現在のアプリの実動作を記録する。

### 13.1 起動時の流れ

1. `Code.js` の `doGet()` が `Index.html` を返す。
2. `Index.html` は `Styles.html` と `Client.html` を読み込む。
3. `Client.html` の末尾で `wireEvents()` と `loadData()` が実行される。
4. `loadData()` は `google.script.run.getInitialData()` を呼ぶ。
5. `getInitialData()` は配信、PR、コメント件数、確定済み発生分などをまとめて返す。
6. 成功後、`renderScheduleGrid()` がカレンダーを描画する。

### 13.2 `getInitialData()` が返すデータ

`DataService.gs` の `getInitialData()` は以下を返す。

- `schedule`: `getScheduleRows_()` によって正規化された `app_schedule`
- `pr`: `app_pr`
- `prTargets`: `app_pr_targets`
- `holidays`: `app_holidays`
- `commentCounts`: `app_comments` を `schedule_id|target_date` ごとに集計した件数
- `fixedOccurrences`: `app_schedule_archives` から作る `source_row|yyyy-MM-dd` 形式の確定済みマップ
- `stoppedOccurrences`: `app_exceptions` から作る `schedule_id|yyyy-MM-dd` 形式の停止中マップ
- `readme`: `app_readme`
- `adminMaster`: `app_admin_master` または `app_name_master`

`schedule` の各行には、少なくとも以下の正規化済みプロパティが入る。

- `schedule_id`
- `source_sheet`
- `source_row`
- `category`
- `sub_category`
- `sub_category_class`
- `cycle`
- `weekday`
- `hour`
- `mail_name`
- `format`
- `delivery_count`
- `assignee`
- `reviewer`
- `start_date`
- `end_date`
- `pr`
- `notes`
- `job_url`
- `current_job_count`
- `job_count_updated_at`
- `current_week_cycle`
- `current_week_inactive`
- `is_inactive`
- `is_fixed`

ただし、現行仕様では `is_fixed` は確定判定には使わない。確定判定は `fixedOccurrences` で行う。

### 13.3 カレンダー描画の実挙動

`renderScheduleGrid()` は以下の順で描画する。

1. `startInput` の値を開始日とする。空なら今日を入れる。
2. 開始日から7日分の日付配列を作る。
3. 8:00〜21:00 の各時間行を作る。
4. 各日付・時間のセルごとに `schedule` を絞り込む。
5. セル内に該当する配信を `delivery-row` として描画する。

配信がセルに出る条件は以下。

- `is_inactive` が真ではない。
- 曜日が対象日付の曜日と一致する。
- 時間が対象時間と一致する。
- `start_date` / `end_date` の範囲内である、またはその日に表示対象のPRラベルがある。
- `cycle` が対象日の隔週A/Bまたは3週サイクル条件に合う。
- `category` が毎月の場合は、対象日付が月末配信期間内である。

サイクルは `今週サイクル(内部)` がある場合はその値を最優先で使う。これにより、スプレッドシート側で今週有効と判定された `cycle1` などがWeb表示でもそのまま対象になる。内部値がない場合だけ、`CYCLE_BASE_DATE = 2026-04-27` を起点に経過週数 `diffWeeks` から計算する。ポジションマッチは `種別` だけでなく、メルマガ名や備考に `ポジションマッチ` を含む行も対象とする。比較は `String(row.cycle).indexOf(String(targetCycle)) !== -1` 相当で行い、`3`、`"3"`、`"A3"` を同じ3週目として扱う。

### 13.4 開始日UIの実挙動

上部ツールバーに見える開始日入力は置かない。代わりに、カレンダー左端の日付ヘッダーに `input type="date"` を表示する。

- ヘッダー内の日付を変更すると `setCalendarStartDate(value)` が呼ばれる。
- `setCalendarStartDate()` は隠し `startInput` に値をセットし、`renderScheduleGrid()` を再実行する。
- `今週` ボタンは `jumpToCurrentWeek()` を呼び、当日を含む火曜始まり週へ移動する。

### 13.5 PRラベルの実挙動

PRラベルは `getPrStates(row, targetDateString)` で決まる。

処理の流れ:

1. `getPrRecordsForSchedule(row)` が配信行に紐付くPR候補を集める。
2. 優先して `app_pr_targets` の `mail_name` と配信の `mail_name` を完全一致で突き合わせる。
3. 対応する `pr_id` から `app_pr` を引き、開始日・終了日を取得する。
4. `app_pr_targets` で取れない場合は、`app_pr` の各列を走査してメルマガ名一致を探す。
5. `getPrState()` が対象日の状態を `追加` / `削除` / `掲出中` のいずれかに決める。
6. `collapsePrStates_()` が同じPR IDの重複を1件へ集約する。

`getPrState()` は `if / else if` の排他判定で、1つのPRに対して1状態だけ返す。

- `start_date` から7日間: `add`
- `end_date` の7日前から当日: `remove`
- それ以外で掲出期間中: `active`

同一セル内では `renderedPrIds` により、同じPR IDを二重表示しない。

### 13.6 色分けの実挙動

配信行の背景色は既存凡例の配信サイクルをもとに決める。

- 毎週: `#FFFFFF`
- 特殊: `#E6E6FA`
- 毎月: `#FFF0F5`
- 隔週A: `#E0FFE0`
- 隔週B: `#FFD1DC`
- その他: `#E0FFFF`

`sub_category` は背景色ではなく左枠線で強調する。

- `商品`: `.is-product` / `border-left: 6px solid #008080`
- `特殊`: `.is-special` / `border-left: 6px solid #800080`
- `その他` / `他部署` / 上記以外の文字あり: `.is-others` / `border-left: 6px solid #FFA500`
- 空欄: 追加枠線なし

カレンダー描画では `style="background-color: ${getBgColor(row)}"` と `slot-item ${sub_category_class}` を併用する。

- `毎月` を含む: `#FFF0F5`
- `特段` または `特殊` を含む: `#E6E6FA`
- `隔週A` または `cycle === 'A'`: `#E0FFE0`
- `隔週B` または `cycle === 'B'`: `#FFD1DC`
- `自動求人` を含む: `#E0FFFF`
- その他: `#FFFFFF`

`source_sheet` や行全体の文字列は色判定に使わない。

### 13.7 確定済み判定の実挙動

確定済み判定は `isFixed(row, targetDate)` で行う。

`isFixed()` は `APP_DATA.fixedOccurrences` の中に以下のキーがあるかを見る。

```text
source_row|yyyy-MM-dd
```

したがって、同じ `app_schedule` 行でも、アーカイブ済みの日付だけが確定済みになる。未来日の同じ配信はロックされない。

確定済みの場合:

- カレンダー行に `is-fixed` クラスが付く。
- `確定済` バッジが出る。
- 配信編集モーダルの保存ボタンが非表示になる。
- 配信編集欄は読み取り専用になる。
- コメント欄は操作可能なまま残る。

保存時も `upsertScheduleData(data)` が `source_row + target_date` を使って `isArchivedOccurrenceFixed_()` を呼び、確定済み発生分なら更新を拒否する。`source_row` が渡されない場合も、`schedule_id` から `app_schedule` の行番号を引き直して確定済み判定を行う。

### 13.7.1 手動停止判定の実挙動

手動停止判定は `isStopped(row, targetDate)` で行う。

`isStopped()` は `APP_DATA.stoppedOccurrences` の中に以下のキーがあるかを見る。

```text
schedule_id|yyyy-MM-dd
```

停止中の場合:

- カレンダー行に `is-stopped` クラスが付く。
- `配信停止中` バッジが出る。
- メルマガ名、通数、設定者、確認者を打ち消し線で表示する。
- 配信編集モーダルでは保存ボタンを非表示にする。
- 停止ボタンではなく `配信を再開する（元に戻す）` ボタンを表示する。
- コメント欄は操作可能なまま残る。

`upsertScheduleData(data)` は `schedule_id + target_date` を使って `isStopped()` を呼び、停止中発生分なら更新を拒否する。`stopDelivery()` と `resumeDelivery()` は `schedule_id` から `source_row` を解決し、確定済み発生分なら停止・再開操作を拒否する。

### 13.8 バックアップ処理の実挙動

週次バックアップ処理は廃止済み。`backupAndLockTwoWeeksAgo()` は互換用の no-op で、`setupWeeklyBackupTrigger()` は既存の同名トリガー削除だけを行う。

アーカイブの重複防止は `source_row|fixed_week_start` で行う。日別差分では `fixed_week_start` と `fixed_week_end` に同じ日付を入れる。

`clearScheduleFixedFlags()` は過去実装で `app_schedule.is_fixed` に入ってしまった値を消すための復旧関数である。現行ロック判定には `is_fixed` を使わない。

### 13.9 配信編集モーダルの実挙動

`openModal(encodedEntry)` は以下を行う。

1. 配信行データを `CURRENT_ENTRY_BASE` / `CURRENT_ENTRY` に保持する。
2. 設定者・確認者の選択肢を `adminMaster` から作る。
3. メルマガ名、通数、設定者、確認者、備考をフォームへセットする。
4. `app_schedule` のヘッダーに合わせて、マスタ新規追加と同等の追加項目を `editExtraFields` に生成する。
5. メルマガ名は常に読み取り専用にし、クリックでコピーできるようにする。
6. 設定者が `R` の場合、確認者は空欄にし、選択不可にする。
7. コメント欄を初期化する。
8. `loadCommentsForCurrentEntry()` でコメント履歴を読み込む。
9. 確定済みまたは配信停止中なら編集欄をロックする。

`saveEdit()` は `saveCheckStatus(itemId, 'occurrence_override', active, payload)` を呼ぶ。`itemId` は `schedule_id + target_date` であり、同じメルマガの別日付には変更を波及させない。変更された項目名は `override_fields` に保存し、カレンダー再描画時に該当発生分だけ上書き表示する。

### 13.10 コメント機能の実挙動

コメントは `app_comments` に追記される。

`postComment()` は以下を行う。

1. `CURRENT_ENTRY.schedule_id` と `CURRENT_ENTRY.target_date` を使う。
2. `new-comment` の内容を取得する。
3. `saveComment(schedule_id, commentText, target_date)` を呼ぶ。
4. 成功したらコメント入力欄を空にする。
5. `APP_DATA.commentCounts` の `schedule_id|target_date` をローカルで加算する。
6. カレンダーを再描画する。
7. コメントスレッドを再読込する。

`renderComments()` はコメントを時系列順に表示し、表示後に最下部へスクロールする。

`getCommentsByScheduleId(scheduleId, targetDate)` は指定日のコメントだけを返す。`target_date` が入っていない過去コメントは、日付別スレッドには表示しない。

### 13.11 マスタ管理画面の実挙動

タブ切り替えは `switchTab(tabName)` で行う。

- `calendar`: カレンダー画面を表示
- `schedule`: `app_schedule` を管理
- `pr`: `app_pr` と `app_pr_targets` を切り替えて管理

`loadActiveMaster()` は `getMasterData(sheetName)` を呼ぶ。返却されたヘッダーと行から `renderMasterTable()` が表を作る。

`openMasterModal()` はヘッダーからフォームを自動生成する。長い値や改行を含む値は `textarea` にする。

ID列は `MASTER_ID_HEADERS` により非表示にする。非表示でも、既存行更新時はサーバー側で元行の値を保持する。ただし、PR管理の `pr_id` はユーザーが確認するため表示する。

`saveMasterData()` は新規追加時にID列が空なら `generateNextMasterId_()` で採番する。

### 13.12 削除の実挙動

マスタ管理画面の削除ボタンは `deleteMasterRow(rowNumber)` を呼ぶ。

`deleteMasterData(sheetName, rowNumber)` はホワイトリスト対象シートのみ削除を許可する。現行仕様では `app_schedule` の行全体ロックは行わないため、削除可否はシート単位の許可に依存する。

ただし、`app_schedule` は繰り返しマスタであり、削除すると未来の予定も消えるため、運用上は削除より `配信停止` を優先する。

### 13.13 サーバー側の安全策

`assertEditableSheet_()` により、任意のシート名を指定して編集することはできない。

編集可能シートは以下のみ。

- `app_schedule`
- `app_pr`
- `app_pr_targets`

`upsertScheduleData()` は確定済み発生分の更新を拒否する。`saveMasterData()` はID自動採番と既存ID保持を行う。

### 13.14 現在の既知の運用注意

- `setupWeeklyBackupTrigger()` はGASエディタで初回実行する必要がある。
- `clasp run setupWeeklyBackupTrigger` は Apps Script API 実行設定により失敗することがある。
- `setupHourlyJobCountTrigger()` もGASエディタで初回実行する必要がある。
- `app_schedule.is_fixed` が過去に立っていても現行UIでは使わない。
- 既に立った `is_fixed` を整理する場合は `clearScheduleFixedFlags()` を実行する。
- `app_schedule` の1行は繰り返しマスタなので、週単位の確定情報は必ず `app_schedule_archives` に持つ。

## 14. 現行まとめ

現在のアプリは、`app_schedule` を配信カレンダーの母体として、`app_schedule_archives` で過去日・確定日・設定/確認の一括保存差分を日付単位で保持し、`app_comments` で日付別コメント履歴を持ち、`app_exceptions` で日付別の配信停止を管理する構成になっている。

画面側では、PRラベルの状態分岐、コメント件数、確定済み表示、手動停止表示、自動求人件数アラートを同一のカレンダー上で併記する。マスタ管理は英語キーを日本語表示に変換し、IDはサーバー側で自動採番する。

求人件数は `job_url` から `current_job_count` と `job_count_updated_at` を更新する。保存時の即時更新も残してあるため、編集直後の表示と定期更新の両方で値が揃う。設定・確認の赤塗り状態はクリック時にブラウザへ一時保存され、一括保存時に `app_schedule_archives` へ差分として保存される。`app_check_status` は移動と日付別編集のオーバーライド専用である。
