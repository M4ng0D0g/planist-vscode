import * as vscode from 'vscode';
import { FlowIndexer } from '../indexing/flowIndexer';
import { RendererFactory } from './ui/schemas/RendererFactory';
import { prepareGraphData } from './graphDataProvider';
import { parseSchemaDocument } from './schemaParser';

export let currentPreviewPanel: vscode.WebviewPanel | undefined;
let currentIndexer: FlowIndexer | undefined;
let currentViewMode = 'general';
let currentSchema = 'flow';
let isWebviewLoading = false;
let currentCallChainStart: { entityName: string; methodName: string } | undefined;

// @state: green
function detectSchema(document?: vscode.TextDocument): string {
    if (!document) return 'flow';
    const text = document.getText();
    const match = text.match(/^\s*#schema\s+([a-zA-Z0-9_-]+)/i);
    if (match) {
        return match[1].toLowerCase();
    }
    return 'flow';
}

// @state: green
function getDocumentTrafficState(document?: vscode.TextDocument): 'green' | 'yellow' | 'red' {
    if (!document) return 'yellow';
    const firstFewLines = document.getText(new vscode.Range(0, 0, 5, 0));
    if (firstFewLines.includes('@state: green')) return 'green';
    if (firstFewLines.includes('@state: red')) return 'red';
    return 'yellow';
}

// @state: red
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
    
    isWebviewLoading = true;
    currentPreviewPanel.webview.html = renderer.renderPage(currentPreviewPanel.webview, nonce).render();
    
    // @state: green
    currentPreviewPanel.onDidDispose(() => { 
        currentPreviewPanel = undefined; 
        isWebviewLoading = false;
    });

    // @state: green
    currentPreviewPanel.webview.onDidReceiveMessage(async (message) => {
        if (message?.command === 'ready' && currentPreviewPanel) {
            console.log('[New Board Webview] Ready signal received. Dispatching initial data.');
            isWebviewLoading = false;
            await refreshPreview(currentPreviewPanel);
        }
        if (message?.command === 'openEntityFile' && typeof message.entityName === 'string') {
            await vscode.commands.executeCommand('planist.openFileByEntity', message.entityName);
        }
        if (message?.command === 'startCallChain' && typeof message.entityName === 'string' && typeof message.methodName === 'string') {
            currentViewMode = 'callchain';
            currentCallChainStart = { entityName: message.entityName, methodName: message.methodName };
            if (currentPreviewPanel) {
                await refreshPreview(currentPreviewPanel);
            }
        }
        if (message?.command === 'exitCallChain') {
            currentViewMode = 'general';
            currentCallChainStart = undefined;
            if (currentPreviewPanel) {
                await refreshPreview(currentPreviewPanel);
            }
        }
        if (message?.command === 'gotoLine' && typeof message.line === 'number') {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const position = new vscode.Position(message.line, 0);
                editor.selection = new vscode.Selection(position, position);
                editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
            }
        }
        if (message?.command === 'toggleFullscreen') {
            await vscode.commands.executeCommand('workbench.action.toggleMaximizeEditorGroup');
        }
    });

    context.subscriptions.push(currentPreviewPanel);
    return currentPreviewPanel;
}

// @state: red
export async function refreshPreview(panel: vscode.WebviewPanel): Promise<void> {
    const activeEditor = vscode.window.activeTextEditor;
    const document = activeEditor?.document;
    const schema = detectSchema(document);

    if (schema !== currentSchema) {
        console.log(`[New Board Schema Shift] Changing from ${currentSchema} to ${schema}`);
        currentSchema = schema;
        isWebviewLoading = true;

        const renderer = RendererFactory.getRenderer(schema);
        const nonce = getNonce();
        panel.webview.html = renderer.renderPage(panel.webview, nonce).render();
        return;
    }

    if (isWebviewLoading) {
        console.log('[New Board Blocked] Webview is loading, blocking data flow.');
        return;
    }

    if (schema === 'flow') {
        if (!currentIndexer) return;
        
        console.log('[New Board Data Flow] Fetching network graph and grid config...');
        const { entities, config, boardConfig } = await prepareGraphData(currentIndexer, currentViewMode, currentCallChainStart);
        
        if (!currentPreviewPanel || panel !== currentPreviewPanel) return;

        try {
            console.log('[New Board Data Flow] Sending updateGraph command. Entities count:', entities.length);
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
            console.error("Webview send failure (new board flow):", err);
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
            console.error(`Webview schema ${schema} data send failed (new board):`, err);
        }
    }
}

// @state: green
function getNonce(): string {
    return Array.from({ length: 32 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
}

// @state: green
export async function refreshCurrentPreview(): Promise<void> {
    if (currentPreviewPanel) {
        await refreshPreview(currentPreviewPanel);
    }
}

// @state: red
export async function togglePreviewMode(): Promise<void> {
    const modes: Record<string, string> = {
        general: 'relation',
        relation: 'general',
    };
    currentViewMode = modes[currentViewMode] || 'general';
    currentCallChainStart = undefined;
    
    await refreshCurrentPreview();
}
