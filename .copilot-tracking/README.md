# Task Planning Workspace

Local workspace for the **task-researcher** and **task-planner** Cursor skills.

## Directories

| Directory | Purpose | Created by |
|-----------|---------|------------|
| `research/` | Verified research notes | task-researcher |
| `plans/` | Plan checklists | task-planner |
| `details/` | Implementation specifications | task-planner |
| `prompts/` | Agent prompts for implementation | task-planner |
| `changes/` | Change log during implementation | implementation agent |

## Workflow

1. **Research** — Invoke `/task-researcher` (or ask the agent to use the task-researcher skill).
   Output: `research/YYYYMMDD-task-description-research.md`
2. **Plan** — Invoke `/task-planner` once research is complete.
   Output: plan, details, and prompt files for the task.
3. **Implement** — Run the prompt from `prompts/implement-*.prompt.md` in Agent mode.
   Output: application code changes tracked in `changes/`.

## Naming conventions

- Research: `YYYYMMDD-task-description-research.md`
- Plan: `YYYYMMDD-task-description-plan.instructions.md`
- Details: `YYYYMMDD-task-description-details.md`
- Prompt: `implement-task-description.prompt.md`
- Changes: `YYYYMMDD-task-description-changes.md`

## Notes

- These files are planning artifacts. Commit them if you want team visibility, or add `.copilot-tracking/` to `.gitignore` for local-only use.
- Neither skill modifies application source code — only files under this directory (researcher writes `research/`; planner writes `plans/`, `details/`, `prompts/`).
