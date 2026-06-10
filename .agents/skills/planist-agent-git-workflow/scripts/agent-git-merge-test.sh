#!/bin/bash
# agent-git-merge-test.sh - 合併至 test 分支供用戶測試
FEATURE_BRANCH=$(git branch --show-current)

if [ "$FEATURE_BRANCH" = "main" ] || [ "$FEATURE_BRANCH" = "test" ]; then
    echo "[Error] 當前分支為 $FEATURE_BRANCH，無法執行測試合併流程。"
    exit 1
fi

# 確保當前分支沒有未提交的髒代碼
git add .
if ! git diff-index --quiet HEAD --; then
    git commit -m "chore(agent): save temporary state before merging to test" --quiet
fi

echo "[Workflow-Implicit] 開始將 $FEATURE_BRANCH 合併至 test 分支..."

# 檢查 test 分支是否存在，不存在則從 main 建立
if ! git show-ref --verify --quiet refs/heads/test; then
    git checkout -b test main --quiet
else
    git checkout test --quiet
fi

# 執行合併 (採用衍生衝突優先的正常合併，若有衝突需由後面矩陣處理)
git merge "$FEATURE_BRANCH" --no-edit --quiet

if [ $? -ne 0 ]; then
    echo "[Conflict] 合併至 test 分支時發生衝突！啟動自動衝突解決方案..."
    # 測試環境若有衝突，以當前特性分支 (最新代碼) 為準
    git merge --abort
    git checkout test --quiet
    git merge "$FEATURE_BRANCH" -X theirs --no-edit --quiet
fi

# 切回原特性分支，讓 Agent 保持在開發狀態
git checkout "$FEATURE_BRANCH" --quiet
echo "[Workflow-Implicit] 已成功部署至 test 分支。請測試您的功能！"