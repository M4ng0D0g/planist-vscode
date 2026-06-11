import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { FlowIndexer } from '../indexing/flowIndexer';
import { RendererFactory } from './ui/schemas/RendererFactory';
import { prepareGraphData } from './graphDataProvider';
import { parseSchemaDocument } from './schemaParser';
import { parseFlowDocuments } from '../dsl/flowDsl';

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
    if (firstFewLines.includes('@state' + ': green')) return 'green';
    if (firstFewLines.includes('@state' + ': red')) return 'red';
    return 'yellow';
}

// @state: green
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
        if (message?.command === 'updateEntity' && typeof message.originalName === 'string') {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document) {
                if (getDocumentTrafficState(editor.document) === 'green') {
                    vscode.window.showWarningMessage('🚨 [Planist 衛兵] 該模組目前處於綠燈 (Stable) 狀態，禁止任何非物理性修改！');
                    return;
                }
                await updateEntityInDocument(editor.document, message.originalName, message.data);
            }
        }
        if (message?.command === 'updateEntityColor' && typeof message.entityName === 'string') {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document) {
                if (getDocumentTrafficState(editor.document) === 'green') {
                    vscode.window.showWarningMessage('🚨 [Planist 衛兵] 該模組目前處於綠燈 (Stable) 狀態，禁止任何非物理性修改！');
                    return;
                }
                await updateRenderJson(editor.document, message.entityName, { color: message.color });
            }
        }
        if (message?.command === 'updateEntityPosition' && typeof message.entityName === 'string') {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document) {
                if (getDocumentTrafficState(editor.document) === 'green') {
                    vscode.window.showWarningMessage('🚨 [Planist 衛兵] 該模組目前處於綠燈 (Stable) 狀態，禁止任何非物理性修改！');
                    return;
                }
                await updateRenderJson(editor.document, message.entityName, { position: message.position });
            }
        }
        if (message?.command === 'updateConnection') {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document) {
                if (getDocumentTrafficState(editor.document) === 'green') {
                    vscode.window.showWarningMessage('🚨 [Planist 衛兵] 該模組目前處於綠燈 (Stable) 狀態，禁止任何非物理性修改！');
                    return;
                }
                await updateConnectionInRenderJson(editor.document, message.connection);
            }
        }
        if (message?.command === 'updateMultipleConnections') {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document) {
                if (getDocumentTrafficState(editor.document) === 'green') {
                    vscode.window.showWarningMessage('🚨 [Planist 衛兵] 該模組目前處於綠燈 (Stable) 狀態，禁止任何非物理性修改！');
                    return;
                }
                await updateMultipleConnectionsInRenderJson(editor.document, message.connections);
            }
        }
        if (message?.command === 'createEntityPrompt' && typeof message.x === 'number' && typeof message.y === 'number') {
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
            
            if (currentIndexer && currentIndexer.getEntity(trimmedName)) {
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
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document) {
                if (getDocumentTrafficState(editor.document) === 'green') {
                    vscode.window.showWarningMessage('🚨 [Planist 衛兵] 該模組目前處於綠燈 (Stable) 狀態，禁止任何非物理性修改！');
                    return;
                }
                
                await updateRenderJson(editor.document, trimmedName, { position: { x, y } });
                
                // 4. Append entity definition to document
                const document = editor.document;
                const currentText = document.getText();
                const separator = currentText.endsWith('\n') ? (currentText.endsWith('\n\n') ? '' : '\n') : '\n\n';
                const newEntityText = separator + buildFlowTemplate(trimmedName, kind);
                
                const edit = new vscode.WorkspaceEdit();
                const endPos = new vscode.Position(document.lineCount, 0);
                edit.insert(document.uri, endPos, newEntityText);
                await vscode.workspace.applyEdit(edit);
                await document.save();
            }
        }
        if (message?.command === 'updateDocumentText' && typeof message.text === 'string') {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document) {
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
    });

    context.subscriptions.push(currentPreviewPanel);
    return currentPreviewPanel;
}

// @state: green
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
        const { entities, connections, config, boardConfig } = await prepareGraphData(currentIndexer, currentViewMode, currentCallChainStart);
        
        if (!currentPreviewPanel || panel !== currentPreviewPanel) return;

        try {
            console.log('[New Board Data Flow] Sending updateGraph command. Entities count:', entities.length);
            await panel.webview.postMessage({
                command: 'updateGraph',
                data: { 
                    entities: JSON.parse(JSON.stringify(entities)),
                    connections: connections || []
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

// @state: green
export async function togglePreviewMode(): Promise<void> {
    const modes: Record<string, string> = {
        general: 'relation',
        relation: 'general',
    };
    currentViewMode = modes[currentViewMode] || 'general';
    currentCallChainStart = undefined;
    
    await refreshCurrentPreview();
}

// @state: green
async function updateEntityInDocument(document: vscode.TextDocument, originalName: string, updatedData: any): Promise<void> {
    const text = document.getText();
    const docs = parseFlowDocuments(text);
    const docModel = docs.find(d => d.entityName === originalName);
    
    if (!docModel || docModel.startLine === undefined || docModel.endLine === undefined) {
        console.error(`updateEntityInDocument: Could not find entity ${originalName} in active document`);
        return;
    }

    const lines: string[] = [];
    for (let i = docModel.startLine; i <= docModel.endLine; i++) {
        lines.push(document.lineAt(i).text);
    }

    const relationLines: string[] = [];
    const commentLines: string[] = [];
    let bindPathLine = '';
    let autoImportLine = '';

    for (let i = 1; i < lines.length - 1; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
            commentLines.push(line);
        } else if (trimmed === '[Relations]') {
            continue;
        } else if (trimmed.startsWith('->') || trimmed.includes('->') || /^\s*(inherits|extends|implements|associates|aggregates|composes|dependsOn)\b/.test(trimmed)) {
            relationLines.push(line);
        } else if (trimmed.startsWith('bind:')) {
            bindPathLine = line;
        } else if (trimmed.startsWith('autoImport:')) {
            autoImportLine = line;
        }
    }

    const newBlockLines: string[] = [];
    let accessPrefix = '';
    if (updatedData.kind !== 'text' && updatedData.kind !== 'bind') {
        const access = updatedData.accessModifier || '';
        if (access === 'public' || access === '+') accessPrefix = 'public ';
        else if (access === 'private' || access === '-') accessPrefix = 'private ';
        else if (access === 'protected' || access === '#') accessPrefix = 'protected ';
    }

    const headerKind = updatedData.kind || 'class';
    newBlockLines.push(`${accessPrefix}${headerKind} ${updatedData.name} {`);

    if (bindPathLine) newBlockLines.push(bindPathLine);
    if (autoImportLine) newBlockLines.push(autoImportLine);

    if (headerKind === 'text') {
        if (updatedData.title) {
            newBlockLines.push(`    title: ${updatedData.title}`);
        }
        if (updatedData.textBody) {
            updatedData.textBody.split(/\r?\n/).forEach((tl: string) => {
                newBlockLines.push(`    ${tl}`);
            });
        }
    }

    // Always preserve fields and methods in the document block if they exist in the payload
    if (updatedData.fields && updatedData.fields.length > 0) {
        newBlockLines.push('    [Fields]');
        updatedData.fields.forEach((f: any) => {
            const fAccess = f.accessModifier ? f.accessModifier + ' ' : '';
            const fType = f.type ? `: ${f.type}` : '';
            newBlockLines.push(`    ${fAccess}${f.name}${fType}`);
        });
    }
    if (updatedData.methods && updatedData.methods.length > 0) {
        newBlockLines.push('    [Methods]');
        updatedData.methods.forEach((m: any) => {
            const mAccess = m.accessModifier ? m.accessModifier + ' ' : '';
            const modifiers = m.modifiers || [];
            const staticStr = modifiers.includes('static') ? 'static ' : '';
            const finalStr = modifiers.includes('final') ? 'final ' : '';
            const returnTypeStr = m.returnType ? `: ${m.returnType}` : '';
            newBlockLines.push(`    ${mAccess}${staticStr}${finalStr}${m.name}()${returnTypeStr}`);
        });
    }

    if (relationLines.length > 0) {
        newBlockLines.push('    [Relations]');
        relationLines.forEach((rl: string) => newBlockLines.push(rl));
    }

    if (commentLines.length > 0) {
        commentLines.forEach((cl: string) => newBlockLines.push(cl));
    }

    newBlockLines.push('}');
    const replacementText = newBlockLines.join('\n');

    const edit = new vscode.WorkspaceEdit();
    const range = new vscode.Range(
        new vscode.Position(docModel.startLine, 0),
        new vscode.Position(docModel.endLine, document.lineAt(docModel.endLine).text.length)
    );
    edit.replace(document.uri, range, replacementText);
    await vscode.workspace.applyEdit(edit);
    await document.save();
}

// @state: green
async function updateEntityColorInDocument(document: vscode.TextDocument, entityName: string, color: string | null): Promise<void> {
    const text = document.getText();
    const docs = parseFlowDocuments(text);
    const docModel = docs.find(d => d.entityName === entityName);

    if (!docModel || docModel.startLine === undefined || docModel.endLine === undefined) {
        console.error(`updateEntityColorInDocument: Could not find entity ${entityName} in active document`);
        return;
    }

    const lines: string[] = [];
    for (let i = docModel.startLine; i <= docModel.endLine; i++) {
        lines.push(document.lineAt(i).text);
    }

    let colorLineIndex = -1;
    for (let i = 1; i < lines.length - 1; i++) {
        if (/^\s*(?:@style\.?|style\.)color\s*:/i.test(lines[i])) {
            colorLineIndex = i;
            break;
        }
    }

    if (colorLineIndex !== -1) {
        if (color === null) {
            lines.splice(colorLineIndex, 1);
        } else {
            lines[colorLineIndex] = `    @style.color: ${color}`;
        }
    } else if (color !== null) {
        lines.splice(lines.length - 1, 0, `    @style.color: ${color}`);
    }

    const replacementText = lines.join('\n');

    const edit = new vscode.WorkspaceEdit();
    const range = new vscode.Range(
        new vscode.Position(docModel.startLine, 0),
        new vscode.Position(docModel.endLine, document.lineAt(docModel.endLine).text.length)
    );
    edit.replace(document.uri, range, replacementText);
    await vscode.workspace.applyEdit(edit);
    await document.save();
}

// @state: green
async function updateRenderJson(document: vscode.TextDocument, entityName: string, updates: { color?: string | null; position?: { x: number; y: number } }): Promise<void> {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!workspaceFolder) return;

    const dirPath = path.join(workspaceFolder.uri.fsPath, '.planist', '.render');
    const filePath = path.join(dirPath, '.render.json');

    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }

    let data: any = { entities: {} };
    if (fs.existsSync(filePath)) {
        try {
            data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            if (!data.entities) data.entities = {};
        } catch (e) {
            console.error('Failed to parse .render.json for saving:', e);
        }
    }

    if (!data.entities[entityName]) {
        data.entities[entityName] = {};
    }

    if (updates.color !== undefined) {
        if (updates.color === null) {
            delete data.entities[entityName].color;
        } else {
            data.entities[entityName].color = updates.color;
        }
    }

    if (updates.position !== undefined) {
        data.entities[entityName].position = updates.position;
    }

    if (Object.keys(data.entities[entityName]).length === 0) {
        delete data.entities[entityName];
    }

    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error('Failed to write to .render.json:', e);
    }
}

// @state: green
async function updateConnectionInRenderJson(
    document: vscode.TextDocument,
    connectionUpdate: {
        from: string;
        to: string;
        relationType: string;
        direction: string | null;
        midX: number | null;
        midY: number | null;
    }
): Promise<void> {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!workspaceFolder) return;

    const dirPath = path.join(workspaceFolder.uri.fsPath, '.planist', '.render');
    const filePath = path.join(dirPath, '.render.json');

    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }

    let data: any = { entities: {}, connections: [] };
    if (fs.existsSync(filePath)) {
        try {
            data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            if (!data.entities) data.entities = {};
            if (!data.connections) data.connections = [];
        } catch (e) {
            console.error('Failed to parse .render.json for saving:', e);
        }
    }

    const index = data.connections.findIndex((c: any) => 
        c.from === connectionUpdate.from && 
        c.to === connectionUpdate.to && 
        c.relationType === connectionUpdate.relationType
    );

    const newConnData = {
        from: connectionUpdate.from,
        to: connectionUpdate.to,
        relationType: connectionUpdate.relationType,
        direction: connectionUpdate.direction,
        midX: connectionUpdate.midX,
        midY: connectionUpdate.midY
    };

    if (newConnData.direction === null) delete (newConnData as any).direction;
    if (newConnData.midX === null) delete (newConnData as any).midX;
    if (newConnData.midY === null) delete (newConnData as any).midY;

    const hasOverrides = newConnData.direction !== undefined || newConnData.midX !== undefined || newConnData.midY !== undefined;

    if (index !== -1) {
        if (hasOverrides) {
            data.connections[index] = newConnData;
        } else {
            data.connections.splice(index, 1);
        }
    } else if (hasOverrides) {
        data.connections.push(newConnData);
    }

    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error('Failed to write to .render.json:', e);
    }
}

// @state: green
async function updateMultipleConnectionsInRenderJson(
    document: vscode.TextDocument,
    connectionUpdates: any[]
): Promise<void> {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!workspaceFolder) return;

    const dirPath = path.join(workspaceFolder.uri.fsPath, '.planist', '.render');
    const filePath = path.join(dirPath, '.render.json');

    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }

    let data: any = { entities: {}, connections: [] };
    if (fs.existsSync(filePath)) {
        try {
            data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            if (!data.entities) data.entities = {};
            if (!data.connections) data.connections = [];
        } catch (e) {
            console.error('Failed to parse .render.json for saving:', e);
        }
    }

    connectionUpdates.forEach(update => {
        const index = data.connections.findIndex((c: any) => 
            c.from === update.from && 
            c.to === update.to && 
            c.relationType === update.relationType
        );

        const newConnData = {
            from: update.from,
            to: update.to,
            relationType: update.relationType,
            direction: update.direction,
            midX: update.midX,
            midY: update.midY
        };

        if (newConnData.direction === null) delete (newConnData as any).direction;
        if (newConnData.midX === null) delete (newConnData as any).midX;
        if (newConnData.midY === null) delete (newConnData as any).midY;

        const hasOverrides = newConnData.direction !== undefined || newConnData.midX !== undefined || newConnData.midY !== undefined;

        if (index !== -1) {
            if (hasOverrides) {
                data.connections[index] = newConnData;
            } else {
                data.connections.splice(index, 1);
            }
        } else if (hasOverrides) {
            data.connections.push(newConnData);
        }
    });

    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error('Failed to write to .render.json:', e);
    }
}

// @state: green
function buildFlowTemplate(entityName: string, type: string): string {
    if (type === 'bind') {
        return `bind ${entityName}\n`;
    }
    if (type === 'text') {
        return `text ${entityName} {\n    title: ${entityName} core flow\n}\n`;
    }
    return `${type} ${entityName} {\n}\n`;
}


