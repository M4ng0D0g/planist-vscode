# Planist VS Code 擴充功能開發規範與紅綠燈機制 (Traffic Light Mechanism)

為了確保 Planist 專案的穩定性、可維護性並落實自動化測試，本專案引進了**紅綠燈機制 (Traffic Light Mechanism)** 與**組件驅動設計 (Component-driven Design)**。所有開發人員與代理工具 (Agents) 必須嚴格遵守以下準則：

---

## 🚦 紅綠燈狀態聲明規範 (Traffic Light Protocol)

所有 HTML/CSS 元件與模組檔案的**最頂端**，必須包含以下格式的狀態註解：
```typescript
// @status <COLOR>
```
其中 `<COLOR>` 可為以下三種狀態之一：

### 🟢 綠燈 (GREEN) - 穩定模組 (Stable & Verified)
* **定義**：模組已完成開發，並通過了完整的單元測試與功能驗證，能正常執行。
* **修改限制**：
  * ❌ **嚴禁直接修改**綠燈模組的任何代碼（包括 Bug 修正、優化等）。
  * ❌ **在除錯/開發模式下，絕對不允許對綠燈模組進行任何修改。**
  * 🔄 **如需擴充功能或進行重大重構**：必須先將該檔案最頂端的標記改為 `RED` (紅燈) 或 `YELLOW` (黃燈)，然後撰寫對應的單元測試與日誌，通過驗證後才能再切換回 `GREEN`。

### 🟡 黃燈 (YELLOW) - 開發中/新實作模組 (Active/New)
* **定義**：剛編寫完成、正在實作或擴充中的新模組與元件。
* **修改限制**：
  * 允許自由修改與調整。
  * 必須為其編寫對應的 DOM 單元測試與 Lifecycle 偵錯日誌。
  * 一旦該模組在實際環境中順利運行，且單元測試全部通過（All Tests Passed），開發人員必須主動將其狀態變更為 `GREEN`。

### 🔴 紅燈 (RED) - 故障/需擴充模組 (Broken/Extension Needed)
* **定義**：在執行期出錯、未通過單元測試，或正處於「從綠燈模組解封以進行功能擴充」的狀態。
* **修改限制**：
  * 應優先進行修復或擴充開發。
  * 修復完成且測試通過後，方可變更回 `GREEN`。

---

## 🎨 組件驅動與 CSS 模組化設計

1. **結構（HTML）與樣式（CSS）解耦**：
   * 不要使用硬編碼（Hardcoded）的 HTML 片段。所有按鈕、工具列、徽章等 UI 元素必須封裝成繼承自 `UIComponent` 的獨立元件類別。
   * 元件應各自負責輸出其對應的語義化標記與 CSS 變數，避免全域樣式污染。
2. **樣式隔離**：
   * 元件內部樣式儘量使用語義化的 CSS 變數（CSS Variables，如 `--color-primary`, `--padding-md`）。
   * 避免使用全域無作用域的 CSS 覆蓋，避免濫用 `!important`。

---

## 📝 統一日誌規範 (Logger Standards)

1. 所有元件與關鍵模組均須注入統一的日誌工具：
   ```typescript
   import { Logger } from '../../../utils/logger';
   ```
2. 在元件的 Lifecycle 中加入細緻的 Trace 點（例如：初始化、渲染渲染、狀態變更）。
3. 日誌系統將自動讀取 VS Code 的 `planist.debug.enable` 設定。只有在該設定啟用時，才會將日誌輸出到控制台。
4. 所有日誌輸出會根據該檔案的 `@status` 狀態加上對應的紅綠燈 Emoji 前綴，例如：
   * `🟢 [PlanistButton] Rendering button id=fitBtn`
   * `🟡 [PlanistTooltip] Initializing tooltip element`

---

## 🧪 單元測試規範

1. 所有新組件與狀態邏輯，必須在 `src/test/unit/` 下撰寫對應的 Vitest + JSDOM 單元測試。
2. 測試範疇必須包含：
   * **輸入與輸出驗證**：傳入不同屬性（Props），驗證元件輸出的 HTML 是否正確。
   * **樣式與類別驗證**：驗證是否套用了正確的 CSS 類別與變數。
3. 在提交或切換狀態至 `GREEN` 之前，必須執行 `npm run test:unit` 確保所有單元測試皆能通過。
