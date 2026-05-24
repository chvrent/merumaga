# Deploy Procedure

作業場所は `C:\Users\ayana.yokoo\Desktop\mail-magazine-maker` だけ。`merumaga` 配下では実行しない。

## 事前確認

```powershell
pwd
git status --short
git remote -v
```

`pwd` が正しい作業場所でない場合は止める。

## GitHub

- 検証: `origin` = `https://github.com/chvrent/merumaga.git`
- 本番: `prod` = `https://github.com/cdc-a-yokoo/mail-magazine-maker`

```powershell
git push origin main
git push prod main
```

## Apps Script

Apps Scriptへのpush/deployは必ず以下のスクリプトを使う。`.clasp.json` の差し替えを手作業でしない。

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
- 本番は事前に `clasp login --user ayana.yokoo` が必要。

## 環境ルール

- スプレッドシートIDはGASのScript Propertiesで環境ごとに管理する。
- `DataService.gs` へスプレッドシートIDを直書きしない。
- デプロイ後は `運用台帳.md` に環境、作業内容、Apps Scriptバージョンを追記する。
