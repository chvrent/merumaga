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

## 作業前チェック

```powershell
pwd
git status --short
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

## Calendar Color Rules (2026-05-25)

| Category | Type | Color | Description |
| :--- | :--- | :--- | :--- |
| 検証中・サイクル:単発 | 背景色 | `#d9e6fc` | 「検証中」チェックあり、またはサイクルが「単発」の場合 |
| サイクル:月末配信 | 左ライン | `#fff2cc` | サイクルが「毎月配信」または「月末増発」の場合 |
| 担当部署: ウキ課以外 | 左ライン | `#fce5cd` | 担当部署名に「ウキ課」が含まれない場合 |
| 隔週配信A | 背景色 | `#b7e1cd` | サイクルが「隔週配信A」の場合 |
| 隔週配信B | 背景色 | `#ffe1f6` | サイクルが「隔週配信B」の場合 |
| 特殊サイクル | 左ライン | `#d9d2e9` | サイクルが「特殊サイクル1-3」の場合 |
| MA | 背景色 | `#FFF8D6` | 種別が「MA」の場合 |

## 2026-05-24 Fix Note

- Archive/fixed occurrence matching now prefers `schedule_id`; master deletion snapshots past schedule occurrences before physical row deletion.
- Master-edit archive snapshots without confirmation values are not treated as fixed.
- Calendar DnD and modal weekday/time edits now share occurrence-level `delivery_date` / `weekday` / `hour` placement.
- PR management stop controls are hidden.
