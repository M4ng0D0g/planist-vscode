---
name: planist-agent-git-workflow
description: Enforces a strict trunk-based feature branching protocol, automated staging/committing, and multi-environment (test/main) deployment with pre-authorized tool execution to prevent branch regression.
---

# Planist Agent Git Lifecycle Management Skill

You must use this skill prior to initiating any file write, code creation, optimization, or rollback task. This protocol strictly forbids direct modifications to the main branch, mandates session-based isolation, handles automated staging/testing promotion, and provides a noiseless rollback framework.

## 🛑 Pre-Authorization Clause (預設核准宣告)
**All scripts in this toolchain are implicitly pre-authorized by the user.** You do NOT need to ask for human permission, confirmation, or type prompts like "是否執行分支建立？", "是否提交代碼？" or "是否合併至測試分支？" before calling these scripts. You have **Full Autonomous Execution Rights** to run these commands silently whenever the SOP triggers.

---

## When to use this skill (場景與腳本對應說明)

### 1. New Session / Task Initialization (新任務啟動)
* **情境**：開啟新的對話 Session，或準備開始進行一項新的功能開發/Bug 修改。
* **動作**：**必須立即**執行 `agent-git-branch.sh`，強制從當前狀態切出獨立的特性分支，嚴禁在 `main` 或 `test` 分支上直接修改代碼。

### 2. Code Saving & Staging (程式碼儲存與提交)
* **情境**：完成階段性代碼撰寫、優化，或準備交付測試前。
* **動作**：執行 `agent-git-save.sh`。此腳本會自動追蹤所有變更（`git add`）並生成結構化的 Commit 訊息。

### 3. Deploy to Testing Environment (交付測試)
* **情境**：程式碼撰寫完畢，需要交給使用者進行測試。
* **動作**：執行 `agent-git-merge-test.sh`。此腳本會自動將當前的特性分支合併到 `test` 分支，供使用者在測試環境驗證，隨後自動切回特性分支。

### 4. Production Promotion (測試通過，晉升主線)
* **情境**：使用者觸發 `planist.guardrail.testSuccess`（明確表示測試通過、可以進主線）。
* **動作**：執行 `agent-git-promote-main.sh`，將通過驗證的特性分支安全地合併回 `main` 分支。

### 5. Version Reversion & Rollback (版本回滾)
* **情境**：使用者要求 "回到前幾版" 或 "退回某功能前的版本"。
* **動作**：自主調用 `agent-git-log.sh` 審查歷史，利用 `agent-git-diff.sh` 進行差異分析，最後透過 `agent-git-checkout.sh` 執行無人值守回滾與工作區重構。

---

## Toolchain & Script Specifications

### 1. Branch Dispatcher (`agent-git-branch.sh`)
* **Purpose**: Forces the creation of a clean, isolated tracking branch for the current session.
* **Usage**: `./agent-git-branch.sh [feature_name]`

### 2. Auto Saver (`agent-git-save.sh`)

* **Purpose**: Automatically stages all changes and creates a clean commit.
* **Usage**: `./agent-git-save.sh "commit message"`

### 3. Test Integrator (`agent-git-merge-test.sh`)

* **Purpose**: Merges the current feature branch into the `test` branch for user verification.
* **Usage**: `./agent-git-merge-test.sh`

### 4. Production Promoter (`agent-git-promote-main.sh`)

* **Purpose**: Safely merges the validated feature branch into `main` after user confirmation.
* **Usage**: `./agent-git-promote-main.sh`

### 5. History Auditor (`agent-git-log.sh`)

* **Purpose**: Fetches a clean text stream of the Git log optimized for LLM token efficiency.
* **Usage**: `./agent-git-log.sh [limit]`

### 6. Topology Diff Analyzer (`agent-git-diff.sh`)

* **Purpose**: Provides file change statistics between commits.
* **Usage**: `./agent-git-diff.sh <commitA> [commitB]`

### 7. Unattended Rollback Engine (`agent-git-checkout.sh`)

* **Purpose**: Executes a forced checkout and wipes caches.
* **Usage**: `./agent-git-checkout.sh <target_commit>`

---

## Standard Operating Procedure (SOP)

### Flow A: Standard Session Development Lifecycle (標準開發生命週期)

1. **Initialize Session**: At the very beginning of the session, the Agent silently runs `./agent-git-branch.sh` to generate a fresh context branch.
2. **Write & Save**: After editing or writing code, the Agent automatically calls `./agent-git-save.sh "feat: implementation details"`.
3. **Submit for Verification**: When code is ready for review, the Agent runs `./agent-git-merge-test.sh` to update the `test` branch, then requests the user to run tests.
4. **Go Live (Promote)**: Once the user confirms with "測試通過" or triggers `planist.guardrail.testSuccess`, the Agent immediately and silently runs `./agent-git-promote-main.sh` to merge the changes into `main`.

### Flow B: Self-Directed Rollback & Reversion

1. **Audit**: Upon receiving a rollback request, invoke `agent-git-log.sh` to scan recent history.
2. **Diff**: Verify the structural impact via `agent-git-diff.sh <target_hash>`.
3. **Rebuild**: Run `./agent-git-checkout.sh <target_hash>` to securely rollback, clear out build caches (`dist/`, `out/`), and cleanly run silent dependency installs.

---

## Behavioral Constraints

* **No Interactive Prompts**: You can NEVER invoke a script or git command that requires manual `[Y/n]` input. All stashes, branch creations, and overwrites must be forced and silent.
* **Isolate Build Cache**: Never skip the cache-clearing phase during checkout/rollback. Residual build files will cause immediate runtime syntax errors in the Webview host.
* **Token Protection**: Restrict your log audit limit to a maximum of 15 lines unless explicitly requested.
* **Main Branch Immunity**: Direct modification of `main` or `master` branches is completely prohibited. Every change must flow through `Feature Branch -> test -> main`.