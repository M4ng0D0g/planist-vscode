#!/bin/bash
# agent-git-diff.sh - 供 Agent 分析的版本差異工具

COMMIT_A=$1
COMMIT_B=$2

if [ -z "$COMMIT_A" ]; then
    echo "❌ 錯誤: Agent 必須至少提供一個 Commit Hash 進行比對。"
    exit 1
fi

# 如果沒有給第二個 Commit，預設跟目前的工作區 (HEAD) 比對
if [ -z "$COMMIT_B" ]; then
    COMMIT_B="HEAD"
fi

echo "=== 正在對比 $COMMIT_A 與 $COMMIT_B 的檔案變更統計 ==="
git diff --stat "$COMMIT_A" "$COMMIT_B"

echo -e "\n=== 核心 `.pln` 拓撲檔案的精準變更 (Diff) ==="
# 優先篩選出 .pln 檔案的修改細節，讓 Agent 能秒懂流程圖的改動
git diff "$COMMIT_A" "$COMMIT_B" -- '*.pln'