import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

// @state: green
export class PlanistRenderStore {
    public entities: Record<string, { position?: { x: number; y: number }; color?: string }> = {};
    public connections: Array<{
        from: string;
        to: string;
        relationType: string;
        direction?: string | null;
        midX?: number | null;
        midY?: number | null;
    }> = [];

    // @state: green
    constructor() {}

    // @state: green
    private getRenderFilePath(workspaceUri: vscode.Uri): string {
        return path.join(workspaceUri.fsPath, '.planist', '.render', '.render.json');
    }

    // @state: green
    public async load(workspaceUri: vscode.Uri): Promise<void> {
        const filePath = this.getRenderFilePath(workspaceUri);
        if (!fs.existsSync(filePath)) {
            this.entities = {};
            this.connections = [];
            return;
        }

        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(content);
            this.entities = data.entities || {};
            this.connections = data.connections || [];
        } catch (e) {
            console.error('PlanistRenderStore: failed to load .render.json', e);
            this.entities = {};
            this.connections = [];
        }
    }

    // @state: green
    public async save(workspaceUri: vscode.Uri): Promise<void> {
        const filePath = this.getRenderFilePath(workspaceUri);
        const dirPath = path.dirname(filePath);

        try {
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }

            const data = {
                entities: this.entities,
                connections: this.connections
            };

            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        } catch (e) {
            console.error('PlanistRenderStore: failed to save .render.json', e);
        }
    }

    // @state: green
    public updatePosition(entityName: string, position: { x: number; y: number }): void {
        if (!this.entities[entityName]) {
            this.entities[entityName] = {};
        }
        this.entities[entityName].position = position;
    }

    // @state: green
    public updateColor(entityName: string, color: string | null): void {
        if (!this.entities[entityName]) {
            this.entities[entityName] = {};
        }
        if (color === null) {
            delete this.entities[entityName].color;
        } else {
            this.entities[entityName].color = color;
        }

        if (Object.keys(this.entities[entityName]).length === 0) {
            delete this.entities[entityName];
        }
    }

    // @state: green
    public updateConnection(update: {
        from: string;
        to: string;
        relationType: string;
        direction?: string | null;
        midX?: number | null;
        midY?: number | null;
    }): void {
        const index = this.connections.findIndex(c => 
            c.from === update.from && 
            c.to === update.to && 
            c.relationType === update.relationType
        );

        const newConn: any = {
            from: update.from,
            to: update.to,
            relationType: update.relationType,
            direction: update.direction,
            midX: update.midX,
            midY: update.midY
        };

        if (newConn.direction === null || newConn.direction === undefined) delete newConn.direction;
        if (newConn.midX === null || newConn.midX === undefined) delete newConn.midX;
        if (newConn.midY === null || newConn.midY === undefined) delete newConn.midY;

        const hasOverrides = newConn.direction !== undefined || newConn.midX !== undefined || newConn.midY !== undefined;

        if (index !== -1) {
            if (hasOverrides) {
                this.connections[index] = newConn;
            } else {
                this.connections.splice(index, 1);
            }
        } else if (hasOverrides) {
            this.connections.push(newConn);
        }
    }

    // @state: green
    public updateMultipleConnections(updates: any[]): void {
        updates.forEach(update => this.updateConnection(update));
    }
}
