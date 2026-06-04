import * as vscode from 'vscode';
import { FlowIndexer } from '../indexing/flowIndexer';
import { FlowSchemaRenderer } from './ui/schemas/FlowSchemaRenderer';
import { prepareGraphData } from './graphDataProvider';

export let currentPreviewPanel: vscode.WebviewPanel | undefined;
let currentIndexer: FlowIndexer | undefined;
let currentViewMode = 'general';

export function getOrCreatePreviewPanel(context: vscode.ExtensionContext, indexer: FlowIndexer): vscode.WebviewPanel {
    currentIndexer = indexer;
    if (currentPreviewPanel) return currentPreviewPanel;

    currentPreviewPanel = vscode.window.createWebviewPanel(
        'flowPreview', 'Flow Preview', vscode.ViewColumn.Beside,
        { enableScripts: true, retainContextWhenHidden: true }
    );

    const renderer = new FlowSchemaRenderer();
    const nonce = getNonce();
    
    // 渲染骨架頁面
    currentPreviewPanel.webview.html = renderer.renderPage(currentPreviewPanel.webview, nonce).render();
    
    currentPreviewPanel.onDidDispose(() => { 
        currentPreviewPanel = undefined; 
    });

    // 前後端通訊橋樑監聽
    currentPreviewPanel.webview.onDidReceiveMessage(async (message) => {
        if (message?.command === 'ready' && currentPreviewPanel) {
            await refreshPreview(currentPreviewPanel);
        }
        if (message?.command === 'openEntityFile' && typeof message.entityName === 'string') {
            await vscode.commands.executeCommand('planist.openFileByEntity', message.entityName);
        }
    });

    context.subscriptions.push(currentPreviewPanel);
    return currentPreviewPanel;
}

// src/preview/flowPreviewPanel.ts 內部的 refreshPreview 函數

export async function refreshPreview(panel: vscode.WebviewPanel): Promise<void> {
    if (!currentIndexer) return;

    // 1. 取得包含網格設定的全新資料包
    const { entities, config, boardConfig } = await prepareGraphData(currentIndexer, currentViewMode);

    // 2. 非同步時序防禦線
    if (!currentPreviewPanel || panel !== currentPreviewPanel) {
        return; 
    }

    try {
        // 3. 推送給前端
        await panel.webview.postMessage({
            command: 'updateGraph',
            data: { entities },
            appearance: config?.appearance || {},
            mode: currentViewMode,
            boardConfig // 🔥 注入網格背景配置，強迫前端動態重繪
        });
    } catch (err) {
        console.error("Webview 發送失敗:", err);
    }
}

function getNonce(): string {
    return Array.from({ length: 32 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
}

/**
 * 全域重新整理：安全地將最新資料推送到當前活著的面板中
 */
export async function refreshCurrentPreview(): Promise<void> {
    if (currentPreviewPanel) {
        await refreshPreview(currentPreviewPanel);
    }
}

/**
 * 切換模式：切換視角模式，並強迫重刷（配合新架構可以先保留空實作或加入你的模式切換邏輯）
 */
export async function togglePreviewMode(): Promise<void> {
    // 預留未來 Switch Mode 按鈕按下的後端擴充點
    const modes: Record<string, string> = {
        general: 'callchain',
        callchain: 'relation',
        relation: 'general',
    };
    currentViewMode = modes[currentViewMode] || 'general';
    
    await refreshCurrentPreview();
}