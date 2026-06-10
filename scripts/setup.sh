#!/bin/bash

echo "=== 1. 更新系統套件庫 ==="
sudo apt-get update -y

echo "=== 2. 安裝 Node.js LTS (v20.x) 與 npm ==="
if ! command -v node &> /dev/null; then
    # 已修正：移除 Markdown 超連結格式，還原為正確的 URL
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "Node.js 已存在，跳過安裝。版本: $(node -v)"
fi

echo "=== 3. 修正 npm 全域安裝權限 (避免 EACCES 錯誤) ==="
mkdir -p "${HOME}/.npm-global"
npm config set prefix '~/.npm-global'

# 寫入環境變數至 .bashrc (若不存在)
if ! grep -q ".npm-global" ~/.bashrc; then
    echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
    echo "環境變數已寫入 ~/.bashrc"
fi
export PATH=~/.npm-global/bin:$PATH

echo "=== 4. 安裝全域腳手架工具 ==="
# 注意：因為上方調整了 prefix，這裡不需要加 sudo 即可全域安裝
npm install -g yo generator-code

echo "=== 5. 安裝專案本地端開發依賴 ==="
cd "$(dirname "$0")" || exit
npm install

echo "=== 執行完畢 ==="
echo "請手動執行 'source ~/.bashrc' 刷新當前終端機視窗，即可開始開發！"