#!/bin/bash
# agent-git-log.sh - 供 Agent 讀取的結構化 Git 歷史清單

LIMIT=${1:-10} # 預設只輸出最近 10 筆，避免 Token 爆炸

# 使用 Git 預設格式，輸出「Hash | 日期 | 作者 | 訊息」的乾淨純文字列表
# 這種一條一條的純文字，對 LLM (Agent) 的 Token 閱讀效率最高
git log -n "$LIMIT" --pretty=format:"%h | %cd | %an | %s" --date=short

echo "" # 補上換行