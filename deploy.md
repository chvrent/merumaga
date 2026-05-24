# Deployment Scripts

## Deployment Workflow Rules
- **Environment Management**: 
  - **Spreadsheet ID**: No longer hardcoded. Set the `SOURCE_SPREADSHEET_ID` property in the GAS project dashboard (Project Settings > Script Properties) for each environment.
  - **Configuration**: Use `.clasp.staging.json` for Staging and standard `.clasp.json` for Production.
- **Automation**: Always use the scripts documented in `deploy.md`. Never modify `DataService.gs` to change spreadsheet IDs.
- **Safety**: Always run `clasp status` before `push`. Never attempt to manually resolve Git merge conflicts in `Code.js` or `DataService.gs`; if conflicts occur, synchronize from a master source of truth.

## Staging (Verification) Deployment
Use this script to safely deploy to the Staging environment from the Desktop directory.
```powershell
# Save current state
cp .clasp.json .clasp.temp.json
# Apply Staging config
cp .clasp.staging.json .clasp.json
# Push and Deploy
clasp push -f
clasp deploy --deploymentId AKfycbwBER-C0zjRd1piXcqvC-LHNFYP-b9zBitXxAsoaCfeJgWFjf7uxktzjdzpun3PIzdz --description "Deploy via Safety Script"
# Restore original config
mv .clasp.temp.json .clasp.json
```

## Production Deployment
Use this script to safely deploy to the Production environment from the GitHub directory.
```powershell
# Production uses the default .clasp.json
clasp push -f
clasp deploy --deploymentId AKfycbzfuyTAe_ZUsCutzU5H1UkQZVoq2zOrmn1WoP4j9tiEYBo5BDNzPW6kofDGXkTiDAJ0Qw --description "Deploy via Safety Script"
```

---

## Troubleshooting Deployment & Push
If you encounter "Repository not found" (especially for private repositories) or permission errors:

1. **Verify Credentials**: Ensure Git is using the correct account.
   ```powershell
   git config user.email "ayana.yokoo@type.jp" # For Production
   git config user.name "ayana-yokoo"
   ```
2. **Refresh Authentication**: If push fails, force re-authentication with GitHub:
   ```powershell
   git credential-manager github logout github.com
   git credential-manager github login
   ```
3. **Check Remote URL**: Ensure `origin` (Production) points to `cdc-a-yokoo` and `merumaga` (Staging) points to `chvrent`.

### Emergency Recovery: Orphan/Clean Sync
If a push is blocked by GitHub Secret Scanning due to sensitive files in history, use the "Orphan Sync" strategy:

```powershell
# 1. Ensure sensitive files (e.g., Config.gs.js) are deleted or ignored
rm Config.gs.js
# 2. Create a clean history branch
git checkout --orphan temp-sync
# 3. Add all files (ignoring those in .gitignore)
git add .
# 4. Commit and force push
git commit -m "initial sync: clean state"
git push -u merumaga temp-sync --force
```
