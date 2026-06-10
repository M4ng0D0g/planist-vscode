FEATURE_NAME=$1
if [ -z "$FEATURE_NAME" ]; then
    FEATURE_NAME="feat/agent-update-$(date +%Y%m%d-%H%M%S)"
fi

CURRENT_BRANCH=$(git branch --show-current)

if [ "$CURRENT_BRANCH" = "main" ] || [ "$CURRENT_BRANCH" = "master" ]; then
    echo "[Workflow-Implicit] 目前處於主要分支，自動切換至新特性分支: $FEATURE_NAME"
    git checkout -b "$FEATURE_NAME" --quiet
else
    echo "[Workflow-Implicit] 目前已處於子分支: $CURRENT_BRANCH，無需切換。"
fi