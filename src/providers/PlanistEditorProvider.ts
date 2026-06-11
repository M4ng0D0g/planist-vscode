import * as vscode from 'vscode';
import { PlanistViewModel } from '../core/model/PlanistViewModel';
import { RendererFactory } from '../preview/ui/schemas/RendererFactory';
import { prepareGraphData } from '../preview/graphDataProvider';
import { parseSchemaDocument, parseDocsSchema, DocsSchemaData } from '../preview/schemaParser';
import { FlowIndexer } from '../indexing/flowIndexer';

// @state: red
export class PlanistEditorProvider implements vscode.CustomTextEditorProvider {
    public static readonly viewType = 'planist.flowEditor';

    // @state: green
    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly indexer: FlowIndexer
    ) {}

    // @state: red
    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        token: vscode.CancellationToken
    ): Promise<void> {
        // Check if the file is empty and doesn't specify a schema
        const text = document.getText().trim();
        const hasSchema = /^\s*#schema\s+/i.test(text);
        if (text.length === 0 && !hasSchema) {
            webviewPanel.dispose();
            await vscode.commands.executeCommand('vscode.openWith', document.uri, 'default');
            return;
        }

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
                    data,
                    text
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
            if (message.command === 'createEntityPrompt' && typeof message.x === 'number' && typeof message.y === 'number') {
                if (this.getDocumentTrafficState(document) === 'green') {
                    vscode.window.showWarningMessage('🚨 [Planist 衛兵] 該模組目前處於綠燈 (Stable) 狀態，禁止 any 非物理性修改！');
                    return;
                }
                const x = message.x;
                const y = message.y;
                const defaultKind = typeof message.lastSelectedKind === 'string' ? message.lastSelectedKind : 'class';
                
                // 1. Prompt for entity name
                const name = await vscode.window.showInputBox({
                    prompt: '請輸入要建立的實體名稱',
                    placeHolder: '例如: OrderService'
                });
                
                if (!name) return; // User cancelled
                const trimmedName = name.trim();
                if (!/^[A-Za-z_][\w-]*$/.test(trimmedName)) {
                    vscode.window.showErrorMessage('無效的實體名稱！必須是英文字母、數字、底線或破折號組成的識別字。');
                    return;
                }
                
                if (this.indexer && this.indexer.getEntity(trimmedName)) {
                    vscode.window.showErrorMessage(`實體名稱 "${trimmedName}" 已被使用，請使用其他名稱。`);
                    return;
                }
                
                // 2. Prompt for entity kind
                const kinds = ['class', 'interface', 'abstract', 'record', 'enum', 'bind', 'text'];
                const idx = kinds.indexOf(defaultKind);
                if (idx > -1) {
                    kinds.splice(idx, 1);
                }
                kinds.unshift(defaultKind);
                
                const items = kinds.map(k => {
                    let desc = '';
                    if (k === 'class') desc = '類別 (Class)';
                    else if (k === 'abstract') desc = '抽象類別 (Abstract)';
                    else if (k === 'interface') desc = '介面 (Interface)';
                    else if (k === 'record') desc = '紀錄 (Record)';
                    else if (k === 'enum') desc = '列舉 (Enum)';
                    else if (k === 'text') desc = '文字描述流程 (Text)';
                    else if (k === 'bind') desc = '綁定宣告 (Bind)';
                    return { label: k, description: desc };
                });
                
                const typeSelection = await vscode.window.showQuickPick(items, {
                    placeHolder: `請選擇新實體的類型 (預設: ${defaultKind})`
                });
                
                if (!typeSelection) return; // User cancelled
                
                const kind = typeSelection.label;
                
                // 3. Write coordinate to .render.json
                await viewModel.updateEntityPosition(trimmedName, { x, y });
                
                // 4. Append entity definition to document using viewModel
                await viewModel.updateEntity(trimmedName, {
                    name: trimmedName,
                    kind: kind,
                    methods: [],
                    fields: [],
                    relationTargets: [],
                    extendsTargets: [],
                    implementsTargets: [],
                    inheritsTargets: [],
                    associatesTargets: [],
                    aggregatesTargets: [],
                    composesTargets: [],
                    dependsOnTargets: []
                });
            }
            if (message.command === 'updateDocsPage' && typeof message.pageIndex === 'number') {
                if (this.getDocumentTrafficState(document) === 'green') {
                    vscode.window.showWarningMessage('🚨 [Planist 衛兵] 該模組目前處於綠燈 (Stable) 狀態，禁止 any 非物理性修改！');
                    return;
                }
                await this.updateDocsPageInDocument(document, message.pageIndex, message.updates);
            }
            if (message.command === 'addDocsPage') {
                if (this.getDocumentTrafficState(document) === 'green') {
                    vscode.window.showWarningMessage('🚨 [Planist 衛兵] 該模組目前處於綠燈 (Stable) 狀態，禁止 any 非物理性修改！');
                    return;
                }
                const text = document.getText();
                const docsData = parseDocsSchema(text);
                docsData.pages.push({
                    title: `Page ${docsData.pages.length + 1}`,
                    isOutline: false,
                    content: '# New Page\nWrite content here...'
                });
                const newDsl = this.serializeDocsData(docsData);
                const edit = new vscode.WorkspaceEdit();
                const lastLine = document.lineCount - 1;
                const lastChar = document.lineAt(lastLine).text.length;
                const range = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(lastLine, lastChar));
                edit.replace(document.uri, range, newDsl);
                await vscode.workspace.applyEdit(edit);
            }
            if (message.command === 'deleteDocsPage' && typeof message.pageIndex === 'number') {
                if (this.getDocumentTrafficState(document) === 'green') {
                    vscode.window.showWarningMessage('🚨 [Planist 衛兵] 該模組目前處於綠燈 (Stable) 狀態，禁止 any 非物理性修改！');
                    return;
                }
                const text = document.getText();
                const docsData = parseDocsSchema(text);
                if (message.pageIndex >= 0 && message.pageIndex < docsData.pages.length) {
                    docsData.pages.splice(message.pageIndex, 1);
                    const newDsl = this.serializeDocsData(docsData);
                    const edit = new vscode.WorkspaceEdit();
                    const lastLine = document.lineCount - 1;
                    const lastChar = document.lineAt(lastLine).text.length;
                    const range = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(lastLine, lastChar));
                    edit.replace(document.uri, range, newDsl);
                    await vscode.workspace.applyEdit(edit);
                }
            }
            if (message.command === 'updateRawText' && typeof message.text === 'string') {
                if (this.getDocumentTrafficState(document) === 'green') {
                    vscode.window.showWarningMessage('🚨 [Planist 衛兵] 該模組目前處於綠燈 (Stable) 狀態，禁止 any 非物理性修改！');
                    return;
                }
                const edit = new vscode.WorkspaceEdit();
                const lastLine = document.lineCount - 1;
                const lastChar = document.lineAt(lastLine).text.length;
                const range = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(lastLine, lastChar));
                edit.replace(document.uri, range, message.text);
                await vscode.workspace.applyEdit(edit);
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
    private async updateDocsPageInDocument(
        document: vscode.TextDocument,
        pageIndex: number,
        updates: { title?: string; isOutline?: boolean; content?: string }
    ): Promise<void> {
        const text = document.getText();
        const docsData = parseDocsSchema(text);
        if (pageIndex < 0 || pageIndex >= docsData.pages.length) {
            return;
        }

        const page = docsData.pages[pageIndex];
        if (updates.title !== undefined) page.title = updates.title;
        if (updates.isOutline !== undefined) page.isOutline = updates.isOutline;
        if (updates.content !== undefined) page.content = updates.content;

        const newDsl = this.serializeDocsData(docsData);

        const edit = new vscode.WorkspaceEdit();
        const lastLine = document.lineCount - 1;
        const lastChar = document.lineAt(lastLine).text.length;
        const range = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(lastLine, lastChar));
        edit.replace(document.uri, range, newDsl);
        await vscode.workspace.applyEdit(edit);
    }

    // @state: green
    private serializeDocsData(data: DocsSchemaData): string {
        const blocks: string[] = [];
        blocks.push(`#schema docs ${data.docName}`);

        data.pages.forEach(page => {
            const outlineStr = page.isOutline ? ' outline' : '';
            const blockLines: string[] = [];
            blockLines.push(`page "${page.title}"${outlineStr}`);
            blockLines.push('---');
            blockLines.push(page.content);
            blocks.push(blockLines.join('\n'));
        });

        return blocks.join('\n\n===\n\n') + '\n';
    }

    // @state: green
    private getDocumentTrafficState(document: vscode.TextDocument): 'green' | 'yellow' | 'red' {
        const firstFewLines = document.getText(new vscode.Range(0, 0, 5, 0));
        if (firstFewLines.includes('@state' + ': green')) return 'green';
        if (firstFewLines.includes('@state' + ': red')) return 'red';
        return 'yellow';
    }
}
