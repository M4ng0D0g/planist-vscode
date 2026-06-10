---
name: planist-agent-git-revert
description: Provides a structured, noiseless Git history analysis and automated rollback skill chain for AI Agents to prevent workspace regression.
---

# Planist Agent Git Revert Skill

You must use this skill when the User requests to roll back, revert, or switch the project to an earlier or alternative version. This toolchain allows you to autonomously audit Git history, analyze code differences, and execute a safe rollback without manual file clearing or interactive lockouts.

## When to use this skill

* **When the User states "回到前幾版" or "退回某功能前的版本"**: Do not ask the user for the commit hash. Actively call the log tool to audit the history yourself.
* **Before performing a rollback**: Use the diff tool to double-check what changed between the target commit and `HEAD`, ensuring you do not delete unrelated stable files.
* **During execution**: Always use the unmanned checkout script (`agent-git-checkout.sh`) instead of a raw `git checkout` to prevent Windows/WSL file system sync lockouts.

---

## Toolchain & Script Specifications

### 1. History Auditor (`agent-git-log.sh`)
* **Purpose**: Fetches a clean, pipe-separated text stream of the Git log optimized for LLM token efficiency.
* **Usage**: `./agent-git-log.sh [limit]` (e.g., `./agent-git-log.sh 10`)
* **Output Format**: `Hash | Date | Author | Commit Message`

### 2. Topology Diff Analyzer (`agent-git-diff.sh`)
* **Purpose**: Provides file change statistics and isolates semantic structural modifications within `.pln` flow files.
* **Usage**: `./agent-git-diff.sh <commitA> [commitB]`

### 3. Unattended Rollback Engine (`agent-git-checkout.sh`)
* **Purpose**: Executes a forced checkout, wipes compilation caches, reinstalls dependencies silently, and triggers a clean esbuild rebuild.
* **Usage**: `./agent-git-checkout.sh <target_commit>`

---

## Standard Operating Procedure (SOP) for Agents

### Step 1: Self-Directed History Audit
When a revert request is received, invoke `.agents/skills/planist-agent-git-revert/scripts/agent-git-log.sh` to extract the recent commit ledger.
Analyze the commit messages to locate the most logical restore point matching the user's intent.

### Step 2: Verification via Semantic Diff
Before checking out, run `.agents/skills/planist-agent-git-revert/scripts/agent-git-diff.sh <target_hash>` to inspect the diff.
Verify that the target version contains the exact feature topology state requested by the user.

### Step 3: Silent Execution & Workspace Rebuild
Invoke `.agents/skills/planist-agent-git-revert/scripts/agent-git-checkout.sh <target_hash>`. The script will automatically:
1. Run a quiet `git stash -u` to safeguard current dirty working states.
2. Force checkout to the target commit.
3. Clean out `dist/` and `out/` build directories.
4. Run `npm install --silent` and `npm run build --silent` to stabilize the extension host.

### Step 4: System Ready Report
Once the script returns success, inform the user that the environment has been synchronized to the chosen commit, and instruct them to press **`F5`** to launch the fresh extension instance.

---

## Behavioral Constraints

* **No Interactive Prompts**: You can NEVER invoke a script that requires manual `[Y/n]` input. All stashes and overwrites must be forced and silent.
* **Isolate Build Cache**: Never skip the cache-clearing phase during checkout. Residual `dist/extension.js` files from different branches will cause immediate runtime syntax errors in the Webview host.
* **Token Protection**: Restrict your log audit limit to a maximum of 15 lines unless explicitly requested, preventing token overflow from large git repositories.