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