# Agent Startup Instructions

Before editing this repository, read:

1. `START_HERE.md`
2. `AI_HANDOFF.md`

Follow the AI-specific branch rules in `AI_HANDOFF.md`.
Codex must work on `codex/<task>` branches unless the user explicitly asks otherwise.

First command for Codex work:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/ai-start.ps1 -Agent Codex -Task <short-task-name>
```

