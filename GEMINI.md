# Other AI Rules

このプロジェクトで作業するAIは、最初に以下を確認すること。

```powershell
pwd
git status --short
git remote -v
```

- 正しい作業場所は `C:\Users\ayana.yokoo\Desktop\mail-magazine-maker` のみ。
- `merumaga` 配下では編集・Git操作・デプロイをしない。
- 作業場所が違う、またはGitが壊れている場合は作業を止めてユーザーへ報告する。
- 仕様変更・運用変更・デプロイ手順変更をしたら、`SPEC.md`、`SPEC_SUMMARY.md`、`START_HERE.md`、`運用台帳.md` の必要箇所へ追記する。
- Apps Scriptデプロイは `scripts/deploy-gas.ps1` だけを使う。
