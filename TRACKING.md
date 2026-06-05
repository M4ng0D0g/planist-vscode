# 🚦 Planist 專案全域核心檔案追蹤儀表板

> 本文件由 `traffic-light-guardrail` 腳本自動產生。每次 Agent 通過測試後均會重新掃描更新。

| 檔案路徑 | 系統架構狀態 (最低階燈號) | 實質代碼行數 (上限 200) | 內部功能狀態分佈 |
| :--- | :---: | :---: | :--- |
| `src\commands\commandController.ts` | 🟡 Yellow (未標記) | 154 | `綠: 0 | 黃: 0 | 紅: 0` |
| `src\config\logger.ts` | 🟡 Yellow (未標記) | 40 | `綠: 0 | 黃: 0 | 紅: 0` |
| `src\config\patternManager.ts` | 🟡 Yellow (未標記) | 80 | `綠: 0 | 黃: 0 | 紅: 0` |
| `src\config\planistConfig.ts` | 🟡 Yellow (未標記) | ⚠️ **282** | `綠: 0 | 黃: 0 | 紅: 0` |
| `src\core\graph\graphBuilder.ts` | 🟡 Yellow (未標記) | 34 | `綠: 0 | 黃: 0 | 紅: 0` |
| `src\core\graph\graphTraversal.ts` | 🟡 Yellow (內部含未穩定函式) | ⚠️ **209** | `綠: 0 | 黃: 0 | 紅: 2` |
| `src\dsl\flowDsl.ts` | 🟢 Green | ⚠️ **1067** | `綠: 2 | 黃: 0 | 紅: 0` |
| `src\dsl\taskDsl.ts` | 🟡 Yellow (未標記) | 78 | `綠: 0 | 黃: 0 | 紅: 0` |
| `src\extension.ts` | 🟡 Yellow (未標記) | 133 | `綠: 0 | 黃: 0 | 紅: 0` |
| `src\indexing\flowIndexer.ts` | 🟡 Yellow (未標記) | ⚠️ **262** | `綠: 0 | 黃: 0 | 紅: 0` |
| `src\indexing\workspaceManager.ts` | 🟡 Yellow (未標記) | 119 | `綠: 0 | 黃: 0 | 紅: 0` |
| `src\preview\flowPreviewPanel.ts` | 🟡 Yellow (內部含未穩定函式) | 160 | `綠: 1 | 黃: 0 | 紅: 1` |
| `src\preview\graphDataProvider.ts` | 🟡 Yellow (內部含未穩定函式) | 52 | `綠: 0 | 黃: 0 | 紅: 1` |
| `src\preview\newFlowPreviewPanel.ts` | 🟡 Yellow (內部含未穩定函式) | 152 | `綠: 7 | 黃: 0 | 紅: 4` |
| `src\preview\schemaParser.ts` | 🟡 Yellow (未標記) | ⚠️ **290** | `綠: 0 | 黃: 0 | 紅: 0` |
| `src\preview\sync\SyncHub.ts` | 🟡 Yellow (未標記) | 47 | `綠: 0 | 黃: 0 | 紅: 0` |
| `src\preview\ui\components\PlanistBadge.ts` | 🟡 Yellow (未標記) | 13 | `綠: 0 | 黃: 0 | 紅: 0` |
| `src\preview\ui\components\PlanistButton.ts` | 🟡 Yellow (未標記) | 19 | `綠: 0 | 黃: 0 | 紅: 0` |
| `src\preview\ui\components\PlanistToolbar.ts` | 🟡 Yellow (未標記) | 13 | `綠: 0 | 黃: 0 | 紅: 0` |
| `src\preview\ui\components\PlanistTooltip.ts` | 🟡 Yellow (未標記) | 13 | `綠: 0 | 黃: 0 | 紅: 0` |
| `src\preview\ui\components\Toolbar.ts` | 🟡 Yellow (未標記) | 10 | `綠: 0 | 黃: 0 | 紅: 0` |
| `src\preview\ui\core\Component.ts` | 🟡 Yellow (未標記) | 21 | `綠: 0 | 黃: 0 | 紅: 0` |
| `src\preview\ui\core\WebviewPage.ts` | 🟡 Yellow (未標記) | 44 | `綠: 0 | 黃: 0 | 紅: 0` |
| `src\preview\ui\schemas\ApiSchemaRenderer.ts` | 🟡 Yellow (未標記) | 155 | `綠: 0 | 黃: 0 | 紅: 0` |
| `src\preview\ui\schemas\DatabaseSchemaRenderer.ts` | 🟡 Yellow (未標記) | 170 | `綠: 0 | 黃: 0 | 紅: 0` |
| `src\preview\ui\schemas\DesignSchemaRenderer.ts` | 🟡 Yellow (未標記) | 182 | `綠: 0 | 黃: 0 | 紅: 0` |
| `src\preview\ui\schemas\FlowSchemaJS.ts` | 🟡 Yellow (未標記) | ⚠️ **392** | `綠: 0 | 黃: 0 | 紅: 0` |
| `src\preview\ui\schemas\FlowSchemaRenderer.ts` | 🟡 Yellow (內部含未穩定函式) | 58 | `綠: 0 | 黃: 0 | 紅: 1` |
| `src\preview\ui\schemas\NewFlowSchemaJS.ts` | 🟡 Yellow (內部含未穩定函式) | ⚠️ **685** | `綠: 12 | 黃: 0 | 紅: 5` |
| `src\preview\ui\schemas\NewFlowSchemaRenderer.ts` | 🟡 Yellow (內部含未穩定函式) | ⚠️ **380** | `綠: 0 | 黃: 0 | 紅: 4` |
| `src\preview\ui\schemas\RendererFactory.ts` | 🟢 Green | 28 | `綠: 1 | 黃: 0 | 紅: 0` |
| `src\preview\ui\schemas\SchemaRenderer.ts` | 🟡 Yellow (未標記) | 5 | `綠: 0 | 黃: 0 | 紅: 0` |
| `src\preview\ui\schemas\StateSchemaRenderer.ts` | 🟡 Yellow (未標記) | 184 | `綠: 0 | 黃: 0 | 紅: 0` |
| `src\preview\ui\schemas\TaskSchemaJS.ts` | 🟡 Yellow (未標記) | 85 | `綠: 0 | 黃: 0 | 紅: 0` |
| `src\preview\ui\schemas\TaskSchemaRenderer.ts` | 🟡 Yellow (未標記) | 59 | `綠: 0 | 黃: 0 | 紅: 0` |
| `src\providers\codeActionProvider.ts` | 🟡 Yellow (未標記) | 49 | `綠: 0 | 黃: 0 | 紅: 0` |
| `src\providers\completionProvider.ts` | 🟡 Yellow (未標記) | ⚠️ **328** | `綠: 0 | 黃: 0 | 紅: 0` |
| `src\providers\definitionProvider.ts` | 🟡 Yellow (內部含未穩定函式) | ⚠️ **293** | `綠: 0 | 黃: 1 | 紅: 0` |
| `src\providers\highlighter.ts` | 🟡 Yellow (未標記) | 147 | `綠: 0 | 黃: 0 | 紅: 0` |
| `src\providers\hoverProvider.ts` | 🟡 Yellow (未標記) | 65 | `綠: 0 | 黃: 0 | 紅: 0` |
| `src\providers\linterProvider.ts` | 🟡 Yellow (未標記) | ⚠️ **244** | `綠: 0 | 黃: 0 | 紅: 0` |
| `src\providers\semanticProvider.ts` | 🟡 Yellow (未標記) | 54 | `綠: 0 | 黃: 0 | 紅: 0` |
| `src\test\extension.test.ts` | 🟡 Yellow (未標記) | 9 | `綠: 0 | 黃: 0 | 紅: 0` |
| `src\test\flowDsl.test.ts` | 🟡 Yellow (未標記) | ⚠️ **317** | `綠: 0 | 黃: 0 | 紅: 0` |
| `src\test\flowIntelligence.test.ts` | 🟡 Yellow (未標記) | 131 | `綠: 0 | 黃: 0 | 紅: 0` |
| `src\test\unit\callChain.test.ts` | 🟡 Yellow (未標記) | 137 | `綠: 0 | 黃: 0 | 紅: 0` |
| `src\test\unit\components.test.ts` | 🟡 Yellow (未標記) | 65 | `綠: 0 | 黃: 0 | 紅: 0` |
| `src\test\unit\flowDsl.test.ts` | 🟡 Yellow (未標記) | 48 | `綠: 0 | 黃: 0 | 紅: 0` |
| `src\utils\logger.ts` | 🟡 Yellow (未標記) | 45 | `綠: 0 | 黃: 0 | 紅: 0` |
| `src\utils\shortcutResolver.ts` | 🟡 Yellow (未標記) | 58 | `綠: 0 | 黃: 0 | 紅: 0` |
