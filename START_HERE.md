# START HERE

## PR Label Notes

- PR label `remove` must be displayed as `削除`, not `除外`; it is a manual instruction to delete the PR text from the newsletter, not an app-side exclusion process.
- When multiple PRs are linked to one newsletter, show a summary such as `PR N件紐づき` and still show each PR ID/status label individually. Determine each status from that PR's own start/end dates, and hide PRs outside their date range.

このリポジトリを触る前に、必ずこのファイルを読むこと。

## merumagaルール（最優先）

- **作業場所**: 正しい作業場所は `C:\Users\ayana.yokoo\Desktop\mail-magazine-maker` だけ。
- **廃止ディレクトリ**: `merumaga` フォルダは廃止済み。存在していても編集・Git操作・デプロイに絶対に使わない。
- **環境確認**: 作業前に必ず `pwd`, `git status --short`, `git remote -v` を確認すること。
- **仕様変更**: 仕様・運用を変えたら `SPEC.md`, `SPEC_SUMMARY.md`, `START_HERE.md`, `運用台帳.md` を更新すること。

## AI引き継ぎルール（必須）

複数AIで交代しながら作業するため、作業前に必ず `AI_HANDOFF.md` も読むこと。
最初に `scripts/ai-start.ps1` を実行して、自分のAI用ブランチへ自動分岐すること。

- Codex は `codex/<task>` ブランチで作業する。
- Claude は `claude/<task>` ブランチで作業する。
- Gemini は `gemini/<task>` ブランチで作業する。
- Antigravity は `antigravity/<task>` ブランチで作業する。
- `main` は安定版・統合用。ユーザーが明示した場合以外、直接編集しない。
- 他AI名のブランチは、ユーザーが「その続きから」と明示した場合以外は編集しない。
- 途中で止める前に、必要なら `scripts/ai-wip.ps1` で `wip: ...` コミットを作り、`運用台帳.md` に引き継ぎメモを残す。

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/ai-start.ps1 -Agent Codex -Task <short-task-name>
```

## 作業前チェック

```powershell
pwd
git status --short --branch
git branch --show-current
git remote -v
```

`pwd` が `C:\Users\ayana.yokoo\Desktop\mail-magazine-maker` でない場合は作業を止める。

## 他AIへ最初に伝えること

親フォルダを正として統合済み。必ず `C:\Users\ayana.yokoo\Desktop\mail-magazine-maker` だけ触って。作業前に `pwd` と `git status --short` を確認して。`merumaga` 配下では編集・Git操作・デプロイ禁止。

## 正のドキュメント

- 仕様の正本: `SPEC.md`
- 開発・運用ルール: `ANTIGRAVITY.md`
- 要約: `SPEC_SUMMARY.md`
- 作業履歴: `運用台帳.md`

コード、シート構成、デプロイ手順、運用ルールを変えたら、必ず上記の該当ファイルへ追記する。次のAIが迷わないように、理由・影響範囲・確認方法も残す。

## GitHub push

- 検証 GitHub: `origin` = `https://github.com/chvrent/merumaga.git`
- 本番 GitHub: `prod` = `https://github.com/cdc-a-yokoo/mail-magazine-maker`

```powershell
git push origin main
git push prod main
```

## Apps Script deploy

デプロイは手順を一本化し、必ず `scripts/deploy-gas.ps1` を使う。

検証:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy-gas.ps1 -Env staging
```

- clasp user: `chvrent18`
- project file: `.clasp.staging.json`
- deployment id: `AKfycbwBER-C0zjRd1piXcqvC-LHNFYP-b9zBitXxAsoaCfeJgWFjf7uxktzjdzpun3PIzdz`

本番:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy-gas.ps1 -Env prod
```

- clasp user: `ayana.yokoo`
- project file: `.clasp.prod.json`
- deployment id: `AKfycbzfuyTAe_ZUsCutzU5H1UkQZVoq2zOrmn1WoP4j9tiEYBo5BDNzPW6kofDGXkTiDAJ0Qw`
- 本番デプロイ前に `clasp login --user ayana.yokoo` が必要。

## 重要な運用注意

- `DataService.gs` にスプレッドシートIDを直書きしない。環境別のScript Propertiesで管理する。
- `Config.gs.js` や `*.js` は `clasp pull` で生成される一時ファイルの場合がある。Apps Scriptの正ファイルは原則 `.gs` / `.html`。
- 配信停止と削除は別概念。カレンダーや一覧から消したいだけなら停止、シート行を物理削除する場合だけ削除。
- 配信編集モーダルの日付別変更は `app_check_status.occurrence_override` を使う。マスタの週次定義を不用意に上書きしない。

## 2026-05-26 列名 日本語/英語 統一ノート

- スプシ列名は `日本語/英語`（例: `設定者/assignee`）または日本語のみ。サーバーは内部キー（英語）で読み書きし、画面ラベル・メルマガ一覧フィルターは日本語表示。
- 配信編集の設定者・確認者は **メルマガマスタ（`app_schedule`）行** の `assignee` / `reviewer` を正本とする。詳細は `SPEC.md` の「列名の日本語/英語 統一仕様」。

## 2026-05-25 入力制御シート反映ノート

- `入力制御` シートは、1枚の中に `タブ別入力制御`、`サイクル別入力制御`、`PR管理専用 入力項目・配置マトリクス` を縦に並べる構成。`DataService.gs` の `getInputControlRows_()` がブロック名を `__section` として各行へ付ける。
- クライアント側は `__section` で読み分ける。通常モーダルは `タブ別`、サイクル上書きは `サイクル別`、PR管理モーダルは `PR管理専用` を見る。
- 状態セルは `表示` / `ロック` / `非表示` を先頭語で判定する。`非表示(ボタンのみ表示)` などの補足は運用メモとして残せる。
- `getInputControlStateFromSheet_` / `getInputControlCycleStateFromSheet_` は `row['モーダル']` 列（例: `配信編集モーダル`）を直接参照する。`getByAliases(row, ['画面','モーダル',...])` は `画面` 列値を返すため照合が失敗するバグがあり修正済み。
- 配信編集モーダルのロック対象（全形式）: `start_date`、`end_date`、`mail_name`、`mail_type`、`cycle`、`format`、`sub_category`、`is_new`、**`weekday`（新規追加）**、**`is_verifying`（新規追加）**。
- `is_fixed`・`is_inactive`・`is_draft` は全モーダルで常時フォーム非表示。ボタン/外部フローでのみ操作する。

## 2026-05-24 Fix Note

- Archive/fixed occurrence matching now prefers `schedule_id`; master deletion snapshots past schedule occurrences before physical row deletion.
- Master-edit archive snapshots without confirmation values are not treated as fixed.
- Calendar DnD and modal weekday/time edits now share occurrence-level `delivery_date` / `weekday` / `hour` placement.
- PR management stop controls are hidden.
