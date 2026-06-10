// .agents/skills/planist-refactor-linter/scripts/update-dashboard.js
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = process.cwd();
const TRACKING_FILE = path.join(PROJECT_ROOT, 'TRACKING.md');
const SRC_DIR = path.join(PROJECT_ROOT, 'src'); // 根據你的實際源碼目錄調整

function scanDirectory(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            if (file !== 'node_modules' && file !== 'out' && !file.startsWith('.')) {
                scanDirectory(filePath, fileList);
            }
        } else if (/\.(ts|js|cpp|hpp|java|plan)$/.test(file)) {
            fileList.push(filePath);
        }
    });
    return fileList;
}

function analyzeFileStates() {
    const sourceFiles = scanDirectory(SRC_DIR);
    const report = [];

    sourceFiles.forEach(filePath => {
        const content = fs.readFileSync(filePath, 'utf-8');
        const relativePath = path.relative(PROJECT_ROOT, filePath);
        
        // 算行數 (扣除空行與純註解)
        const lines = content.split('\n').filter(line => {
            const trimmed = line.trim();
            return trimmed !== '' && !trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('*');
        }).length;

        // 抓取檔案內所有的函式狀態標記
        const stateMatches = [...content.matchAll(/@state:\s*(green|yellow|red)/g)].map(m => m[1]);

        let fileStatus = '🟢 Green';
        if (stateMatches.length === 0) {
            fileStatus = '🟡 Yellow (未標記)';
        } else if (stateMatches.includes('yellow') || stateMatches.includes('red')) {
            fileStatus = '🟡 Yellow (內部含未穩定函式)';
        }

        report.push({
            file: relativePath,
            status: fileStatus,
            lines: lines,
            breakdown: `綠: ${stateMatches.filter(s => s==='green').length} | 黃: ${stateMatches.filter(s => s==='yellow').length} | 紅: ${stateMatches.filter(s => s==='red').length}`
        });
    });

    return report;
}

function writeMarkdownDashboard(report) {
    let md = `# 🚦 Planist 專案全域核心檔案追蹤儀表板\n\n`;
    md += `> 本文件由 \`traffic-light-guardrail\` 腳本自動產生。每次 Agent 通過測試後均會重新掃描更新。\n\n`;
    md += `| 檔案路徑 | 系統架構狀態 (最低階燈號) | 實質代碼行數 (上限 200) | 內部功能狀態分佈 |\n`;
    md += `| :--- | :---: | :---: | :--- |\n`;

    report.forEach(row => {
        const lineWarning = row.lines > 200 ? `⚠️ **${row.lines}**` : `${row.lines}`;
        md += `| \`${row.file}\` | ${row.status} | ${lineWarning} | \`${row.breakdown}\` |\n`;
    });

    fs.writeFileSync(TRACKING_FILE, md, 'utf-8');
    console.log('📊 TRACKING.md 儀表板已成功動態同步！');
}

const fileReport = analyzeFileStates();
writeMarkdownDashboard(fileReport);