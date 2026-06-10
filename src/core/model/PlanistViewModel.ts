import * as vscode from 'vscode';
import { PlanistDocument } from './PlanistDocument';
import { PlanistRenderStore } from './PlanistRenderStore';

// @state: green
export class PlanistViewModel {
    public document: PlanistDocument;
    public renderStore: PlanistRenderStore;
    private textDocument: vscode.TextDocument;

    // @state: green
    constructor(textDocument: vscode.TextDocument) {
        this.textDocument = textDocument;
        this.document = new PlanistDocument(textDocument.getText());
        this.renderStore = new PlanistRenderStore();
    }

    // @state: green
    public async load(): Promise<void> {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(this.textDocument.uri);
        if (workspaceFolder) {
            await this.renderStore.load(workspaceFolder.uri);
        }
    }

    // @state: green
    public async save(): Promise<void> {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(this.textDocument.uri);
        if (workspaceFolder) {
            await this.renderStore.save(workspaceFolder.uri);
        }
    }

    // @state: green
    public reloadDocument(): void {
        this.document.parse(this.textDocument.getText());
    }

    // @state: green
    public async updateEntity(originalName: string, updatedData: any): Promise<void> {
        this.document.updateEntity(originalName, updatedData);
        const newDsl = this.document.toDslString();

        const edit = new vscode.WorkspaceEdit();
        const lastLine = this.textDocument.lineCount - 1;
        const lastChar = this.textDocument.lineAt(lastLine).text.length;
        const range = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(lastLine, lastChar));
        edit.replace(this.textDocument.uri, range, newDsl);
        
        await vscode.workspace.applyEdit(edit);
    }

    // @state: green
    public async updateEntityPosition(entityName: string, position: { x: number; y: number }): Promise<void> {
        this.renderStore.updatePosition(entityName, position);
        await this.save();
    }

    // @state: green
    public async updateEntityColor(entityName: string, color: string | null): Promise<void> {
        this.renderStore.updateColor(entityName, color);
        await this.save();
    }

    // @state: green
    public async updateConnection(conn: any): Promise<void> {
        this.renderStore.updateConnection(conn);
        await this.save();
    }

    // @state: green
    public async updateMultipleConnections(conns: any[]): Promise<void> {
        this.renderStore.updateMultipleConnections(conns);
        await this.save();
    }
}
