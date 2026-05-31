# Claude Startup Instructions

Before editing this repository, read:

1. `START_HERE.md`
2. `AI_HANDOFF.md`

Follow the AI-specific branch rules in `AI_HANDOFF.md`.
Claude must work on `claude/<task>` branches unless the user explicitly asks otherwise.

First command for Claude work:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/ai-start.ps1 -Agent Claude -Task <short-task-name>
```

## ⚠️ 「マージして」と言われたら必ず確認してから実行

コンテキスト再開後に「マージして」と指示された場合、**即座にマージしない**。

```powershell
git branch --no-merged main   # 未マージブランチを全部確認する
git log --oneline main..<branch>  # 各ブランチの規模・内容を確認する
```

ブランチが複数ある場合はユーザーに「どのブランチをマージしますか？」と確認する。
サマリーに書かれているブランチ名が正しいとは限らない。
詳細は `AI_HANDOFF.md` の「マージして指示への対応」セクションを参照。

## 🧹 用が済んだブランチは削除する

`main` にマージして用がなくなった作業ブランチは削除し、マージ済みブランチを溜めない。
マージ直後に `git branch -d <branch>`（＋ push 済みなら `git push origin --delete <branch>`）。
worktree 使用中 (`+` 印) のブランチや、未マージ (`git branch --no-merged main` に出る) ブランチは消さない。
詳細は `AI_HANDOFF.md` の「ブランチは用が済んだら削除する (クリーンアップ フロー)」を参照。

## 📝 修正のたびに必ずドキュメントを追記する

修正・機能追加・バグ対応 (= main にマージする変更) の **毎回**、以下を必ず実施する。ユーザー要望 (2026-05-29)。

1. **`SPEC.md`**
   - 改訂履歴の表に新しい版を1行追加 (日付・概要・担当者)。
   - 仕様自体が変わった/正本が動いた箇所は本文も追記。再発防止注記は太字や `> **重要**` ブロックで強調。

2. **`SPEC_SUMMARY.md`**
   - 該当セクション (シート連携 / カレンダー / 配信編集 等) に要点を1〜3行追記。

3. **`運用台帳.md`** (必須・最重要)
   - 冒頭の追記テーブル (`# 運用台帳 追記`) の **最上部** に新しい行を追加。
   - 形式: `| YYYY/MM/DD | 作業内容(1文) | 結果・注意 (関数名/ファイル名・staging @NNN) | Claude Sonnet |`

4. **検証 push**
   - `claude/docs-...` ブランチでコミット → main へ `--no-ff` マージ → `git push origin main`。

**理由:** 他AI/自分の次セッションが同じ罠を踏まないよう、変更点・原因・再発防止策をその都度ドキュメント化することが要件。「修正の度、毎回」のドキュメント追記を省略しない。