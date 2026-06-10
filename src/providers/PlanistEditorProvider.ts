import * as vscode from 'vscode';
import { PlanistViewModel } from '../core/model/PlanistViewModel';
import { RendererFactory } from '../preview/ui/schemas/RendererFactory';
import { prepareGraphData } from '../preview/graphDataProvider';
import { parseSchemaDocument } from '../preview/schemaParser';
import { FlowIndexer } from '../indexing/flowIndexer';

// @state: green
export class PlanistEditorProvider implements vscode.CustomTextEditorProvider {
    public static readonly viewType = 'planist.flowEditor';

    // @state: green
    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly indexer: FlowIndexer
    ) {}

    // @state: green
    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        token: vscode.CancellationToken
    ): Promise<void> {
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this.context.extensionUri
            ]
        };

        const viewModel = new PlanistViewModel(document);
        await viewModel.load();

        let currentViewMode = 'general';
        let currentCallChainStart: { entityName: string; methodName: string } | undefined = undefined;

        // @state: green
        const updateWebview = async () => {
            const schema = this.detectSchema(document);
            if (schema === 'flow') {
                const { entities, connections, config, boardConfig } = await prepareGraphData(
                    this.indexer,
                    currentViewMode,
                    currentCallChainStart,
                    document.uri
                );
                await webviewPanel.webview.postMessage({
                    command: 'updateGraph',
                    data: {
                        entities: JSON.parse(JSON.stringify(entities)),
                        connections: connections || []
                    },
                    appearance: config?.appearance || {},
                    mode: currentViewMode,
                    boardConfig: boardConfig
                });
            } else {
                const text = document.getText();
                const data = parseSchemaDocument(schema, text);
                await webviewPanel.webview.postMessage({
                    command: 'updateSchemaData',
                    schema,
                    data
                });
            }
        };

        const schema = this.detectSchema(document);
        const renderer = RendererFactory.getRenderer(schema);
        const nonce = this.getNonce();
        webviewPanel.webview.html = renderer.renderPage(webviewPanel.webview, nonce).render();

        // @state: green
        webviewPanel.webview.onDidReceiveMessage(async (message) => {
            if (message.command === 'ready') {
                await updateWebview();
            }
            if (message.command === 'openEntityFile' && typeof message.entityName === 'string') {
                await vscode.commands.executeCommand('planist.openFileByEntity', message.entityName);
            }
            if (message.command === 'startCallChain' && typeof message.entityName === 'string' && typeof message.methodName === 'string') {
                currentViewMode = 'callchain';
                currentCallChainStart = { entityName: message.entityName, methodName: message.methodName };
                await updateWebview();
            }
            if (message.command === 'exitCallChain') {
                currentViewMode = 'general';
                currentCallChainStart = undefined;
                await updateWebview();
            }
            if (message.command === 'gotoLine' && typeof message.line === 'number') {
                const textEditor = await vscode.window.showTextDocument(document, {
                    viewColumn: vscode.ViewColumn.Beside,
                    preview: true
                });
                const position = new vscode.Position(message.line, 0);
                textEditor.selection = new vscode.Selection(position, position);
                textEditor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
            }
            if (message.command === 'toggleFullscreen') {
                await vscode.commands.executeCommand('workbench.action.toggleMaximizeEditorGroup');
            }
            if (message.command === 'updateEntity' && typeof message.originalName === 'string') {
                if (this.getDocumentTrafficState(document) === 'green') {
                    vscode.window.showWarningMessage('🚨 [Planist 衛兵] 該模組目前處於綠燈 (Stable) 狀態，禁止任何非物理性修改！');
                    return;
                }
                await viewModel.updateEntity(message.originalName, message.data);
            }
            if (message.command === 'updateEntityColor' && typeof message.entityName === 'string') {
                if (this.getDocumentTrafficState(document) === 'green') {
                    vscode.window.showWarningMessage('🚨 [Planist 衛兵] 該模組目前處於綠燈 (Stable) 狀態，禁止 any 非物理性修改！');
                    return;
                }
                await viewModel.updateEntityColor(message.entityName, message.color);
            }
            if (message.command === 'updateEntityPosition' && typeof message.entityName === 'string') {
                if (this.getDocumentTrafficState(document) === 'green') {
                    vscode.window.showWarningMessage('🚨 [Planist 衛兵] 該模組目前處於綠燈 (Stable) 狀態，禁止 any 非物理性修改！');
                    return;
                }
                await viewModel.updateEntityPosition(message.entityName, message.position);
            }
            if (message.command === 'updateConnection') {
                if (this.getDocumentTrafficState(document) === 'green') {
                    vscode.window.showWarningMessage('🚨 [Planist 衛兵] 該模組目前處於綠燈 (Stable) 狀態，禁止 any 非物理性修改！');
                    return;
                }
                await viewModel.updateConnection(message.connection);
            }
            if (message.command === 'updateMultipleConnections') {
                if (this.getDocumentTrafficState(document) === 'green') {
                    vscode.window.showWarningMessage('🚨 [Planist 衛兵] 該模組目前處於綠燈 (Stable) 狀態，禁止 any 非物理性修改！');
                    return;
                }
                await viewModel.updateMultipleConnections(message.connections);
            }
        });

        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(async (e) => {
            if (e.document.uri.toString() === document.uri.toString()) {
                viewModel.reloadDocument();
                await updateWebview();
            }
        });

        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
        });
    }

    // @state: green
    private getNonce(): string {
        return Array.from({ length: 32 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
    }

    // @state: green
    private detectSchema(document: vscode.TextDocument): string {
        const text = document.getText();
        const match = text.match(/^\s*#schema\s+([a-zA-Z0-9_-]+)/i);
        if (match) {
            return match[1].toLowerCase();
        }
        return 'flow';
    }

    // @state: green
    private getDocumentTrafficState(document: vscode.TextDocument): 'green' | 'yellow' | 'red' {
        const firstFewLines = document.getText(new vscode.Range(0, 0, 5, 0));
        if (firstFewLines.includes('@state' + ': green')) return 'green';
        if (firstFewLines.includes('@state' + ': red')) return 'red';
        return 'yellow';
    }
}
