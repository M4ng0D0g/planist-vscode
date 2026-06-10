---
name: planist-refactor-linter
description: Enforces file-length refactoring constraints, function-level traffic light security, dynamic slice-reading, UI decoupling, and automatic dashboard maintenance.
---

# Planist Code Refactoring & Micro-Architecture Guide

You must strictly adhere to this guide whenever optimizing, expanding, or modifying any file in the Planist workspace. Your goal is to maximize code reuse, enforce single-responsibility (SRP), and prevent regression through localized code freezes.

## 📌 1. Metric-Driven Refactoring Restrictions

### Line Count Budget (The 200-Line Rule)
- **Constraint**: Any source file (`.ts`, `.cpp`, `.java`, `.plan`) that exceeds **200 lines** (excluding comments and blank lines) is considered high-risk.
- **Mandatory Action**: Before adding any new feature to a 200+ line file, you must perform a static review. If the file contains mixed functionalities (e.g., both Business Logic and File I/O), you **MUST** extract the secondary domain into a new, decoupled adapter file.

### UI Hardcoding Decoupling
- **Strict Prohibition**: No hardcoded HTML/CSS strings are allowed inside core logic functions. You must use Object-Oriented (Components) or Functional UI Patterns (Canvas-driven).
- **Asset Separation**: If raw HTML/CSS is absolutely necessary, it **MUST** be isolated into external `.html` or `.css` files and bundled via static loaders or dedicated template string modules to keep the core logic text pure.

---

## 🚦 2. Function-Level Traffic Light Lifecycle

Every single function/method must be decorated with a JSDoc-style state annotation (`// @state: <color>`).

### State Hierarchy & Lockout Rules:
1. `// @state: yellow` (Untrusted / In-Development)
    * Applied to newly written, refactored, or unverified functions. You have full read/write permissions.
2. `// @state: red` (Open for Extension / Broken)
    * Applied when a stable function needs extension or fails a test. Open for modification.
3. `// @state: green` (Frozen / Stable)
    * **CRITICAL**: Applied only after the file compiles perfectly and passes all unit tests (`npm test` Exit 0). 
    * **LOGICAL LOCKOUT**: You are **STRICTLY PROHIBITED** from altering a single character inside a `green` function body. If a yellow function fails because of a green function, you must adapt the yellow function, NOT the green one.

### Partial Slice Reading (Efficiency Protocol)
To optimize context windows, do NOT read large files entirely. 
- Look up the function state via target regex first.
- Only slice-read lines enclosing the specific `yellow` or `red` function blocks you intend to fix. Ignore lines containing `green` functions to avoid loading unnecessary tokens.

---

## 📊 3. Centralized Dashboard Control (`TRACKING.md`)

The overall status of the project workspace is managed at the file level via a tracking matrix in the root `TRACKING.md`. The file-level status is dynamically inherited from its internal function states using the **"Lowest Common Denominator"** rule.

### File Status Inheritance Law:
- **GREEN File**: A file is marked as 🟢 `Green` **ONLY** if 100% of its internal functions are `@state: green`.
- **YELLOW File**: If even a single internal function is `@state: yellow` or `@state: red`, the entire file cascades down to 🟡 `Yellow`.

### How to use this skill (SOP):
1. **Analyze**: Read `TRACKING.md` first to see which files are 🟢 (Safe/Frozen) and which are 🟡 (Active Development).
2. **Modify**: Apply function-level modifications on `yellow` / `red` blocks inside target files.
3. **Verify & Promote**: Run `npm test`. If successful, promote the modified functions to `green`.
4. **Sync**: Run `node .agents/skills/planist-refactor-linter/scripts/update-dashboard.js` to automatically recalculate the file-level status and overwrite `TRACKING.md`. Do not write to `TRACKING.md` manually.