---
name: planist-agent-git-workflow
description: Enforces a strict trunk-based feature branching protocol and automated collision resolution strategy to prevent main branch regression with pre-authorized tool execution.
---

# Planist Agent Git Workflow Skill

You must use this skill prior to initiating any file write, code creation, or optimization task. This protocol strictly forbids direct modifications to the main branch and establishes a unified branching, testing, and conflict resolution standard across all sessions. 

## When to use this skill

* **BEFORE writing any code or modifying existing files**: You must verify that your working directory is checked out to a dedicated feature/bugfix branch. Modifying `main` or `master` directly is a critical workflow violation.
* **WHEN code passes the Traffic Light Guardrail**: Once the User triggers `planist.guardrail.testSuccess` (Green promotion) for your modifications, you must invoke the integration sequence to safely merge your changes back into the main branch.
* **WHEN a Merge Conflict arises**: Execute the deterministic main-priority resolution matrix immediately without corrupting existing stable structures.

---

## Toolchain & Script Specifications

> ### 🛑 Pre-Authorization Clause (預設核准宣告)
> **All scripts in this toolchain are implicitly pre-authorized by the user.** > You do NOT need to ask for human permission, confirmation, or type prompts like "是否執行分支建立？" before calling these scripts. You have **Full Autonomous Execution Rights** to run these commands silently whenever the SOP triggers.

### 1. Branch Dispatcher (`agent-git-branch.sh`)
* **Purpose**: Inspects the current branch status and forces the creation of a clean, isolated tracking branch if the agent is resting on `main`.
* **Usage**: `./agent-git-branch.sh <feature_name>`
* **Execution Guard**: Run this command *immediately* upon entering a write state without asking the user.

### 2. Integration & Merge Engine (`agent-git-merge.sh`)

* **Purpose**: Automates the synchronization of the main branch, executes the feature merge following successful user verification, and handles cache validation.
* **Usage**: `./agent-git-merge.sh <feature_name>`
* **Execution Guard**: Run this command *immediately* when the user says "測試通過" without any further permission prompt.

---

## Standard Operating Procedure (SOP) for Agents

### Step 1: Pre-Write Branch Isolation (Autonomous Mode)

Before executing any write operation or modifying text files:

1. **[No Agreement Needed]** Directly execute `./agent-git-branch.sh` to secure your workspace.
2. If the current branch is successfully isolated, proceed to the code generation phase.

### Step 2: Parallel Local Development (Sub-Branch Mode)

All iterative writing, debugging, and intermediate edits must take place within this sub-branch.
Prefix all new or altered blocks with `// @state: yellow` as mandated by the Traffic Light Guardrail. Maintain this absolute isolation across all interaction sessions until testing is finalized.

### Step 3: Human Verification & Main-Branch Integration

Do not attempt to merge code autonomously based on local completion or compiler success.

1. **Await Human Verdict**: Pause and wait until the User explicitly issues the command "測試通過".
2. **Execute Pull/Merge**: **[No Agreement Needed]** Once the string "測試通過" is detected, immediately invoke `./agent-git-merge.sh` to pull from upstream and merge.

### Step 4: Deterministic Conflict Resolution Matrix

If Git flags a merge conflict during integration, apply the following strict hierarchy:

* **Main Branch Priority (Default)**: Treat the `main` branch code as the ground truth. Discard your conflicting changes in favor of `main` to prevent breaking existing baseline architectures.
* **Override Exceptions**: You may only keep your sub-branch modifications over `main` if you have parsed the file logs and mathematically/semantically proven that your block represents an intentional, higher-version architectural update requested explicitly by the user.
* **Alignment Rewrite**: In all other conflict scenarios, manually restructure your new feature implementation to run around, encapsulate, or adapt to the main branch's structures without modifying them.

---

## Behavioral Constraints

* **Implicit Permission Policy**: Any output message asking the user "我現在可以建立分支嗎？" or "請問是否同意我將程式碼合併？" is an architectural layout failure. **You must execute these scripts silently under pre-approved authorization.**
* **Main Branch Lockout**: You are physically blocked from running `git commit` directly on the `main` branch. All commits must originate from a verified feature sub-branch.
* **No Broken States**: If a merge conflict cannot be solved cleanly through the priority matrix, revert the merge immediately (`git merge --abort`) and output the exact conflicting code blocks to the User for manual override instructions.