import * as vscode from 'vscode';
import { LogManager } from '../config/logger';

export class FlowCodeActionProvider implements vscode.CodeActionProvider {

	public static readonly providedCodeActionKinds = [
		vscode.CodeActionKind.QuickFix
	];

	public provideCodeActions(document: vscode.TextDocument, range: vscode.Range | vscode.Selection, context: vscode.CodeActionContext, token: vscode.CancellationToken): vscode.CodeAction[] {
		const actions: vscode.CodeAction[] = [];

		for (const diagnostic of context.diagnostics) {
			if (diagnostic.code && typeof diagnostic.code === 'object' && typeof diagnostic.code.value === 'string') {
				const codeVal = diagnostic.code.value as string;
				if (codeVal.startsWith('missing-pattern-method|') || codeVal.startsWith('missing-pattern-relation|')) {
					const parts = codeVal.split('|');
					if (parts.length >= 2) {
						const expected = parts.slice(1).join('|');
						const action = this.createFix(document, diagnostic.range, expected, codeVal.startsWith('missing-pattern-method'));
						actions.push(action);
					}
				}
			}
		}

		return actions;
	}

	private createFix(document: vscode.TextDocument, range: vscode.Range, expected: string, isMethod: boolean): vscode.CodeAction {
		const fixTitle = `Add missing ${isMethod ? 'method' : 'relation'}: ${expected.replace(/\$\d+/g, '...')}`;
		const fix = new vscode.CodeAction(fixTitle, vscode.CodeActionKind.QuickFix);
		fix.edit = new vscode.WorkspaceEdit();
		
		let insertLine = range.start.line;
		let insertChar = 0;
		let foundBrace = false;

		for (let i = range.start.line; i < document.lineCount; i++) {
			const text = document.lineAt(i).text;
			const braceIdx = text.indexOf('{');
			if (braceIdx !== -1) {
				insertLine = i;
				insertChar = braceIdx + 1;
				foundBrace = true;
				break;
			}
		}

		if (foundBrace) {
			const pos = new vscode.Position(insertLine, insertChar);
			const indentText = '\n\t';
			const cleanExpected = expected.replace(/\$\d+/g, 'Any');
			fix.edit.insert(document.uri, pos, indentText + cleanExpected);
		}

		return fix;
	}
}
