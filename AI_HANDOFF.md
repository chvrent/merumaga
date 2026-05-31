# AI Handoff Rules

このリポジトリで複数AIが交代しながら作業するための共通ルール。
作業開始時は `START_HERE.md` とこのファイルを必ず読む。

## 作業開始時に必ず確認

最初に、自分のAI名で自動分岐スクリプトを実行する。

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/ai-start.ps1 -Agent Codex -Task <short-task-name>
```

Claude は `-Agent Claude`、Gemini は `-Agent Gemini`、Antigravity は `-Agent Antigravity` を使う。

```powershell
pwd
git status --short --branch
git branch --show-current
git remote -v
```

- 作業場所は `C:\Users\ayana.yokoo\Desktop\mail-magazine-maker` のみ。
- `merumaga` フォルダは廃止済み。編集・Git操作・デプロイに使わない。
- 未コミット変更がある場合は、内容を確認してから触る。
- 他AIの途中変更に見える差分がある場合は、勝手に上書きしない。

## AI別ブランチ

- Codex は `codex/<task>` ブランチで作業する。
- Claude は `claude/<task>` ブランチで作業する。
- Gemini は `gemini/<task>` ブランチで作業する。
- Antigravity は `antigravity/<task>` ブランチで作業する。
- `main` は安定版・統合用。ユーザーが明示した場合以外、直接編集しない。
- 他AI名のブランチでは、ユーザーが「その続きから」と明示した場合以外は編集しない。

作業開始時に `main` にいる場合は、作業内容に合わせて自分のAI名プレフィックスのブランチを作る。
すでに他AI名のブランチにいる場合は、編集を始める前にユーザーへ確認する。
この処理は `scripts/ai-start.ps1` で自動化する。

## マージ済みブランチの削除は「定期作業」(毎回やらない)

マージ済みの作業ブランチは溜まってきたら**まとめて掃除する**。**マージのたびに毎回消す必要はない**
（ユーザー方針 2026-05-31）。ブランチ数が増えて見通しが悪くなってきた頃、または区切りのタイミングで実施する。

**まとめ掃除の手順**（マージ済みのみ・安全）:
```powershell
git branch --merged main          # 一覧（* = カレント, + = worktree使用中 は対象外）
git branch -d <merged-branch> ... # ローカル削除（マージ済みは -d で安全に消える）
git push origin --delete <merged-branch> ...   # リモートにも存在する分だけ
git remote prune origin           # 消えたリモート追跡参照を整理
```

- **worktree で使用中のブランチ (`+` 印) は削除しない**（先に `git worktree remove` が必要。未追跡ファイルがあると消失するため中身を確認してから）。
- リモートのマージ済み判定は `git rev-list --count origin/main..origin/<branch>` が `0` なら取り込み済み。`0` でないものは**未マージなので消さずユーザーへ確認**。
- ローカル専用（リモート未push）のブランチは push delete 不要（`git ls-remote --heads origin <branch>` で確認）。
- `-d` が「未マージ」で拒否したら、**本当にマージ済みと確認できるまで `-D` で強制削除しない**（取りこぼし防止）。
- **大きい未マージブランチ（`git branch --no-merged main` に出るもの）は原則残し**、要否をユーザーに確認する。

掃除のタイミング・範囲に迷う場合はユーザーに一言確認すれば足りる（毎マージで機械的に消さない）。

## 修正のたびにドキュメント追記 (全AI共通)

修正・機能追加・バグ対応で `main` にマージした **毎回**、以下を必ず実施する。ユーザー要望 (2026-05-29)。
他AI/次セッションが同じ罠を踏まないよう、変更点・原因・再発防止策をその都度ドキュメント化する。

1. **`SPEC.md`** 改訂履歴に1行追加 + 仕様変更箇所の本文追記 (再発防止注記は強調)。
2. **`SPEC_SUMMARY.md`** 該当セクションに要点を1〜3行追記。
3. **`運用台帳.md`** (必須) 冒頭の追記テーブル `# 運用台帳 追記` の **最上部** に新しい行を追加。
   形式: `| YYYY/MM/DD | 作業内容(1文) | 結果・注意 (関数名/ファイル名・staging @NNN) | 対応者 |`
4. **検証 push** — `<agent>/docs-...` ブランチでコミット → main へ `--no-ff` マージ → `git push origin main`。

## 途中で止める前

作業が完成していなくても、交代前には途中状態を保護する。

1. `git status --short --branch` で差分を確認する。
2. 必要なら `scripts/ai-wip.ps1` で `wip: ...` のコミットを作る。
3. `運用台帳.md` に引き継ぎメモを残す。
4. push / deploy していない場合は、そのことを明記する。

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/ai-wip.ps1 -Agent Codex -Message "handoff note"
```

引き継ぎメモには以下を書く。

- 現在のブランチ
- 目的
- 変更した主なファイル
- 未完了の作業
- 確認済みのこと
- 未確認のこと
- push / deploy の状態
- **未マージブランチの一覧**（`git branch --no-merged main` の出力）← 必須
  - コンテキスト再開時に「マージして」と言われると、どのブランチか判断できないため

## 続きから始める時

```powershell
git status --short --branch
git log --oneline -5
```

- `運用台帳.md` の最新メモを読む。
- WIPコミットがある場合は、その意図を確認してから続ける。
- 未コミット差分がある場合は、自分の変更として扱わず、まず内容を読む。
- push / deploy は、ユーザーが明示した時だけ行う。

## ⚠️ 「マージして」指示への対応（コンテキスト再開時の落とし穴）

会話がコンテキスト切れ・サマリーで再開した直後に「マージして」と言われた場合、
**どのブランチをマージするか確認せずに実行してはいけない。**

サマリーには「直近のブランチ」しか記載されないことが多く、
ユーザーが意図した「大きな作業ブランチ」が別に存在する場合がある。

### 必須手順

1. **まず全未マージブランチを列挙する**
   ```powershell
   git branch --no-merged main
   ```

2. **各ブランチのコミット数とサマリーを確認する**
   ```powershell
   git log --oneline main..<branch-name>
   ```

3. **コミット数が多い／大きな変更を含むブランチが複数ある場合は、ユーザーに確認する**
   - 「以下のブランチがmainに未マージです。どれをマージしますか？」
   - ブランチ名・コミット数・最新コミットメッセージをセットで提示する

4. **ユーザーが明示したブランチのみマージする**

### 教訓（2026-05-29）

- `claude/ui-redesign-modal-pr-calendar-20260529-003853`（3コミット・小修正）と
  `claude/fix-loaddata-race-20260527-153608`（15コミット・Linear UI全面リデザイン）が
  同時に未マージだった。
- サマリーに「Claudeブランチをマージ」と書かれていたため、小さい方だけマージしてしまった。
- ユーザーが意図していたのは**大きいUI全面リデザインブランチ**だった。
- 結果、両ブランチのコンフリクト解消に大量の手作業が発生した。
