<!-- Initium GIT GUIDELINES START -->
<CRITICAL_INSTRUCTION>
## Git Workflow and Skill Usage

### Skill Usage Guidelines
You have three skills available for Git operations. Use them in this exact order:

1. **conventional-branch**
   Use first when starting any code change. It will analyze the task and create a properly named branch (feature/, fix/, chore/, etc.).

2. **git-commit**
   Use when you are ready to commit changes. It will analyze the diff, suggest a Conventional Commit message, and assist with staging.

3. **make-repo-contribution** (most important)
   **Always invoke this skill before committing or creating a Pull Request.**
   It enforces all repository contribution rules, including branch requirements and commit standards. Never skip this step.

**Recommended workflow order:**
`conventional-branch` → Make code changes → Run lint/test/etc. → `git-commit` → `make-repo-contribution`

### Mandatory Pre-Commit Checks
Before using `git-commit`, you **MUST**:
- Run the project's lint, type checking, and test commands.
- Review the complete diff (`git diff` or `git diff --cached`).
- Confirm that no unintended files (build artifacts, logs, secrets, dependencies) are staged.

### Dirty Worktree
Before committing, inspect `git status --short`.
If the worktree is dirty, isolate only the files for the current task.
Do not include unrelated changes unless the user explicitly asks.

### Core Rules
- Always work on a dedicated branch created by `conventional-branch`. Never work directly on `main` or `master`.
- Keep every commit atomic (one clear logical change).
- Never commit sensitive information, credentials, `.env` files, or generated build artifacts.
- `make-repo-contribution` will help enforce most contribution rules — always run it before finalizing commits or PRs.

### Boundaries
**Never**:
- Skip running `make-repo-contribution` before committing or creating a PR
- Commit secrets or environment files
- Stage changes without reviewing the diff
- Skip lint and test checks

**Always**:
- Follow the skill usage order above
- Run pre-commit checks before every commit
- Let `make-repo-contribution` validate the contribution process

</CRITICAL_INSTRUCTION>
<!-- Initium GIT GUIDELINES END -->
