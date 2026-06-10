#!/bin/bash
# agent-git-checkout.sh - 供 Agent 呼叫的無人值守全自動回歸引擎

TARGET_COMMIT=$1

if [ -z "$TARGET_COMMIT" ]; then
    echo "❌ 錯誤: Agent 未指定回歸目標 Commit Hash。"
    exit 1
fi

echo "[Agent 執行中] 啟動自動化存檔與回歸程序，目標: $TARGET_COMMIT"

# 1. 自動把當前所有未暫存的程式碼強行塞進 Stash，防止 Checkout 失敗
git stash -u --quiet

# 2. 強行切換至目標 Commit
git checkout "$TARGET_COMMIT" --quiet
if [ $? -ne 0 ]; then
    echo "❌ [Agent 失敗] Git Checkout 異常，目標雜湊可能無效。"
    exit 1
fi

# 3. 徹底清空快取與舊產物 (Windows/WSL 相容清理)
rm -rf dist out .vscode-test

# 4. 重新對齊環境依賴 (不跳出任何警告或互動)
npm install --silent

# 5. 全新編譯生產
npm run build --silent

echo "🟢 [Agent 成功] 專案已成功倒回至 $TARGET_COMMIT，環境已重構編譯完畢。"