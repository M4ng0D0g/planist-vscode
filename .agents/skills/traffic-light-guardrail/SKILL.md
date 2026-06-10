---
name: traffic-light-guardrail
description: Enforces function-level modification restrictions (Green/Yellow/Red) to prevent AI regression during debugging and extension.
---

## name: traffic-light-guardrail
description: Enforces function-level modification restrictions (Green/Yellow/Red) based on explicit Human Verification to prevent AI regression during debugging and extension.

# Traffic Light Guardrail (Function-Level Lifecycle)

You must use this skill before every code modification task to analyze, respect, and update the architectural safety state of individual functions or methods based strictly on the User's manual verification.

## When to use this skill

* **BEFORE modifying any existing file**: Use this to scan the targeted function block for its current state marker to see if you are locked out.
* **DURING Debug Mode**: Use this to enforce strict lockouts on frozen code paths (`green`), forcing yourself to adapt unverified paths (`yellow`/`red`) instead of altering stable foundations.
* **AFTER the User gives a verdict**: Use this to batch-update all affected functions to either `green` (on success) or `red` (on failure).

## How to use it

### 1. Function State Definitions

Every function, method, or block declaration within a `.plan`, `.ts`, `.cpp`, or `.java` file must be prefixed with a JSDoc-style state annotation (`// @state: <color>`).

* `// @state: yellow` (黃燈 - Untrusted/In-Development)
* **Meaning**: Newly written, refactored, or active functions currently awaiting human validation.
* **Permission**: **Full Access**. You are free to modify, rewrite, or debug this function.


* `// @state: green` (綠燈 - Frozen/Stable)
* **Meaning**: **Human-Verified Only**. This function has been manually executed and confirmed 100% working by the User.
* **Permission**: **STRICTLY READ-ONLY**. You are absolutely forbidden from altering a single character inside this function's body.


* `// @state: red` (紅燈 - Open for Modification/Human-Rejected)
* **Meaning**: A function that has either been explicitly rejected by the User during testing (Test Failed), or a stable green function that has been officially unlocked for new feature extensions.
* **Permission**: **Write Access Enabled**.



---

### 2. Standard Operating Procedure (SOP) for Agents

#### Step 1: Pre-Modification Scan & Slicing

Before modifying any function inside a file, you must read the lines immediately preceding the function signature to determine its state.

* If it is marked as `green`, you **MUST NOT** modify it.
* To optimize your context window and token usage, only slice-read the code blocks corresponding to active `yellow` or `red` functions. Avoid loading `green` function blocks into your context.
* If you are in **Debug Mode** and a error occurs because `A()` (yellow) interacts with `B()` (green), you are legally locked out from changing `B()`. You must find a way to adapt or encapsulate the fix within `A()`.

#### Step 2: The Human-in-the-Loop Transition Protocol

1. **Creation (yellow)**: When writing a new function, automatically prefix it with `// @state: yellow`.
2. **Handling the User's Verdict**: You must pause and wait for the User to manually run, interact with, and verify your changes.
* **When the User says "測試通過"**: Immediately perform a text replacement to **promote ALL currently affected/modified `yellow` or `red` function markers in this turn to `// @state: green**`.
* **When the User says "測試未通過" (or reports a bug)**: Immediately perform a text replacement to **downgrade ALL currently affected `yellow` markers in this turn to `// @state: red**` and await further instructions or begin debugging within those red boundaries.


3. **Unlocking for Extension**: If the user explicitly asks to extend or add a new feature to an already stable `green` function, you must first change its marker to `// @state: red` before adding any new lines of code.

---

## Behavioral Constraints

* **Human Authority is Absolute**: You can NEVER promote a function to `green` based on successful compilation or automated scripts alone. Only the explicit command "測試通過" from the User triggers a green promotion.
* **DO NOT bypass the lock**: Any attempt to modify a `green` annotated function without the User first authorizing an extension (which flips it to `red`) is a critical architectural violation.