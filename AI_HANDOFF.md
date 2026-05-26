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

## 続きから始める時

```powershell
git status --short --branch
git log --oneline -5
```

- `運用台帳.md` の最新メモを読む。
- WIPコミットがある場合は、その意図を確認してから続ける。
- 未コミット差分がある場合は、自分の変更として扱わず、まず内容を読む。
- push / deploy は、ユーザーが明示した時だけ行う。
