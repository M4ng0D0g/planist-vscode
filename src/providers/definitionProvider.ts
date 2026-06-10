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
	parseFlowDocument,
} from '../dsl/flowDsl';

export class FlowDefinitionProvider implements vscode.DefinitionProvider, vscode.Disposable {
	private disposables: vscode.Disposable[] = [];
	private lastSelectionChangeTime = 0;
	private lastSelectionChangeKind: vscode.TextEditorSelectionChangeKind | undefined = undefined;

	constructor(private indexer: FlowIndexer) {
		this.disposables.push(
			vscode.window.onDidChangeTextEditorSelection((e) => {
				if (e.textEditor === vscode.window.activeTextEditor) {
					this.lastSelectionChangeTime = Date.now();
					this.lastSelectionChangeKind = e.kind;
				}
			})
		);
	}

	public dispose() {
		this.disposables.forEach(d => d.dispose());
	}

	// @state: yellow
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

		const activeEditor = vscode.window.activeTextEditor;
		const wordRange = document.getWordRangeAtPosition(position);
		const isCursorOnWord = activeEditor && wordRange
			? wordRange.contains(activeEditor.selection.active)
			: false;

		const isClick = (Date.now() - this.lastSelectionChangeTime < 150) &&
			this.lastSelectionChangeKind === vscode.TextEditorSelectionChangeKind.Mouse &&
			isCursorOnWord;

		const clickedInfo = getClickedEntityInfo(document, position);
		if (!clickedInfo) {
			LogManager.log('FlowDefinitionProvider: no clicked type/reference found at current cursor position.');
			return undefined;
		}

		const targetName = clickedInfo.targetName;
		const targetMethodName = clickedInfo.targetMethodName;

		LogManager.log('FlowDefinitionProvider: found targetName:', targetName);

		const existingEntity = this.indexer.getEntity(targetName);

		// 1. 先確認目前實體與目標實體之間是否有箭頭關係，若無且是點擊觸發，則先詢問並寫入關係
		const currentEntityName = parseFlowDocument(document.getText()).entityName;
		if (currentEntityName && currentEntityName.toLowerCase() !== targetName.toLowerCase()) {
			const hasRel = hasRelationshipToTarget(document.getText(), targetName);
			if (!hasRel && isClick) {
				await promptAndAddRelationship(document.uri, targetName);
			}
		}

		// 2. 若該實體已被索引快取，直接開啟檔案並跳轉定位至該實體宣告行
		if (existingEntity) {
			LogManager.log('FlowDefinitionProvider: resolving to existing entity file:', existingEntity.uri.fsPath);
			let targetDocument = await vscode.workspace.openTextDocument(existingEntity.uri);
			
			if (targetMethodName) {
				const methodRegex = new RegExp(`^\\s*(?:[\\+\\-#]|public|private|protected)?\\s*${targetMethodName}\\s*\\(`, 'm');
				if (!methodRegex.test(targetDocument.getText())) {
					const updatedContent = addMethodToEntityText(targetDocument.getText(), targetMethodName);
					if (updatedContent !== targetDocument.getText()) {
						await vscode.workspace.fs.writeFile(existingEntity.uri, Buffer.from(updatedContent, 'utf8'));
						targetDocument = await vscode.workspace.openTextDocument(existingEntity.uri);
					}
				}
			}

			let targetLine: number | undefined;
			if (targetMethodName) {
				const lines = targetDocument.getText().split(/\r?\n/);
				const methodLinePattern = new RegExp(`^\\s*(?:[\\+\\-#]|public|private|protected)?\\s*${targetMethodName}\\s*\\(`, 'i');
				for (let i = 0; i < lines.length; i++) {
					if (methodLinePattern.test(lines[i])) {
						targetLine = i;
						break;
					}
				}
			}
			if (targetLine === undefined) {
				targetLine = findEntityDeclarationLine(targetDocument.getText(), targetName);
			}

			const range = targetLine !== undefined
				? new vscode.Range(targetLine, 0, targetLine, targetDocument.lineAt(targetLine).text.length)
				: new vscode.Range(0, 0, 0, targetDocument.lineAt(0).text.length);
			
			const location = new vscode.Location(existingEntity.uri, range);
			
			// [流程驗證]
			LogManager.assert(!!location.uri && !!location.range, 'FlowDefinitionProvider: Location resolution failed');
			return location;
		}

		// 3. 否則建立新實體 (預設建立在當前頁面的最下方)
		if (!isClick) {
			return undefined; // hover時不要觸發建立詢問！
		}

		const typeSelection = await vscode.window.showQuickPick([
			{ label: 'class', description: '建立類別 (Class)' },
			{ label: 'abstract', description: '建立抽象類別 (Abstract)' },
			{ label: 'interface', description: '建立介面 (Interface)' },
			{ label: 'record', description: '建立紀錄 (Record)' },
			{ label: 'enum', description: '建立列舉 (Enum)' },
			{ label: 'text', description: '建立文字描述流程 (Text)' },
			{ label: 'bind', description: '建立綁定宣告 (Bind)' }
		], {
			placeHolder: `請選擇要建立的實體 "${targetName}" 的類型`
		});

		if (!typeSelection) {
			LogManager.log('FlowDefinitionProvider: User cancelled type selection dialog.');
			return undefined;
		}

		const creationType = typeSelection.label;

		const currentText = document.getText();
		const separator = currentText.endsWith('\n') ? (currentText.endsWith('\n\n') ? '' : '\n') : '\n\n';
		const newEntityText = separator + buildFlowTemplate(targetName, creationType, targetMethodName, false);
		const updatedText = currentText + newEntityText;
		await vscode.workspace.fs.writeFile(document.uri, Buffer.from(updatedText, 'utf8'));

		const targetDocument = await vscode.workspace.openTextDocument(document.uri);
		const targetLine = findEntityDeclarationLine(targetDocument.getText(), targetName);
		const range = targetLine !== undefined
			? new vscode.Range(targetLine, 0, targetLine, targetDocument.lineAt(targetLine).text.length)
			: new vscode.Range(0, 0, 0, targetDocument.lineAt(0).text.length);

		return new vscode.Location(document.uri, range);
	}
}

function hasRelationshipToTarget(documentText: string, targetName: string): boolean {
	const parsed = parseFlowDocument(documentText);
	const targetLower = targetName.toLowerCase();
	const allTargets = [
		...(parsed.relationTargets || []),
		...(parsed.extendsTargets || []),
		...(parsed.implementsTargets || []),
		...(parsed.inheritsTargets || []),
		...(parsed.associatesTargets || []),
		...(parsed.aggregatesTargets || []),
		...(parsed.composesTargets || []),
		...(parsed.dependsOnTargets || [])
	];
	return allTargets.some(t => t.toLowerCase() === targetLower);
}

interface ClickedEntityInfo {
	targetName: string;
	targetMethodName: string | null;
}

function getClickedEntityInfo(document: vscode.TextDocument, position: vscode.Position): ClickedEntityInfo | null {
	// First, check if there is a reference pattern at the position (original behavior)
	const reference = findReferenceAtPosition(document.getText(), position.line, position.character);
	if (reference) {
		return {
			targetName: reference.targetName,
			targetMethodName: reference.targetMethodName,
		};
	}

	// Otherwise, get the word at the position
	const wordRange = document.getWordRangeAtPosition(position);
	if (!wordRange) {
		return null;
	}
	const word = document.getText(wordRange);
	if (!/^[A-Za-z_][\w-]*$/.test(word)) {
		return null;
	}

	// Ignore keywords
	const keywords = ['class', 'abstract', 'interface', 'record', 'enum', 'text', 'bind', 'package', 'module', 'public', 'private', 'protected', 'static', 'final', 'const', 'variable', 'extends', 'implements', 'inherits', 'associates', 'aggregates', 'composes', 'dependsOn'];
	if (keywords.includes(word.toLowerCase())) {
		return null;
	}

	// Now check if this word is in a type position on the line
	const lineText = document.lineAt(position.line).text;
	const character = position.character;

	// Check if the word is in a field type position:
	const fieldMatch = lineText.match(/^\s*(?:(?:(public|protected|private)\s+)|(?:(\+|-|#)\s*))?((?:(?:final|static|const|variable)\s+)*)([A-Za-z_][\w-]*)(?:\s*:\s*([A-Za-z0-9_<>\s\[\]\&\*\,\.\:]+))?\s*$/i);
	if (fieldMatch && fieldMatch[5]) {
		const typeStr = fieldMatch[5];
		const typeStart = lineText.indexOf(typeStr);
		const typeEnd = typeStart + typeStr.length;
		if (character >= typeStart && character <= typeEnd) {
			const wordIdx = typeStr.indexOf(word);
			if (wordIdx !== -1) {
				return { targetName: word, targetMethodName: null };
			}
		}
	}

	// Check if the word is in a method return type position or param type position:
	const methodMatch = lineText.match(/^\s*(?:(?:(public|protected|private)\s+)|(?:(\+|-|#)\s*))?((?:(?:final|static|const|variable)\s+)*)([A-Za-z_][\w-]*)\s*\(([^)]*)\)(?:\s*:\s*([A-Za-z0-9_<>\s\[\]\&\*\,\.\:]+))?\s*\{?\s*$/i);
	if (methodMatch) {
		// Return type check
		if (methodMatch[6]) {
			const typeStr = methodMatch[6];
			const typeStart = lineText.indexOf(typeStr);
			const typeEnd = typeStart + typeStr.length;
			if (character >= typeStart && character <= typeEnd) {
				const wordIdx = typeStr.indexOf(word);
				if (wordIdx !== -1) {
					return { targetName: word, targetMethodName: null };
				}
			}
		}
		// Parameters check
		if (methodMatch[5]) {
			const paramsStr = methodMatch[5];
			const paramsStart = lineText.indexOf(paramsStr);
			const paramsEnd = paramsStart + paramsStr.length;
			if (character >= paramsStart && character <= paramsEnd) {
				const wordInParamsIdx = paramsStr.indexOf(word);
				if (wordInParamsIdx !== -1) {
					const beforeWord = paramsStr.substring(0, wordInParamsIdx).trim();
					if (beforeWord.endsWith(':')) {
						return { targetName: word, targetMethodName: null };
					}
					const lastColon = beforeWord.lastIndexOf(':');
					if (lastColon !== -1) {
						const between = beforeWord.substring(lastColon + 1).trim();
						if (!between.includes(',')) {
							return { targetName: word, targetMethodName: null };
						}
					}
				}
			}
		}
	}

	return null;
}

async function promptAndAddRelationship(sourceUri: vscode.Uri, targetName: string) {
	try {
		const document = await vscode.workspace.openTextDocument(sourceUri);
		const documentText = document.getText();
		
		const hasRel = hasRelationshipToTarget(documentText, targetName);
		if (hasRel) {
			return;
		}

		const relSelection = await vscode.window.showQuickPick([
			{ label: '組合 (composes)', description: 'composes -> 實體' },
			{ label: '聚合 (aggregates)', description: 'aggregates -> 實體' },
			{ label: '關聯 (associates)', description: 'associates -> 實體' },
			{ label: '依賴 (dependsOn)', description: 'dependsOn -> 實體' },
			{ label: '繼承 (extends)', description: 'extends -> 實體' },
			{ label: '實現 (implements)', description: 'implements -> 實體' },
			{ label: '無關係', description: '不建立任何關係' }
		], {
			placeHolder: `找不到目前實體與 "${targetName}" 的箭頭關係，請選擇要定義的關係`
		});

		if (!relSelection || relSelection.label === '無關係') {
			LogManager.log('FlowDefinitionProvider: User chose No Relationship or cancelled.');
			return;
		}

		const match = relSelection.label.match(/\(([^)]+)\)/);
		const relationship = match ? match[1].trim() : null;
		if (relationship) {
			const updatedSourceText = addRelationshipToEntityText(documentText, relationship, targetName);
			if (updatedSourceText !== documentText) {
				await vscode.workspace.fs.writeFile(sourceUri, Buffer.from(updatedSourceText, 'utf8'));
			}
		}
	} catch (err) {
		LogManager.log('FlowDefinitionProvider.promptAndAddRelationship error:', err);
	}
}

function addRelationshipToEntityText(text: string, relationship: string, targetName: string): string {
	const relRegex = new RegExp(`^\\s*${relationship}\\s*->\\s*${targetName}\\b`, 'm');
	if (relRegex.test(text)) {
		return text;
	}

	const firstBraceIdx = text.indexOf('{');
	if (firstBraceIdx !== -1) {
		const insertPos = firstBraceIdx + 1;
		return text.substring(0, insertPos) + `\n    ${relationship} -> ${targetName}` + text.substring(insertPos);
	}

	return text;
}

function buildFlowTemplate(entityName: string, type: string, methodName: string | null, includeHeader: boolean = true): string {
	let methodLine = '';
	if (methodName) {
		const braces = (type === 'interface') ? '' : ' {\n    }';
		methodLine = `    + ${methodName}(): void${braces}\n`;
	}
	const header = includeHeader ? '#schema flow\n\n' : '';
	if (type === 'bind') {
		return `${header}bind ${entityName}\n`;
	}
	if (type === 'text') {
		const textMethodLine = methodName ? `    ${methodName}()\n` : '';
		return `${header}text ${entityName} {\n    title: ${entityName} core flow\n\n${textMethodLine}}\n`;
	}
	return `${header}${type} ${entityName} {\n${methodLine}}\n`;
}

function addMethodToEntityText(text: string, methodName: string): string {
	// 檢查方法是否已定義
	const methodRegex = new RegExp(`^\\s*(?:[\\+\\-#]|public|private|protected)?\\s*${methodName}\\s*\\(`, 'm');
	if (methodRegex.test(text)) {
		return text; // 已經存在
	}

	const isInterface = /\binterface\s+[A-Za-z_][\w-]*/i.test(text);
	const braces = isInterface ? '' : ' {\n    }';
	const methodLine = `    + ${methodName}(): void${braces}\n`;

	const lastBraceIdx = text.lastIndexOf('}');
	if (lastBraceIdx !== -1) {
		return text.substring(0, lastBraceIdx) + methodLine + text.substring(lastBraceIdx);
	}

	return text;
}

