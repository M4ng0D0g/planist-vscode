/**
 * ============================================================================
 * 模組定位：Planist 跳轉定義 (Go to Definition) 提供者 (src/providers/definitionProvider.ts)
 * 
 * 此檔案負責實現 VS Code 的 `DefinitionProvider` 介面。當用戶在編輯器內對
 * 指向關係的目標實體（如 `-> MyService` 中的 `MyService`）執行 Ctrl+點擊 (或按 F12) 時：
 * 1. 若該實體已存在於專案中，自動索引該檔案，並將游標精準跳轉定位至該實體宣告的行數。
 * 2. 若該實體尚不存在，引導用戶進行選擇要在下方追加建立實體定義，還是在同資料夾內建立新檔案。
 * ============================================================================
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { LogManager } from '../config/logger';
import { FlowIndexer } from '../indexing/flowIndexer';
import {
	findReferenceAtPosition,
	findEntityDeclarationLine,
} from '../dsl/flowDsl';

export class FlowDefinitionProvider implements vscode.DefinitionProvider {
	constructor(private indexer: FlowIndexer) {}

	public async provideDefinition(
		document: vscode.TextDocument,
		position: vscode.Position,
	): Promise<vscode.Definition | vscode.DefinitionLink[] | undefined> {
		if (!/^\s*#schema flow/.test(document.getText())) {
			return undefined;
		}
		// [除錯日誌] 紀錄方法開始與輸入參數
		LogManager.log('FlowDefinitionProvider.provideDefinition: start. DocUri:', document.uri.fsPath, 'Position:', position);

		// [參數驗證]
		LogManager.assert(!!document, 'FlowDefinitionProvider.provideDefinition: document cannot be null');
		LogManager.assert(!!position, 'FlowDefinitionProvider.provideDefinition: position cannot be null');

		const reference = findReferenceAtPosition(document.getText(), position.line, position.character);
		if (!reference) {
			LogManager.log('FlowDefinitionProvider: no reference found at current cursor position.');
			return undefined;
		}

		LogManager.log('FlowDefinitionProvider: found reference targetName:', reference.targetName);

		// 1. 若該實體已被索引快取，直接開啟檔案並跳轉定位至該實體宣告行
		const existingEntity = this.indexer.getEntity(reference.targetName);
		if (existingEntity) {
			LogManager.log('FlowDefinitionProvider: resolving to existing entity file:', existingEntity.uri.fsPath);
			const targetDocument = await vscode.workspace.openTextDocument(existingEntity.uri);
			const targetLine = findEntityDeclarationLine(targetDocument.getText(), reference.targetName);
			const range = targetLine !== undefined
				? new vscode.Range(targetLine, 0, targetLine, targetDocument.lineAt(targetLine).text.length)
				: new vscode.Range(0, 0, 0, targetDocument.lineAt(0).text.length);
			
			const location = new vscode.Location(existingEntity.uri, range);
			
			// [流程驗證]
			LogManager.assert(!!location.uri && !!location.range, 'FlowDefinitionProvider: Location resolution failed');
			return location;
		}

		// 2. 否則，詢問使用者要建立的實體類型
		LogManager.log('FlowDefinitionProvider: entity does not exist. Prompting creation type to user.');
		const typeSelection = await vscode.window.showQuickPick([
			{ label: 'class', description: '建立類別 (Class)' },
			{ label: 'abstract', description: '建立抽象類別 (Abstract)' },
			{ label: 'interface', description: '建立介面 (Interface)' },
			{ label: 'record', description: '建立紀錄 (Record)' },
			{ label: 'enum', description: '建立列舉 (Enum)' },
			{ label: 'text', description: '建立文字描述流程 (Text)' },
			{ label: 'bind', description: '建立綁定宣告 (Bind)' }
		], {
			placeHolder: `找不到實體 "${reference.targetName}"，請選擇要建立的實體類型`
		});

		if (!typeSelection) {
			LogManager.log('FlowDefinitionProvider: User cancelled selection dialog.');
			return undefined;
		}

		const creationType = typeSelection.label;
		const currentDir = path.dirname(document.uri.fsPath);
		const ext = path.extname(document.uri.fsPath) || '.pln';
		const targetFileName = `${reference.targetName}${ext}`;
		const targetFileUri = vscode.Uri.file(path.join(currentDir, targetFileName));

		// 檢查檔案是否存在，如不存在則建立模板，若已存在則追加方法
		try {
			await vscode.workspace.fs.stat(targetFileUri);
			LogManager.log('FlowDefinitionProvider: file already exists.');
			if (reference.targetMethodName) {
				const existingDoc = await vscode.workspace.openTextDocument(targetFileUri);
				const updatedContent = addMethodToEntityText(existingDoc.getText(), reference.targetMethodName);
				if (updatedContent !== existingDoc.getText()) {
					await vscode.workspace.fs.writeFile(targetFileUri, Buffer.from(updatedContent, 'utf8'));
				}
			}
		} catch {
			LogManager.log('FlowDefinitionProvider: creating new file with name:', targetFileName);
			const initialContent = buildFlowTemplate(reference.targetName, creationType, reference.targetMethodName);
			await vscode.workspace.fs.writeFile(targetFileUri, Buffer.from(initialContent, 'utf8'));
		}

		const targetDocument = await vscode.workspace.openTextDocument(targetFileUri);
		
		// 如果有方法，儘量跳轉到方法宣告行，否則跳轉到實體宣告行
		let targetLine: number | undefined;
		if (reference.targetMethodName) {
			const lines = targetDocument.getText().split(/\r?\n/);
			const methodLinePattern = new RegExp(`^\\s*(?:[\\+\\-#]|public|private|protected)?\\s*${reference.targetMethodName}\\s*\\(`, 'i');
			for (let i = 0; i < lines.length; i++) {
				if (methodLinePattern.test(lines[i])) {
					targetLine = i;
					break;
				}
			}
		}
		if (targetLine === undefined) {
			targetLine = findEntityDeclarationLine(targetDocument.getText(), reference.targetName);
		}

		const range = targetLine !== undefined
			? new vscode.Range(targetLine, 0, targetLine, targetDocument.lineAt(targetLine).text.length)
			: new vscode.Range(0, 0, 0, targetDocument.lineAt(0).text.length);

		return new vscode.Location(targetFileUri, range);
	}
}

function buildFlowTemplate(entityName: string, type: string, methodName: string | null): string {
	const methodLine = methodName ? `    + ${methodName}(): void\n` : '';
	if (type === 'bind') {
		return `#schema flow\n\nbind ${entityName}\n`;
	}
	if (type === 'text') {
		const textMethodLine = methodName ? `    ${methodName}()\n` : '';
		return `#schema flow\n\ntext ${entityName} {\n    title: ${entityName} core flow\n\n${textMethodLine}}\n`;
	}
	return `#schema flow\n\n${type} ${entityName} {\n    bind: ""\n    autoImport: false\n\n    [Relations]\n\n    [Methods]\n${methodLine}}\n`;
}

function addMethodToEntityText(text: string, methodName: string): string {
	// 檢查方法是否已定義
	const methodRegex = new RegExp(`^\\s*(?:[\\+\\-#]|public|private|protected)?\\s*${methodName}\\s*\\(`, 'm');
	if (methodRegex.test(text)) {
		return text; // 已經存在
	}

	// 尋找 [Methods] 區段
	const methodsIdx = text.indexOf('[Methods]');
	if (methodsIdx !== -1) {
		const insertPos = methodsIdx + '[Methods]'.length;
		return text.substring(0, insertPos) + `\n    + ${methodName}(): void` + text.substring(insertPos);
	}

	// 若無 [Methods] 區段，則尋找最後一個 '}'
	const lastBraceIdx = text.lastIndexOf('}');
	if (lastBraceIdx !== -1) {
		return text.substring(0, lastBraceIdx) + `    [Methods]\n    + ${methodName}(): void\n` + text.substring(lastBraceIdx);
	}

	return text;
}
