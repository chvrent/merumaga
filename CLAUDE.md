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