# Other AI Rules

このプロジェクトで作業するAIは、以下の「merumagaルール」を厳守すること。

## 1. 作業場所の制限
- 正しい作業場所は `C:\Users\ayana.yokoo\Desktop\mail-magazine-maker` のみ。
- **`merumaga` フォルダ（廃止済み）は絶対に使わない。** 配下での編集・Git操作・デプロイは禁止。
- 作業場所が違う、またはGitが壊れている場合は作業を止めてユーザーへ報告する。

## 2. 作業前チェック
作業を開始する前に、必ず `START_HERE.md` を読み、以下のコマンドで環境を確認すること。
```powershell
pwd
git status --short
git remote -v
```

## 3. ドキュメントの更新
仕様変更・運用変更・デプロイ手順変更を行ったら、必ず以下のファイルへ追記・更新すること。
- `SPEC.md`
- `SPEC_SUMMARY.md`
- `START_HERE.md`
- `運用台帳.md`

## 4. デプロイ
- Apps Scriptデプロイは `scripts/deploy-gas.ps1` だけを使う。

## 5. デプロイ前の強制確認事項（merumagaルール追加）
「検証デプロイ」または「本番デプロイ」の指示を受けた際、AIは実行前に必ず以下を確認し、ユーザーに不一致がないか報告する：
1. **CI/CD設定の確認**: `.github/workflows/gas-deploy.yml` の `CLASP_PROJECT_FILE` と `CLASP_DEPLOYMENT_ID` が、意図した環境（検証/本番）と一致しているか。
2. **ローカル設定の確認**: 使用する `.clasp.json` (または `staging.json`) の `scriptId` が正しいか。
3. **プッシュ先の確認**: `git push origin` が Actions 経由でどこにデプロイされるかを把握した上で実行する。
---
