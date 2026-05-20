# Mail Magazine Maker

## 起動時に読む
- `START_HERE.md`（入口・更新ルール）
- `SPEC.md`（仕様の正本）
- `ANTIGRAVITY.md`（運用フロー）

## デプロイ・プッシュ手順

本プロジェクトは Google Apps Script (GAS) を使用しており、ローカルからのデプロイには `clasp` を使用します。

### 1. デプロイ（GASへのアップロード）
ローカルの変更を Google Apps Script に反映させるには、以下のコマンドを実行します。

```bash
clasp push
```

### 2. プッシュ（GitHubへの保存）
GitHub Desktop を使用して変更をコミットし、リモートリポジトリへプッシュしてください。

1. GitHub Desktop を開く。
2. 変更内容を確認し、「Summary」を入力して「Commit to main」を実行。
3. 「Push origin」ボタンを押して、GitHub へアップロードする。
