# Excel "入力制御" (Input Control) Sheet Specification Summary

## Overview
The "入力制御" (Input Control) sheet is the authoritative source for all input field display, lock, and hide states across the mail magazine maker application. Located in the Excel file `mail-magazine-maker staging chvrent18.xlsx`, it centralizes all control rules in a single sheet to ensure consistency and prevent hardcoding control logic in code.

---

## Sheet Structure

### Layout
The sheet contains **three control blocks stacked vertically**, each with:
- A **block title row** (left cell only contains text)
- A **header row** starting with `画面` (Screen) or `モーダル` (Modal)
- **Data rows** containing control specifications

Each row is tagged with `__section` by `getInputControlRows_()` in `DataService.gs`, allowing the same `モーダル` name to appear in multiple blocks without conflicts.

### Three Control Blocks

| Block Name | Purpose | Implementation |
|:---|:---|:---|
| **タブ別入力制御** (Tab-based Input Control) | Controls display/lock/hide states for **format-tab differences** in modals (配信編集モーダル, マスタ新規追加モーダル, マスタ編集モーダル) | `getInputControlStateFromSheet_()` reads rows with `__section` containing `タブ別` |
| **サイクル別入力制御** (Cycle-based Input Control) | Controls **additional locking by cycle value** (e.g., single-send, month-end surge) | `getInputControlCycleStateFromSheet_()` reads rows with `__section` containing `サイクル別` |
| **PR管理専用 入力項目・配置マトリクス** (PR Management Exclusive Control) | Defines **item fields and layout for PR management modal** (different from mail-magazine modals) | `getInputControlStateFromSheet_()` reads rows with `__section` containing `PR管理専用` only when in PR management mode |

---

## Common Reading Rules (All Blocks)

### Header Row Recognition
- Header row **starts with `画面` or `モーダル`**
- Marks the beginning of a block
- Data rows continue until: next empty row **OR** next `画面`/`モーダル` header row

### Key Columns

| Column | Meaning |
|:---|:---|
| `画面` | Human-readable screen/view name (e.g., "配信カレンダー", "メルマガ一覧"). Used for documentation. |
| `モーダル` | **Primary key for code matching** (e.g., "配信編集モーダル", "マスタ新規追加モーダル"). **Code uses `row['モーダル']` (modal column) for matching, NOT `画面` column.** |
| `タブ` | Format type: `フリー` (Free), `抽出` (Extract), `自動求人特集` (Auto Job Feature), `その他` (Other). Empty in PR management block. |
| Item columns | All following columns represent form fields (ID, 曜日, 時間, 開始日, 終了日, etc.) |

### State Values (Prefix-based Matching)

The first word determines the state. Supplementary text after it (separated by parenthesis or comma) is documentation/operational notes and **does NOT affect state detection**.

| State | UI Behavior | Code Implementation |
|:---|:---|:---|
| **`表示`** | Display input field as editable | `hidden=false`, `disabled=false`, `readOnly=false` |
| **`ロック`** | Display input field but make non-editable | `disabled=true`, `readOnly=true` (if applicable) |
| **`非表示`** | Hide input field from screen | `hidden=true`, `display:none`, `disabled=true` |

**Compatible aliases** (treated the same but not preferred):
- `表示`: `show`, `editable`, `enabled`
- `ロック`: `locked`, `readonly`
- `非表示`: `hidden`, `hide`, `none`

**Preferred notation in docs and sheets**: Japanese terms (`表示`, `ロック`, `非表示`)

### Example Supplementary Text
All of these are parsed as `ロック`:
- `ロック`
- `ロック(開始日を入れたら...)` 
- `ロック/月末から1週間前まで`
- `非表示(ボタンのみ表示)`

---

## Block 1: タブ別入力制御 (Tab-based Input Control)

### Purpose
Controls **form-field visibility and editability across format tabs** in:
- 配信編集モーダル (Delivery Edit Modal)
- マスタ新規追加モーダル (Master New Add Modal)
- マスタ編集モーダル (Master Edit Modal)

### Matrix Structure

| Column | Content |
|:---|:---|
| `画面` | Screen/view category (e.g., "配信カレンダー", "メルマガ一覧") |
| `モーダル` | Modal ID for code matching (e.g., "配信編集モーダル") |
| `タブ` | Format tab: `フリー`, `抽出`, `自動求人特集`, `その他` |
| Item columns | One per form field (ID, 曜日, 時間, 開始日, 終了日, メルマガ名, 通数, 種別, サイクル, 形式, 担当部署, メルマガ内容(抽出), メルマガ内容(フリー), 備考, 新規, 検証中, 設定者, 確認者, USER_*, JOB_*, 自動求人特集_*, 確定済, 配信停止, 下書き) |

### Delivery Edit Modal Special Rules

**Delivery Edit Modal mandatory locks** (all formats):
- `start_date` (開始日)
- `end_date` (終了日)
- `mail_name` (メルマガ名)
- `mail_type` (種別)
- `cycle` (サイクル)
- `format` (形式)
- `sub_category` (担当部署)
- `is_new` (新規)
- `weekday` (曜日) — **Added 2026-05-25**
- `is_verifying` (検証中) — **Added 2026-05-25**

These fields **are always locked in delivery edit modal** regardless of sheet specification. Sheet values take priority over code defaults if present.

### Fields Always Hidden (All Modals)
The following are **never displayed as form input fields**:
- `is_fixed` (確定済)
- `is_inactive` (配信停止)
- `is_draft` (下書き)

These are **controlled via buttons/external workflows only**. Sheets may show `非表示(ボタンのみ表示)` as an operational note, but they are never rendered as form inputs.

### Format-Tab Display Differences

| Item | フリー | 抽出 | 自動求人特集 | その他 |
|:---|:---:|:---:|:---:|:---:|
| `mail_content_extract` | 非表示 | 表示 | 表示 | 表示 |
| `mail_content_free` | 表示 | 非表示 | 非表示 | 表示 |
| `auto_job_feature_id`, `job_url`, `current_job_count`, `auto_job_other_condition` | 非表示 | 非表示 | 表示 | 表示 |
| `job_location`, `job_type`, `job_keyword` | 表示 | 表示 | 非表示 | 表示 |

**Note**: `current_job_count` is auto-fetched and always **locked** when visible in Auto Job Feature.

---

## Block 2: サイクル別入力制御 (Cycle-based Input Control)

### Purpose
Controls **additional field locking based on the `cycle` (repetition pattern) value**. These rules **layer on top of** tab-based rules—they override specific fields only when the cycle matches.

### Current Rules

| Cycle Value | Additional Control |
|:---|:---|
| `単発` (Single Send) | Lock `weekday` (曜日). When start_date is entered, auto-fill end_date to the same day. |
| `毎日配信` (Daily Delivery) | Lock `weekday`. |
| `月末増発` (Month-End Surge) | Lock `start_date` and `end_date`. Treat period as "from 1 week before month-end through month-end". |

### Merging with Tab-based Rules
- **Empty cells** = "No change"
- Cycle-based rules **override only the specified fields**
- Tab-based defaults apply to fields not mentioned in cycle rules
- Example: Tab-based says `mail_name` is `表示`, cycle-based says nothing → `mail_name` remains `表示`

---

## Block 3: PR管理専用入力制御 (PR Management Exclusive Control)

### Purpose
**PR management has a different item structure** than mail-magazine modals. This block defines the exclusive items and controls for PR management modals only.

### Item Specifications

| Item (Internal Key) | Display | Lock | Hide | Notes |
|:---|:---:|:---:|:---:|:---|
| `PR ID` (`pr_id`) | 表示 | **ロック** | | Auto-numbered by server at save time. **Always readonly**. |
| `PRタイトル` (`name`) | 表示 | | | User-editable title. |
| `開始日` / `終了日` | 表示 | | | PR display period. |
| `PR本文` (`pr_text`) | 表示 | | | Actual PR text content. |
| `備考` (`notes`) | 表示 | | | Optional notes field. |
| `紐づいたメルマガ` / `PRが入るメルマガを選択` | 表示 | | | Checkbox list, syncs with `app_pr_targets` table. Not free-text input. |
| `配信終了` / `削除` | — | — | — | Handled by list-view and operation buttons, not form input. |

---

## Implementation Application Order

The client-side code (`ClientModals.html`) applies input controls in this strict order:

1. `applyDynamicInputControl(format, modalId)`
2. `resetModalFieldStates_(modal)`
3. `applyInputControlMatrix_(modal, format)` ← **Reads tab-based control sheet**
4. `getInputControlStateFromSheet_(key, modalKey, formatKey)`
5. `applyAutoJobFieldControls_(modal, isAutoJob)`
6. `applyEditModalLockedFieldControls_(modal)`
7. `applyCurrentJobCountControls_(modal, isAutoJob)`
8. `applyValidationCycleControls_(modal)`
9. `applyCycleInputControlMatrix_(modal)` ← **Reads cycle-based control sheet**
10. `applyPrMasterControls_(modal)`

---

## Code Synchronization Points

If the sheet structure changes, ensure these code functions stay in sync:

### DataService.gs
- **`getInputControlRows_()`** — Reads the sheet, attaches `__section` block names to each row

### ClientModals.html
- **`getInputControlSectionRows_()`** — Filters rows by block name (`__section`)
- **`getInputControlStateFromSheet_()`** — Maps field states for tab-based control
- **`getInputControlCycleStateFromSheet_()`** — Maps field states for cycle-based control

### Example: Detecting Section
```javascript
// All rows in getInputControlRows_() output have __section:
// - "タブ別入力制御" for tab-based block rows
// - "サイクル別入力制御" for cycle-based block rows
// - "PR管理専用" for PR management block rows
```

---

## Key Principles

1. **Sheet is the source of truth**: Never hardcode control logic in code. Always read from the input control sheet first.

2. **Modal-column priority**: Code matches against `row['モーダル']` (modal column), not `row['画面']` (screen column).
   - ✅ Correct: `if (row['モーダル'] === '配信編集モーダル')`
   - ❌ Wrong: `if (row['画面'] === '配信編集モーダル')`

3. **Prefix-only matching**: Only the first word (`表示`, `ロック`, `非表示`) matters. Supplementary text is documentation.

4. **Delivery Edit Modal is most restrictive**: Its lock list is mandatory and takes priority over any other control rule.

5. **PR Management is separate**: PR modals ignore tab-based and cycle-based control blocks; they use only the PR-exclusive block.

6. **Common helper usage**: Use `getInputControlValueByAliases_()` and similar shared functions to avoid duplicating column-lookup logic across multiple places in the code.

---

## Related Files

- **Primary Sheet**: `【ウキ】新メルマガスケジュール` → Sheet `入力制御`
- **Reading Functions**: `DataService.gs` / `getInputControlRows_()`
- **Application Functions**: `ClientModals.html` / `applyInputControlMatrix_()`, `applyCycleInputControlMatrix_()`
- **Spec Document**: `SPEC.md` Section 4.1
- **Summary**: `SPEC_SUMMARY.md`

---

## Latest Updates (as of 2026-05-26)

- **2026-05-25**: Added `weekday` and `is_verifying` to delivery edit modal lock list. Made `is_fixed`, `is_inactive`, `is_draft` always hidden (never as form input). Fixed `モーダル` column reference bug.
- **2026-05-25**: Clarified three-block structure with `__section` tagging. Documented cycle-based override semantics.
- **2026-05-26**: Updated maintenance guidance on helper function consolidation.

