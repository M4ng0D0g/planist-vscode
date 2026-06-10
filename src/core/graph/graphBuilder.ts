import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { buildFlowGraphModel, FlowGraphModel } from '../../dsl/flowDsl';
import { resolveShortcutPath } from '../../utils/shortcutResolver';

export async function buildCompiledGraph(): Promise<FlowGraphModel> {
    const extensions = ['pln', 'plan', 'flow'];
    const findPromises = extensions.map(ext => 
        vscode.workspace.findFiles(`**/*.${ext}`, '**/node_modules/**')
    );
    const fileGroups = await Promise.all(findPromises);
    const flowFiles = fileGroups.flat();
    
    const fileContents = await Promise.all(flowFiles.map(async (file) => {
        const fileName = path.basename(file.fsPath);
        const openDoc = vscode.workspace.textDocuments.find(doc => doc.uri.toString() === file.toString());
        
        if (openDoc) {
            return { fileName, text: openDoc.getText(), uri: file };
        }
        
        const data = await vscode.workspace.fs.readFile(file);
        return { fileName, text: Buffer.from(data).toString('utf8'), uri: file };
    }));

    return buildFlowGraphModel(
        fileContents,
        (p, docUri) => resolveShortcutPath(p, docUri),
        (p) => {
            try {
                if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
            } catch (e) {
                console.error("Failed to read referenced file:", p, e);
            }
            return undefined;
        }
    );
}