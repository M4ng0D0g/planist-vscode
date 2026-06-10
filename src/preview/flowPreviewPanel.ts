import * as vscode from 'vscode';
import { FlowIndexer } from '../indexing/flowIndexer';
import { FlowSchemaRenderer } from './ui/schemas/FlowSchemaRenderer';
import { RendererFactory } from './ui/schemas/RendererFactory';
import { SyncHub } from './sync/SyncHub';
import { prepareGraphData } from './graphDataProvider';
import { parseSchemaDocument } from './schemaParser';

export let currentPreviewPanel: vscode.WebviewPanel | undefined;
let currentIndexer: FlowIndexer | undefined;
let currentViewMode = 'general';
let currentSchema = 'flow';
let isWebviewLoading = false; // 🛠️ 關鍵修正：引入網頁狀態鎖，防止 Race Condition 造成的 EPIPE / 語法崩潰

function detectSchema(document?: vscode.TextDocument): string {
    if (!document) return 'flow';
    const text = document.getText();
    const match = text.match(/^\s*#schema\s+([a-zA-Z0-9_-]+)/i);
    if (match) {
        return match[1].toLowerCase();
    }
    return 'flow';
}

/**
 * 🚦 紅綠燈機制：檢查當前檔案的防禦狀態
 */
function getDocumentTrafficState(document?: vscode.TextDocument): 'green' | 'yellow' | 'red' {
    if (!document) return 'yellow';
    const firstFewLines = document.getText(new vscode.Range(0, 0, 5, 0));
    if (firstFewLines.includes('@state: green')) return 'green';
    if (firstFewLines.includes('@state: red')) return 'red';
    return 'yellow';
}

export function getOrCreatePreviewPanel(context: vscode.ExtensionContext, indexer: FlowIndexer): vscode.WebviewPanel {
    currentIndexer = indexer;
    if (currentPreviewPanel) return currentPreviewPanel;

    currentPreviewPanel = vscode.window.createWebviewPanel(
        'flowPreview', 'Flow Preview', vscode.ViewColumn.Beside,
        { 
            enableScripts: true, 
            retainContextWhenHidden: true 
        }
    );

    const activeDoc = vscode.window.activeTextEditor?.document;
    currentSchema = detectSchema(activeDoc);
    const renderer = RendererFactory.getRenderer(currentSchema);
    const nonce = getNonce();
    
    isWebviewLoading = true; // 鎖定網頁
    currentPreviewPanel.webview.html = renderer.renderPage(currentPreviewPanel.webview, nonce).render();
    
    currentPreviewPanel.onDidDispose(() => { 
        currentPreviewPanel = undefined; 
        isWebviewLoading = false;
    });

    // 前後端通訊橋樑監聽
    currentPreviewPanel.webview.onDidReceiveMessage(async (message) => {
        if (message?.command === 'ready' && currentPreviewPanel) {
            console.log('====== 接收到前端 Webview Ready 訊號，解除狀態鎖，推流初始數據 ======');
            isWebviewLoading = false; // 🛠️ 收到 Ready 訊號，正式解鎖
            await refreshPreview(currentPreviewPanel);
        }
        if (message?.command === 'openEntityFile' && typeof message.entityName === 'string') {
            await vscode.commands.executeCommand('planist.openFileByEntity', message.entityName);
        }
        if (message?.command === 'updateDocumentText' && typeof message.text === 'string') {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document) {
                // 🚦 紅綠燈硬限制：如果在 Debug 模式下且模組為綠燈，前端若發送修改指令，後端強制拒絕寫入
                if (getDocumentTrafficState(editor.document) === 'green') {
                    vscode.window.showWarningMessage('🚨 [Planist 衛兵] 該模組目前處於綠燈 (Stable) 狀態，禁止任何非物理性修改！');
                    return;
                }

                const edit = new vscode.WorkspaceEdit();
                const entireRange = new vscode.Range(
                    editor.document.positionAt(0),
                    editor.document.positionAt(editor.document.getText().length)
                );
                edit.replace(editor.document.uri, entireRange, message.text);
                await vscode.workspace.applyEdit(edit);
            }
        }
        if (message?.command === 'moveTask') {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document) {
                // 🚦 同步檢查工作看板是否有綠燈凍結限制
                if (getDocumentTrafficState(editor.document) === 'green') {
                    vscode.window.showWarningMessage('🚨 [Planist 衛兵] 看板檔案已被標記為綠燈，無法移動任務進程。');
                    return;
                }
                await SyncHub.handleMoveTask(
                    editor.document.uri,
                    message.taskTitle,
                    message.taskTarget,
                    message.fromList,
                    message.toList
                );
            }
        }
    });

    context.subscriptions.push(currentPreviewPanel);
    return currentPreviewPanel;
}

/**
 * 核心刷新功能：精準控制資料流推送時機
 */
export async function refreshPreview(panel: vscode.WebviewPanel): Promise<void> {
    const activeEditor = vscode.window.activeTextEditor;
    const document = activeEditor?.document;
    const schema = detectSchema(document);

    // 🛠️ 【修正點】如果架構改變，重新刷 HTML 骨架，開啟狀態鎖，阻斷後續資料推送
    if (schema !== currentSchema) {
        console.log(`[Schema 切換] 從 ${currentSchema} 切換至 ${schema}，重構 HTML 骨架並開啟時序鎖`);
        currentSchema = schema;
        isWebviewLoading = true; // 🛠️ 啟動狀態鎖！

        const renderer = RendererFactory.getRenderer(schema);
        const nonce = getNonce();
        panel.webview.html = renderer.renderPage(panel.webview, nonce).render();
        return; // 這裡安全 return，靜待新網頁發送 ready 訊號重新進入此函式
    }

    // 🛠️ 【核心防禦】如果目前網頁還在編譯或加載中，直接攔截，絕不冒險發送 postMessage
    if (isWebviewLoading) {
        console.log('[Data Flow Blocked] 網頁底層正在編譯中，攔截此次推送以防止 SyntaxError。');
        return;
    }

    // 🛠️ 如果一切就緒 (isWebviewLoading === false)，執行安全資料推流
    if (schema === 'flow') {
        if (!currentIndexer) return;
        
        console.log('[Data Flow] 正在獲取最新網路圖形與網格配置...');
        const { entities, config, boardConfig } = await prepareGraphData(currentIndexer, currentViewMode);
        
        if (!currentPreviewPanel || panel !== currentPreviewPanel) return;

        try {
            console.log('[Data Flow] 成功向前端發送 updateGraph 指令，節點數:', entities.length);
            await panel.webview.postMessage({
                command: 'updateGraph',
                data: { 
                    entities: JSON.parse(JSON.stringify(entities)) 
                },
                appearance: config?.appearance || {},
                mode: currentViewMode,
                boardConfig: boardConfig 
            });
        } catch (err) {
            console.error("Webview 發送失敗 (flow):", err);
        }
    } else {
        const text = document ? document.getText() : '';
        const data = parseSchemaDocument(schema, text);
        try {
            await panel.webview.postMessage({
                command: 'updateSchemaData',
                schema,
                data
            });
        } catch (err) {
            console.error(`Webview schema ${schema} data send failed:`, err);
        }
    }
}

function getNonce(): string {
    return Array.from({ length: 32 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
}

export async function refreshCurrentPreview(): Promise<void> {
    if (currentPreviewPanel) {
        await refreshPreview(currentPreviewPanel);
    }
}

export async function togglePreviewMode(): Promise<void> {
    const modes: Record<string, string> = {
        general: 'callchain',
        callchain: 'relation',
        relation: 'general',
    };
    currentViewMode = modes[currentViewMode] || 'general';
    
    await refreshCurrentPreview();
}