#!/bin/bash
# agent-git-save.sh - 自動 Staging 與 Commit
MSG=$1
if [ -z "$MSG" ]; then
    MSG="feat(agent): automated workflow checkpoint $(date +%Y%m%d-%H%M%S)"
fi

CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" = "main" ] || [ "$CURRENT_BRANCH" = "test" ]; then
    echo "[Error] 嚴禁在 $CURRENT_BRANCH 分支直接提交代碼！"
    exit 1
fi

git add .
if git diff-index --quiet HEAD --; then
    echo "[Workflow-Implicit] 沒有偵測到任何程式碼變更，跳過提交。"
else
    git commit -m "$MSG" --quiet
    echo "[Workflow-Implicit] 程式碼已成功提交至 $CURRENT_BRANCH 分支。"
fi