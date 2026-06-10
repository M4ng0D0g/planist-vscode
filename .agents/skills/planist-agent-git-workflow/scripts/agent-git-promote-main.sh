#!/bin/bash
# agent-git-promote-main.sh - 測試通過，正式合併至 main 主線
FEATURE_BRANCH=$(git branch --show-current)

if [ "$FEATURE_BRANCH" = "main" ] || [ "$FEATURE_BRANCH" = "test" ]; then
    # 如果 Agent 當前不小心在 test 分支，改由環境變數或提示傳入，此處防禦性防錯
    echo "[Error] 請在欲晉升的特性分支上執行此腳本，或確保分支指引正確。"
    exit 1
fi

echo "[Workflow-Implicit] 收到測試通過訊號。開始將 $FEATURE_BRANCH 晉升至 main 分支..."

git checkout main --quiet
git merge "$FEATURE_BRANCH" --no-edit --quiet

if [ $? -ne 0 ]; then
    echo "[Conflict] 晉升主線時發生衝突！以 main 分支穩定結構為優先..."
    git merge --abort
    git merge "$FEATURE_BRANCH" -X ours --no-edit --quiet
fi

# 合併完畢後，切回原本的特性分支或留守 main
git checkout "$FEATURE_BRANCH" --quiet
echo "[Workflow-Implicit] 晉升成功！代碼已安全合併至 main 分支。"