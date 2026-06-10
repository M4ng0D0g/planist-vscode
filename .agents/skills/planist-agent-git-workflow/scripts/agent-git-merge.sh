FEATURE_BRANCH=$(git branch --show-current)

if [ "$FEATURE_BRANCH" = "main" ] || [ "$FEATURE_BRANCH" = "master" ]; then
    echo "[Workflow-Implicit] 目前已在主要分支，跳過整合流程。"
    exit 0
fi

echo "[Workflow-Implicit] 偵測到人類測試通過，啟動無人值守整合程序..."

# 強制切換回主要分支並同步
git checkout main --quiet
git pull origin main --quiet

# 執行合併
git merge "$FEATURE_BRANCH" --no-edit
MERGE_STATUS=$?

if [ $MERGE_STATUS -eq 0 ]; then
    echo "[Workflow-Implicit] 合併成功，正在清理特性分支 $FEATURE_BRANCH..."
    git branch -d "$FEATURE_BRANCH" --quiet
    
    # 刷新快取確保下一輪開發安全
    rm -rf dist out .vscode-test
    npm install --silent
    npm run build --silent
    echo "🟢 [Workflow-Implicit] 整合完成，主分支已同步並編譯完畢。"
else
    echo "❌ [Workflow-Implicit] 整合發生衝突！請立即啟動衝突解算矩陣。"
    exit 1
fi