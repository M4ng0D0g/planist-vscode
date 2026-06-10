import * as vscode from 'vscode';
import { LogManager } from '../../config/logger';
import { parseTaskDocument } from '../../dsl/taskDsl';

export class SyncHub {
    
    public static async handleMoveTask(
        documentUri: vscode.Uri, 
        taskTitle: string, 
        taskTarget: string | undefined, 
        fromList: string, 
        toList: string
    ) {
        const document = await vscode.workspace.openTextDocument(documentUri);
        const text = document.getText();
        const model = parseTaskDocument(text);
        
        const fromListModel = model.lists.find(l => l.name === fromList);
        const toListModel = model.lists.find(l => l.name === toList);
        
        if (!fromListModel || !toListModel) {
            LogManager.error(`SyncHub: Could not find lists ${fromList} or ${toList}`);
            return;
        }
        
        const taskItem = fromListModel.items.find(i => i.title === taskTitle && i.target === taskTarget);
        if (!taskItem) {
            LogManager.error(`SyncHub: Could not find task "${taskTitle}" in list "${fromList}"`);
            return;
        }

        const edit = new vscode.WorkspaceEdit();
        
        // 1. Remove from source list
        const removeRange = new vscode.Range(
            new vscode.Position(taskItem.line, 0),
            new vscode.Position(taskItem.line + 1, 0)
        );
        edit.delete(documentUri, removeRange);
        
        // 2. Insert into target list (right before the closing bracket ])
        const insertPosition = new vscode.Position(toListModel.endLine, 0);
        let insertText = `    - ${taskTitle}`;
        if (taskTarget) {
            insertText += ` -> ${taskTarget}`;
        }
        insertText += '\n';
        
        edit.insert(documentUri, insertPosition, insertText);
        
        const success = await vscode.workspace.applyEdit(edit);
        if (success) {
            await document.save();
            LogManager.log(`SyncHub: Successfully moved task "${taskTitle}" to "${toList}"`);
        } else {
            LogManager.error('SyncHub: Failed to apply edit');
        }
    }
}
